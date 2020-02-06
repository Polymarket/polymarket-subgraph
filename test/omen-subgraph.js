const Web3 = require('web3');
const TruffleContract = require("@truffle/contract");
const { default: axios } = require('axios');
const delay = require('delay');
const fs = require('fs-extra');
const path = require('path');
const should = require('should')

const provider = new Web3.providers.HttpProvider("http://localhost:8545");
const web3 = new Web3(provider);

const { getConditionId } = require('@gnosis.pm/conditional-tokens-contracts/utils/id-helpers')(web3.utils);

function getContract(contractName) {
  const C = TruffleContract(fs.readJsonSync(path.join(
    __dirname, '..', 'build', 'contracts', `${contractName}.json`
  )));
  C.setProvider(provider);
  return C;
}

const WETH9 = getContract('WETH9');
const ConditionalTokens = getContract('ConditionalTokens');
const FPMMDeterministicFactory = getContract('FPMMDeterministicFactory');
const FixedProductMarketMaker = getContract('FixedProductMarketMaker');

async function queryGraph(query) {
  return (await axios.post('http://localhost:8000/subgraphs', { query })).data.data;
}

const subgraphName = 'cag/omen';

async function querySubgraph(query) {
  return (await axios.post(`http://localhost:8000/subgraphs/name/${subgraphName}`, { query })).data.data;
}

async function waitForGraphSync(targetBlockNumber) {
  if (targetBlockNumber == null)
    targetBlockNumber = await web3.eth.getBlockNumber();

  while(true) {
    await delay(100);
    const {
      subgraphs: [{
        currentVersion: {
          id: currentVersionId,
          deployment: {
            latestEthereumBlockNumber
          }
        },
        versions: [{ id: latestVersionId }]
      }]
    } = await queryGraph(`{
      subgraphs(
        where: {name: "${subgraphName}"}
        first: 1
      ) {
        currentVersion {
          id
          deployment {
            latestEthereumBlockNumber
          }
        }
        versions(
          orderBy: createdAt,
          orderDirection: desc,
          first: 1
        ) {
          id
        }
      }
    }`);

    if(
      currentVersionId === latestVersionId &&
      latestEthereumBlockNumber == targetBlockNumber
    )
      break;
  }
}

