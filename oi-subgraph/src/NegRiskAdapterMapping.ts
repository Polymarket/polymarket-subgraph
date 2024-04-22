import { BigInt } from '@graphprotocol/graph-ts';
import {
  PositionSplit,
  PositionsMerge,
  PayoutRedemption,
  PositionsConverted,
  MarketPrepared,
  QuestionPrepared,
} from './types/NegRiskAdapter/NegRiskAdapter';
import { Condition, NegRiskEvent } from './types/schema';
import {
  updateGlobalOpenInterest,
  updateMarketOpenInterest,
  updateOpenInterest,
} from './oi-utils';
import { indexSetContains } from '../../common/utils/indexSetContains';
import { getConditionId, getNegRiskQuestionId } from '../../common';
import { NEG_RISK_ADAPTER } from '../../common/constants';

const FEE_DENOMINATOR = BigInt.fromI32(10_000);

export function handlePositionSplit(event: PositionSplit): void {
  const conditionId = event.params.conditionId.toHexString();
  const condition = Condition.load(conditionId);
  if (condition == null) {
    // ignore
    return;
  }

  // Split increases OI
  const amount = event.params.amount;
  updateOpenInterest(conditionId, amount);
}

export function handlePositionsMerge(event: PositionsMerge): void {
  const conditionId = event.params.conditionId.toHexString();
  const condition = Condition.load(conditionId);

  if (condition == null) {
    return;
  }
  // Merge reduces OI
  const amount = event.params.amount.neg();

  updateOpenInterest(conditionId, amount);
}

export function handlePayoutRedemption(event: PayoutRedemption): void {
  const conditionId = event.params.conditionId.toHexString();
  const condition = Condition.load(conditionId);

  if (condition == null) {
    return;
  }

  // Redeem reduces OI
  const amount = event.params.payout.neg();

  updateOpenInterest(conditionId, amount);
}

export function handlePositionsConverted(event: PositionsConverted): void {
  const negRiskEvent = NegRiskEvent.load(event.params.marketId.toHexString());
  if (negRiskEvent == null) {
    // ignore
    return;
  }

  // @ts-expect-error Cannot find name 'u32'.
  const questionCount = <u32>negRiskEvent.questionCount;
  const indexSet = event.params.indexSet;

  // @ts-expect-error Cannot find name 'u8'.
  let questionIndex: u8 = 0;
  let conditionIds: string[] = [];

  // Get the number of no positions
  for (; questionIndex < questionCount; questionIndex++) {
    if (indexSetContains(indexSet, questionIndex)) {
      const questionId = getNegRiskQuestionId(
        event.params.marketId,
        questionIndex,
      );
      const conditionId = getConditionId(NEG_RISK_ADAPTER, questionId)
        .toHexString()
        .toLowerCase();
      conditionIds.push(conditionId);
    }
  }

  // Converts reduce OI by releasing collateral if number of no positions > 1
  let noCount = conditionIds.length;
  if (noCount > 1) {
    let amount = event.params.amount;
    let feeAmount = BigInt.zero();
    let multiplier = BigInt.fromI32(noCount - 1);
    let divisor = BigInt.fromI32(noCount);

    if (negRiskEvent.feeBps.gt(BigInt.zero())) {
      feeAmount = amount.times(negRiskEvent.feeBps).div(FEE_DENOMINATOR);
      amount = amount.minus(feeAmount);

      let feeReleasedToVault = feeAmount.times(multiplier).neg();
      // Reduce OI by the fees released to the vault
      for (let i = 0; i < noCount; i++) {
        let condition = conditionIds[i];
        updateMarketOpenInterest(condition, feeReleasedToVault.div(divisor));
      }
      updateGlobalOpenInterest(feeReleasedToVault);
    }

    let collateralReleasedToUser = amount.times(multiplier).neg();
    // Reduce OI by the collateral released to the user
    for (let i = 0; i < noCount; i++) {
      let condition = conditionIds[i];
      updateMarketOpenInterest(
        condition,
        collateralReleasedToUser.div(divisor),
      );
    }
    updateGlobalOpenInterest(collateralReleasedToUser);
  }
}

export function handleMarketPrepared(event: MarketPrepared): void {
  const negRiskEvent = new NegRiskEvent(event.params.marketId.toHexString());
  negRiskEvent.questionCount = 0;
  negRiskEvent.feeBps = event.params.feeBips;
  negRiskEvent.save();
}

export function handleQuestionPrepared(event: QuestionPrepared): void {
  const negRiskEvent = NegRiskEvent.load(event.params.marketId.toHexString());
  if (negRiskEvent == null) {
    return;
  }

  negRiskEvent.questionCount += 1;
  negRiskEvent.save();
}
