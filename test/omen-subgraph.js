const Web3 = require('web3');
const TruffleContract = require("@truffle/contract");
const { default: axios } = require('axios');
const delay = require('delay');
const fs = require('fs-extra');
const path = require('path');
const should = require('should');

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

const subgraphName = 'protofire/omen';

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

async function getTimestampFromReceipt({ blockHash }) {
  return (await web3.eth.getBlock(blockHash)).timestamp;
}

function advanceTime(time) {
  return new Promise((resolve, reject) => {
    web3.currentProvider.send({
      jsonrpc: '2.0',
      method: 'evm_increaseTime',
      params: [time],
      id: new Date().getTime(),
    }, (err, result) => {
      if (err) { return reject(err) }
      return resolve(result)
    });
  });
}

function nthRoot(x, n) {
  if (n <= 0) {
    throw new Error(`invalid n ${n} passed to nthRoot`);
  }

  let root = x;
  let deltaRoot;
  do {
    deltaRoot = x.div(root.pow(toBN(n - 1))).sub(root).divn(n);
    root = root.add(deltaRoot);
  } while (deltaRoot.ltn(0))

  return root;
}

describe('Omen subgraph', function() {
  function checkMarketMakerState(hasTraded) {
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
          outcomeSlotCount
          liquidityParameter
          indexedOnQuestion
          condition {
            id
            question {
              id
            }
          }
          question {
            id
            indexedFixedProductMarketMakers { id }
          }
          templateId
          data
          title
          outcomes
          category
          language
          arbitrator
          openingTimestamp
          timeout
          poolMembers {
            funder {
              id
            }
            amount
          }
          participants {
            participant {
              id
            }
          }
        }
      }`);

      should.exist(fixedProductMarketMaker);
      toChecksumAddress(fixedProductMarketMaker.creator).should.equal(creator);
      Number(fixedProductMarketMaker.creationTimestamp).should.equal(fpmmCreationTimestamp);
      toChecksumAddress(fixedProductMarketMaker.collateralToken).should.equal(weth.address);
      fixedProductMarketMaker.conditions.should.eql([{ id: conditionId }]);
      fixedProductMarketMaker.fee.should.equal(fee);
      fixedProductMarketMaker.collateralVolume.should.equal(runningCollateralVolume.toString());
      const chainOutcomeTokenAmounts = await conditionalTokens.balanceOfBatch(
        new Array(positionIds.length).fill(fpmm.address),
        positionIds,
      );
      fixedProductMarketMaker.outcomeTokenAmounts.should.eql(
        chainOutcomeTokenAmounts.map(v => v.toString()),
      );
      fixedProductMarketMaker.outcomeSlotCount.should.equal(outcomeSlotCount);
      fixedProductMarketMaker.liquidityParameter.should.equal(
        nthRoot(
          chainOutcomeTokenAmounts.reduce((acc, amount) => acc.mul(amount), toBN(1)),
          positionIds.length,
        ).toString(),
      );

      fixedProductMarketMaker.indexedOnQuestion.should.be.true();
      should.exist(fixedProductMarketMaker.condition);
      fixedProductMarketMaker.condition.id.should.equal(conditionId);
      should.exist(fixedProductMarketMaker.question);
      fixedProductMarketMaker.question.id.should.equal(fixedProductMarketMaker.condition.question.id);
      fixedProductMarketMaker.question.indexedFixedProductMarketMakers
        .should.eql([{ id: fpmm.address.toLowerCase() }]);

      fixedProductMarketMaker.templateId.should.equal('2');
      fixedProductMarketMaker.data.should.equal(questionData);
      fixedProductMarketMaker.title.should.equal(questionTitle);
      fixedProductMarketMaker.outcomes.should.eql(questionOutcomes)
      fixedProductMarketMaker.category.should.equal(questionCategory);
      fixedProductMarketMaker.language.should.equal(questionLanguage);

      fixedProductMarketMaker.arbitrator.should.equal(arbitrator.toLowerCase());
      fixedProductMarketMaker.openingTimestamp.should.equal(answerSubmissionOpeningTimestamp.toString());
      fixedProductMarketMaker.timeout.should.equal(finalizationTimeout.toString());

      for (const { funder, amount } of fixedProductMarketMaker.poolMembers) {
        if (funder.id === `0x${'0'.repeat(40)}`) {
          amount.should.equal((await fpmm.totalSupply()).neg().toString());
        } else {
          amount.should.equal((await fpmm.balanceOf(funder.id)).toString());
        }
      }

      if (hasTraded) {
        fixedProductMarketMaker.participants.should.eql([
          { participant: { id: trader.toLowerCase() } },
        ]);
      } else {
        fixedProductMarketMaker.participants.should.eql([]);
      }
    });
  }

  let creator;
  let trader;
  let shareholder;
  let arbitrator;
  let reporter;
  before('get accounts', async function() {
    [
      creator,
      trader,
      shareholder,
      arbitrator,
      reporter,
    ] = await web3.eth.getAccounts();
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
  const finalizationTimeout = 100;
  const answerSubmissionOpeningTimestamp = 0;
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
  const questionTitle = 'なに!?';
  const questionOutcomes = ['Something', 'nothing, not something...', 'A "thing"']
  const questionCategory = 'Cat😈猫🂡';
  const questionLanguage = 'en-US'
  step('ask question', async function() {
    const nonce = randomHex(32);
    const { receipt, logs } = await realitio.askQuestion(
      2, // <- template ID
      questionData,
      arbitrator,
      finalizationTimeout,
      answerSubmissionOpeningTimestamp,
      nonce,
      { from: creator }
    );
    questionId = logs.find(({ event }) => event === 'LogNewQuestion').args.question_id;

    await waitForGraphSync();

    const { question } = await querySubgraph(`{
      question(id: "${questionId}") {
        templateId
        data
        title
        outcomes
        category
        language

        arbitrator
        openingTimestamp
        timeout

        currentAnswer
        currentAnswerBond
        currentAnswerTimestamp

        isPendingArbitration

        answerFinalizedTimestamp

        indexedFixedProductMarketMakers { id }

        conditions { id }
      }
    }`);

    question.templateId.should.equal('2');
    question.data.should.equal(questionData);
    question.title.should.equal(questionTitle);
    question.outcomes.should.eql(questionOutcomes)
    question.category.should.equal(questionCategory);
    question.language.should.equal(questionLanguage);

    question.arbitrator.should.equal(arbitrator.toLowerCase());
    question.openingTimestamp.should.equal(answerSubmissionOpeningTimestamp.toString());
    question.timeout.should.equal(finalizationTimeout.toString());

    should.not.exist(question.currentAnswer);
    should.not.exist(question.currentAnswerBond);
    should.not.exist(question.currentAnswerTimestamp);

    question.isPendingArbitration.should.be.false();

    should.not.exist(question.answerFinalizedTimestamp);

    question.indexedFixedProductMarketMakers.should.be.empty();

    question.conditions.should.be.empty();
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

    const { condition, question } = await querySubgraph(`{
      condition(id: "${conditionId}") {
        oracle
        question {
          title
        }
        outcomeSlotCount
        resolutionTimestamp
        payouts
      }
      question(id: "${questionId}") {
        conditions { id }
      }
    }`);
    condition.oracle.should.equal(oracle.address.toLowerCase());
    condition.question.should.eql({ title: 'なに!?' });
    condition.outcomeSlotCount.should.equal(outcomeSlotCount);
    should.not.exist(condition.resolutionTimestamp);
    should.not.exist(condition.payouts);

    question.conditions.should.eql([{ id: conditionId }]);
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
    const { receipt } = await factory.create2FixedProductMarketMaker(...creationArgs);
    fpmmCreationTimestamp = await getTimestampFromReceipt(receipt);
    fpmm = await FixedProductMarketMaker.at(fpmmAddress);
  });

  checkMarketMakerState(false);

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
        liquidityParameter
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
    runningCollateralVolume.iadd(toBN(investmentAmount)).isub(
      toBN(investmentAmount).mul(toBN(fee)).div(toBN(toWei('1')))
    );

    await waitForGraphSync();

    const { fixedProductMarketMaker } = await querySubgraph(`{
      fixedProductMarketMaker(id: "${fpmm.address.toLowerCase()}") {
        collateralVolume
      }
    }`);

    fixedProductMarketMaker.collateralVolume.should.equal(runningCollateralVolume.toString());
  });

  checkMarketMakerState(true);

  const returnAmount = toWei('0.5');
  step('have trader sell to market maker', async function() {
    await conditionalTokens.setApprovalForAll(fpmm.address, true, { from: trader });

    const sellAmount = await fpmm.calcSellAmount(returnAmount, 0);
    await fpmm.sell(returnAmount, 0, sellAmount, { from: trader });
    runningCollateralVolume.iadd(toBN(returnAmount)).iadd(
      toBN(returnAmount).mul(toBN(fee)).div(toBN(toWei('1')).sub(toBN(fee)))
    );

    await waitForGraphSync();

    const { fixedProductMarketMaker } = await querySubgraph(`{
      fixedProductMarketMaker(id: "${fpmm.address.toLowerCase()}") {
        collateralVolume
      }
    }`);

    fixedProductMarketMaker.collateralVolume.should.equal(runningCollateralVolume.toString());
  });

  checkMarketMakerState(true);

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

  checkMarketMakerState(true);

  step('submit answer', async function() {
    const answer = `0x${'0'.repeat(63)}1`;
    const bond = toWei('1');
    const { receipt } = await realitio.submitAnswer(
      questionId,
      answer,
      0,
      { from: reporter, value: bond },
    );

    await waitForGraphSync();

    const { question, fixedProductMarketMaker } = await querySubgraph(`{
      question(id: "${questionId}") {
        currentAnswer
        currentAnswerBond
        currentAnswerTimestamp
        answerFinalizedTimestamp
      }
      fixedProductMarketMaker(id: "${fpmm.address.toLowerCase()}") {
        currentAnswer
        currentAnswerBond
        currentAnswerTimestamp
        answerFinalizedTimestamp
      }
    }`);

    timestamp = await getTimestampFromReceipt(receipt);
    finalizedTimestamp = timestamp + finalizationTimeout;

    question.currentAnswer.should.equal(answer);
    question.currentAnswerBond.should.equal(bond);
    question.currentAnswerTimestamp.should.equal(timestamp.toString());
    question.answerFinalizedTimestamp.should.equal(finalizedTimestamp.toString());
    fixedProductMarketMaker.currentAnswer.should.equal(answer);
    fixedProductMarketMaker.currentAnswerBond.should.equal(bond);
    fixedProductMarketMaker.currentAnswerTimestamp.should.equal(timestamp.toString());
    fixedProductMarketMaker.answerFinalizedTimestamp.should.equal(finalizedTimestamp.toString());
  });

  step('resolve condition', async function() {
    await advanceTime(finalizationTimeout);

    const { receipt: { blockHash } } = await oracle.resolve(
      questionId,
      2,
      questionData,
      3,
      { from: reporter },
    );
    const { timestamp } = await web3.eth.getBlock(blockHash);

    await waitForGraphSync();

    const { condition, fixedProductMarketMaker } = await querySubgraph(`{
      condition(id: "${conditionId}") {
        resolutionTimestamp
        payouts
      }
      fixedProductMarketMaker(id: "${fpmm.address.toLowerCase()}") {
        resolutionTimestamp
        payouts
      }
    }`);
    condition.resolutionTimestamp.should.equal(timestamp.toString());
    condition.payouts.should.deepEqual(['0', '1', '0']);
    fixedProductMarketMaker.resolutionTimestamp.should.equal(timestamp.toString());
    fixedProductMarketMaker.payouts.should.eql(['0', '1', '0']);
  });
});