describe('Omen subgraph', function() {
  let creator;
  let oracle;
  let trader;
  let shareholder;
  before('get accounts', async function() {
    [creator, oracle, trader, shareholder] = await web3.eth.getAccounts();
  });

  let weth;
  let conditionalTokens;
  let factory;
  before('get deployed contracts', async function() {
    weth = await WETH9.deployed();
    conditionalTokens = await ConditionalTokens.deployed();
    factory = await FPMMDeterministicFactory.deployed();
  });

  it('exists', async function() {
    const { subgraphs } = await queryGraph(`{
      subgraphs(first: 1, where: {name: "${subgraphName}"}) {
        id
      }
    }`);

    subgraphs.should.be.not.empty();
  });

  let conditionId;
  const questionId = web3.utils.randomHex(32);
  const outcomeSlotCount = 3;
  step('prepare condition', async function() {
    await conditionalTokens.prepareCondition(oracle, questionId, outcomeSlotCount, { from: creator });
    conditionId = getConditionId(oracle, questionId, outcomeSlotCount);
  });

  let fpmm;
  let fpmmCreateTx;
  const fee = web3.utils.toWei('0.001');
  const initialFunds = web3.utils.toWei('1');
  step('use factory to create market maker', async function() {
    await weth.deposit({ value: initialFunds, from: creator });
    await weth.approve(factory.address, initialFunds, { from: creator });

    const saltNonce = `0x${'1'.repeat(64)}`;
    const creationArgs = [
      saltNonce,
      conditionalTokens.address,
      weth.address,
      [conditionId],
      fee,
      initialFunds,
      [],
      { from: creator }
    ]
    const fpmmAddress = await factory.create2FixedProductMarketMaker.call(...creationArgs);
    fpmmCreateTx = await factory.create2FixedProductMarketMaker(...creationArgs);
    fpmm = await FixedProductMarketMaker.at(fpmmAddress);
  });
  
  step('check subgraph for created market maker', async function() {
    const { receipt: { blockHash } } = fpmmCreateTx;
    const { timestamp } = await web3.eth.getBlock(blockHash);

    await waitForGraphSync();

    const { fixedProductMarketMaker } = await querySubgraph(`{
      fixedProductMarketMaker(id: "${fpmm.address.toLowerCase()}") {
        creator
        creationTimestamp
        collateralToken
        fee
        collateralVolume
        outcomeTokenAmounts
      }
    }`);

    should.exist(fixedProductMarketMaker);
    web3.utils.toChecksumAddress(fixedProductMarketMaker.creator).should.equal(creator);
    Number(fixedProductMarketMaker.creationTimestamp).should.equal(timestamp);

    web3.utils.toChecksumAddress(fixedProductMarketMaker.collateralToken).should.equal(weth.address);
    fixedProductMarketMaker.fee.should.equal(fee);
    fixedProductMarketMaker.collateralVolume.should.equal('0');
    fixedProductMarketMaker.outcomeTokenAmounts.should.deepEqual(
      new Array(outcomeSlotCount).fill(initialFunds)
    );
  });

  step('should not index market makers on different ConditionalTokens', async function() {
    const altConditionalTokens = await ConditionalTokens.new({ from: creator });
    await altConditionalTokens.prepareCondition(oracle, questionId, outcomeSlotCount, { from: creator });
    await weth.deposit({ value: initialFunds, from: creator });
    await weth.approve(factory.address, initialFunds, { from: creator });

    const saltNonce = `0x${'2'.repeat(64)}`;
    const creationArgs = [
      saltNonce,
      altConditionalTokens.address,
      weth.address,
      [conditionId],
      fee,
      initialFunds,
      [],
      { from: creator }
    ]
    const fpmmAddress = await factory.create2FixedProductMarketMaker.call(...creationArgs);
    await factory.create2FixedProductMarketMaker(...creationArgs);

    await waitForGraphSync();

    const { fixedProductMarketMaker } = await querySubgraph(`{
      fixedProductMarketMaker(id: "${fpmmAddress.toLowerCase()}") {
        creator
        creationTimestamp
        collateralToken
        fee
        collateralVolume
        outcomeTokenAmounts
      }
    }`);

    should.not.exist(fixedProductMarketMaker);
  });

  const runningCollateralVolume = web3.utils.toBN(0);
  const investmentAmount = web3.utils.toWei('1');
  step('have trader buy from market maker', async function() {
    await weth.deposit({ value: investmentAmount, from: trader });
    await weth.approve(fpmm.address, investmentAmount, { from: trader });

    const buyAmount = await fpmm.calcBuyAmount(investmentAmount, 0);
    await fpmm.buy(investmentAmount, 0, buyAmount, { from: trader });
    runningCollateralVolume.iadd(web3.utils.toBN(investmentAmount));

    await waitForGraphSync();

    const { fixedProductMarketMaker } = await querySubgraph(`{
      fixedProductMarketMaker(id: "${fpmm.address.toLowerCase()}") {
        collateralVolume
      }
    }`);

    fixedProductMarketMaker.collateralVolume.should.equal(runningCollateralVolume.toString());
  });

  const returnAmount = web3.utils.toWei('0.5');
  step('have trader sell to market maker', async function() {
    await conditionalTokens.setApprovalForAll(fpmm.address, true, { from: trader });

    const sellAmount = await fpmm.calcSellAmount(returnAmount, 0);
    await fpmm.sell(returnAmount, 0, sellAmount, { from: trader });
    runningCollateralVolume.iadd(web3.utils.toBN(returnAmount));

    await waitForGraphSync();

    const { fixedProductMarketMaker } = await querySubgraph(`{
      fixedProductMarketMaker(id: "${fpmm.address.toLowerCase()}") {
        collateralVolume
      }
    }`);

    fixedProductMarketMaker.collateralVolume.should.equal(runningCollateralVolume.toString());
  });

  step('transfer pool shares', async function() {
    const shareholderPoolAmount = web3.utils.toWei('0.5');
    await fpmm.transfer(shareholder, shareholderPoolAmount, { from: creator });

    await waitForGraphSync();

    const creatorMembershipId = `${fpmm.address}${creator}`.toLowerCase();
    const shareholderMembershipId = `${fpmm.address}${shareholder}`.toLowerCase();
    const { creatorMembership, shareholderMembership } = await querySubgraph(`{
      creatorMembership: fpmmPoolMembership(id: "${creatorMembershipId}") {
        amount
      }
      shareholderMembership: fpmmPoolMembership(id: "${shareholderMembershipId}") {
        amount
      }
    }`);

    (await fpmm.balanceOf(shareholder)).toString()
      .should.equal(shareholderPoolAmount)
      .and.equal(shareholderMembership.amount);
    (await fpmm.balanceOf(creator)).toString()
      .should.equal(creatorMembership.amount);
  });

  step('resolve condition', async function() {
    const { receipt: { blockHash } } = await conditionalTokens.reportPayouts(questionId, [3, 2, 5], { from: oracle });
    const { timestamp } = await web3.eth.getBlock(blockHash);

    await waitForGraphSync();

    const { condition } = await querySubgraph(`{
      condition(id: "${conditionId}") {
        resolutionTimestamp
        payouts
      }
    }`);
    condition.resolutionTimestamp.should.equal(timestamp.toString());
    condition.payouts.should.deepEqual(['0.3', '0.2', '0.5']);
  });
});
