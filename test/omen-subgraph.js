const Web3 = require('web3');
const TruffleContract = require("@truffle/contract");
const { default: axios } = require('axios');
const delay = require('delay');
const fs = require('fs-extra');
const path = require('path');
const should = require('should')

const provider = new Web3.providers.HttpProvider("http://localhost:8545");
const web3 = new Web3(provider);
const {
  toBN,
  toWei,
  toChecksumAddress,
  randomHex,
} = web3.utils;

const {
  getConditionId,
  getCollectionId,
  getPositionId,
} = require('@gnosis.pm/conditional-tokens-contracts/utils/id-helpers')(web3.utils);

function getContract(contractName) {
  const C = TruffleContract(fs.readJsonSync(path.join(
    __dirname, '..', 'build', 'contracts', `${contractName}.json`
  )));
  C.setProvider(provider);
  return C;
}

const WETH9 = getContract('WETH9');
const Realitio = getContract('Realitio');
const RealitioProxy = getContract('RealitioProxy');
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
  function checkMarketMakerState(collateralVolume) {
    step('check subgraph market maker data matches chain', async function() {
      await waitForGraphSync();

      const { fixedProductMarketMaker } = await querySubgraph(`{
        fixedProductMarketMaker(id: "${fpmm.address.toLowerCase()}") {
          creator
          creationTimestamp
          collateralToken
          conditions {
            id
          }
          fee
          collateralVolume
          outcomeTokenAmounts
          poolMembers {
            funder {
              id
            }
            amount
          }
        }
      }`);

      should.exist(fixedProductMarketMaker);
      toChecksumAddress(fixedProductMarketMaker.creator).should.equal(creator);
      Number(fixedProductMarketMaker.creationTimestamp).should.equal(fpmmCreationTimestamp);
      toChecksumAddress(fixedProductMarketMaker.collateralToken).should.equal(weth.address);
      fixedProductMarketMaker.conditions.should.eql([{ id: conditionId }]);
      fixedProductMarketMaker.fee.should.equal(fee);
      fixedProductMarketMaker.collateralVolume.should.equal(collateralVolume);
      fixedProductMarketMaker.outcomeTokenAmounts.should.eql(
        (await conditionalTokens.balanceOfBatch(
          new Array(positionIds.length).fill(fpmm.address),
          positionIds,
        )).map(v => v.toString()),
      );

      for (const { funder, amount } of fixedProductMarketMaker.poolMembers) {
        if (funder.id === `0x${'0'.repeat(40)}`) {
          amount.should.equal((await fpmm.totalSupply()).neg().toString());
        } else {
          amount.should.equal((await fpmm.balanceOf(funder.id)).toString());
        }
      }
    });
  }

  let creator;
  let trader;
  let shareholder;
  let arbitrator;
  before('get accounts', async function() {
    [creator, trader, shareholder, arbitrator] = await web3.eth.getAccounts();
  });

  let weth;
  let realitio;
  let oracle;
  let conditionalTokens;
  let factory;
  before('get deployed contracts', async function() {
    weth = await WETH9.deployed();
    realitio = await Realitio.deployed();
    oracle = await RealitioProxy.deployed();
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

  let questionId;
  step('ask question', async function() {
    const nonce = randomHex(32);
    const questionData = [
      // title
      'なに!?',
      // outcomes
      ' "Something",\r"nothing, not something..." ,\t\n"A \\"thing\\""',
      // category
      'Cat😈\\u732b\\ud83c\\uDCA1',
      // language
      'en-US',
    ].join('\u241f');
    const { logs } = await realitio.askQuestion(
      2, // <- template ID
      questionData,
      arbitrator,
      100,
      0,
      nonce,
      { from: creator }
    );
    questionId = logs.find(({ event }) => event === 'LogNewQuestion').args.question_id;

    await waitForGraphSync();

    const { question } = await querySubgraph(`{
      question(id: "${questionId}") {
        data
        title
        outcomes
        category
        language
      }
    }`);

    question.data.should.equal(questionData);
    question.title.should.equal('なに!?');
    question.outcomes.should.eql(['Something', 'nothing, not something...', 'A "thing"'])
    question.category.should.equal('Cat😈猫🂡');
    question.language.should.equal('en-US');
  });

  let conditionId;
  let positionIds;
  const outcomeSlotCount = 3;
  step('prepare condition', async function() {
    await conditionalTokens.prepareCondition(oracle.address, questionId, outcomeSlotCount, { from: creator });
    conditionId = getConditionId(oracle.address, questionId, outcomeSlotCount);
    positionIds = Array.from(
      { length: outcomeSlotCount },
      (v, i) => getPositionId(weth.address, getCollectionId(conditionId, 1 << i)),
    );

    await waitForGraphSync();

    const { condition } = await querySubgraph(`{
      condition(id: "${conditionId}") {
        question {
          title
        }
        resolutionTimestamp
        payouts
      }
    }`);
    condition.question.should.eql({ title: 'なに!?' });
    should.not.exist(condition.resolutionTimestamp);
    should.not.exist(condition.payouts);
  });

  let fpmm;
  let fpmmCreationTimestamp;
  const fee = toWei('0.001');
  const initialFunds = toWei('1');
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
    const { receipt: { blockHash } } = await factory.create2FixedProductMarketMaker(...creationArgs);
    ({ timestamp: fpmmCreationTimestamp } = await web3.eth.getBlock(blockHash));
    fpmm = await FixedProductMarketMaker.at(fpmmAddress);
  });

  checkMarketMakerState('0');

  step('should not index market makers on different ConditionalTokens', async function() {
    const altConditionalTokens = await ConditionalTokens.new({ from: creator });
    await altConditionalTokens.prepareCondition(oracle.address, questionId, outcomeSlotCount, { from: creator });
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

  const runningCollateralVolume = toBN(0);
  const investmentAmount = toWei('1');
  step('have trader buy from market maker', async function() {
    await weth.deposit({ value: investmentAmount, from: trader });
    await weth.approve(fpmm.address, investmentAmount, { from: trader });

    const buyAmount = await fpmm.calcBuyAmount(investmentAmount, 0);
    await fpmm.buy(investmentAmount, 0, buyAmount, { from: trader });
    runningCollateralVolume.iadd(toBN(investmentAmount));

    await waitForGraphSync();

    const { fixedProductMarketMaker } = await querySubgraph(`{
      fixedProductMarketMaker(id: "${fpmm.address.toLowerCase()}") {
        collateralVolume
      }
    }`);

    fixedProductMarketMaker.collateralVolume.should.equal(runningCollateralVolume.toString());
  });

  checkMarketMakerState(investmentAmount);

  const returnAmount = toWei('0.5');
  step('have trader sell to market maker', async function() {
    await conditionalTokens.setApprovalForAll(fpmm.address, true, { from: trader });

    const sellAmount = await fpmm.calcSellAmount(returnAmount, 0);
    await fpmm.sell(returnAmount, 0, sellAmount, { from: trader });
    runningCollateralVolume.iadd(toBN(returnAmount));

    await waitForGraphSync();

    const { fixedProductMarketMaker } = await querySubgraph(`{
      fixedProductMarketMaker(id: "${fpmm.address.toLowerCase()}") {
        collateralVolume
      }
    }`);

    fixedProductMarketMaker.collateralVolume.should.equal(runningCollateralVolume.toString());
  });

  checkMarketMakerState(toBN(investmentAmount).add(toBN(returnAmount)).toString());

  step('transfer pool shares', async function() {
    const shareholderPoolAmount = toWei('0.5');
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

  checkMarketMakerState(toBN(investmentAmount).add(toBN(returnAmount)).toString());

  it.skip('resolve condition', async function() {
    const { receipt: { blockHash } } = await conditionalTokens.reportPayouts(questionId, [3, 2, 5], { from: oracle.address });
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
