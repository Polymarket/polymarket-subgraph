import { BigInt, log } from '@graphprotocol/graph-ts'

import { FixedProductMarketMakerCreation } from '../generated/FPMMDeterministicFactory/FPMMDeterministicFactory'
import { FixedProductMarketMaker, Condition, Question } from '../generated/schema'
import { FixedProductMarketMaker as FixedProductMarketMakerTemplate } from '../generated/templates'
import { nthRoot } from './nth-root';
import { timestampToDay, joinDayAndVolume } from './day-volume-utils';

let zeroAsBigInt = BigInt.fromI32(0);

export function handleFixedProductMarketMakerCreation(event: FixedProductMarketMakerCreation): void {
  let address = event.params.fixedProductMarketMaker;
  let addressHexString = address.toHexString();
  let conditionalTokensAddress = event.params.conditionalTokens.toHexString();

  if (conditionalTokensAddress != '{{ConditionalTokens.addressLowerCase}}') {
    log.info(
      'cannot index market maker {}: using conditional tokens {}',
      [addressHexString, conditionalTokensAddress],
    );
    return;
  }

  let fixedProductMarketMaker = new FixedProductMarketMaker(addressHexString);

  fixedProductMarketMaker.creator = event.params.creator;
  fixedProductMarketMaker.creationTimestamp = event.block.timestamp;

  fixedProductMarketMaker.collateralToken = event.params.collateralToken;
  fixedProductMarketMaker.fee = event.params.fee;

  let conditionIds = event.params.conditionIds;
  let outcomeTokenCount = 1;
  let conditionIdStrs = new Array<string>(conditionIds.length);
  for(let i = 0; i < conditionIds.length; i++) {
    let conditionIdStr = conditionIds[i].toHexString();

    let condition = Condition.load(conditionIdStr);
    if(condition == null) {
      log.error(
        'failed to create market maker {}: condition {} not prepared',
        [addressHexString, conditionIdStr],
      );
      return;
    }

    outcomeTokenCount *= condition.outcomeSlotCount;
    conditionIdStrs[i] = conditionIdStr;
  }
  fixedProductMarketMaker.conditions = conditionIdStrs;
  fixedProductMarketMaker.outcomeSlotCount = outcomeTokenCount;
  fixedProductMarketMaker.indexedOnQuestion = false;

  if(conditionIdStrs.length == 1) {
    let conditionIdStr = conditionIdStrs[0];
    fixedProductMarketMaker.condition = conditionIdStr;

    let condition = Condition.load(conditionIdStr);
    if(condition == null) {
      log.error(
        'failed to create market maker {}: condition {} not prepared',
        [addressHexString, conditionIdStr],
      );
      return;
    }

    let questionIdStr = condition.questionId.toHexString();
    fixedProductMarketMaker.question = questionIdStr;
    let question = Question.load(questionIdStr);
    if(question != null) {
      fixedProductMarketMaker.templateId = question.templateId;
      fixedProductMarketMaker.data = question.data;
      fixedProductMarketMaker.title = question.title;
      fixedProductMarketMaker.outcomes = question.outcomes;
      fixedProductMarketMaker.category = question.category;
      fixedProductMarketMaker.language = question.language;
      fixedProductMarketMaker.arbitrator = question.arbitrator;
      fixedProductMarketMaker.openingTimestamp = question.openingTimestamp;
      fixedProductMarketMaker.timeout = question.timeout;

      if(question.indexedFixedProductMarketMakers.length < 100) {
        fixedProductMarketMaker.currentAnswer = question.currentAnswer;
        fixedProductMarketMaker.currentAnswerBond = question.currentAnswerBond;
        fixedProductMarketMaker.currentAnswerTimestamp = question.currentAnswerTimestamp;
        fixedProductMarketMaker.isPendingArbitration = question.isPendingArbitration;
        fixedProductMarketMaker.arbitrationOccurred = question.arbitrationOccurred;
        fixedProductMarketMaker.answerFinalizedTimestamp = question.answerFinalizedTimestamp;
        let fpmms = question.indexedFixedProductMarketMakers;
        fpmms.push(addressHexString);
        question.indexedFixedProductMarketMakers = fpmms;
        question.save();
        fixedProductMarketMaker.indexedOnQuestion = true;
      } else {
        log.warning(
          'cannot continue updating live question (id {}) properties on fpmm {}',
          [questionIdStr, addressHexString],
        );
      }
    }
  }

  fixedProductMarketMaker.collateralVolume = zeroAsBigInt;

  let currentDay = timestampToDay(event.block.timestamp);
  fixedProductMarketMaker.lastActiveDay = currentDay;
  fixedProductMarketMaker.runningDailyVolume = zeroAsBigInt;
  fixedProductMarketMaker.lastActiveDayAndRunningDailyVolume = joinDayAndVolume(currentDay, zeroAsBigInt);
  fixedProductMarketMaker.collateralVolumeBeforeLastActiveDay = zeroAsBigInt;

  let outcomeTokenAmounts = new Array<BigInt>(outcomeTokenCount);
  let amountsProduct = BigInt.fromI32(1);
  for(let i = 0; i < outcomeTokenAmounts.length; i++) {
    outcomeTokenAmounts[i] = zeroAsBigInt;
    amountsProduct = amountsProduct.times(outcomeTokenAmounts[i]);
  }
  fixedProductMarketMaker.outcomeTokenAmounts = outcomeTokenAmounts;
  fixedProductMarketMaker.liquidityParameter = nthRoot(amountsProduct, outcomeTokenAmounts.length);

  fixedProductMarketMaker.save();

  FixedProductMarketMakerTemplate.create(address);
}
