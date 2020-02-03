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
  let accounts
  before('get accounts', async function() {
    accounts = await web3.eth.getAccounts();
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

  let creator;
  let oracle;
  step('get accounts', async function() {
    [, creator, oracle] = accounts;
  });

  let conditionId;
  step('prepare condition', async function() {
    const questionId = web3.utils.randomHex(32);
    const outcomeSlotCount = 2;

    await conditionalTokens.prepareCondition(oracle, questionId, outcomeSlotCount, { from: creator });
    conditionId = getConditionId(oracle, questionId, outcomeSlotCount);
  });

  let fpmmAddress;
  let fpmmCreateTx;
  const fee = web3.utils.toWei('0.001');
  step('use factory to create market maker', async function() {
    const initialFunds = web3.utils.toWei('1');
    
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
    fpmmAddress = await factory.create2FixedProductMarketMaker.call(...creationArgs);
    fpmmCreateTx = await factory.create2FixedProductMarketMaker(...creationArgs);
  });
  
  step('check subgraph for created market maker', async function() {
    const { receipt: { blockHash } } = fpmmCreateTx;
    const { timestamp } = await web3.eth.getBlock(blockHash);

    await waitForGraphSync();

    const { fixedProductMarketMaker } = await querySubgraph(`{
      fixedProductMarketMaker(id: "${fpmmAddress.toLowerCase()}") {
        creator
        creationTimestamp
        conditionalTokens
        collateralToken
        fee
        collateralVolume
      }
    }`);

    should.exist(fixedProductMarketMaker);
    web3.utils.toChecksumAddress(fixedProductMarketMaker.creator).should.equal(creator);
    Number(fixedProductMarketMaker.creationTimestamp).should.equal(timestamp);

    web3.utils.toChecksumAddress(fixedProductMarketMaker.conditionalTokens).should.equal(conditionalTokens.address);
    web3.utils.toChecksumAddress(fixedProductMarketMaker.collateralToken).should.equal(weth.address);
    fixedProductMarketMaker.fee.should.equal(fee);
    fixedProductMarketMaker.collateralVolume.should.equal('0');
  });
});
