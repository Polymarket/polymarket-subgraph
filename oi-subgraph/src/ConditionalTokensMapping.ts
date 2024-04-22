import {
  ConditionPreparation,
  PositionSplit,
  PositionsMerge,
  PayoutRedemption,
} from './types/ConditionalTokens/ConditionalTokens';
import { Condition } from './types/schema';
import { updateOpenInterest } from './oi-utils';
import { USDC } from '../../common/constants';

export function handlePositionSplit(event: PositionSplit): void {
  // skip unrecognized conditions
  const conditionId = event.params.conditionId.toHexString();
  const condition = Condition.load(conditionId);

  if (condition == null) {
    return;
  }

  // Only track USDC splits, ignores wrapped collateral from neg risk markets
  const collateralToken = event.params.collateralToken.toHexString();
  if (collateralToken != USDC.toHexString()) {
    return;
  }

  // Split increases OI
  const amount = event.params.amount;
  updateOpenInterest(conditionId, amount);
}

export function handlePositionsMerge(event: PositionsMerge): void {
  // skip unrecognized conditions
  const conditionId = event.params.conditionId.toHexString();
  const condition = Condition.load(conditionId);

  if (condition == null) {
    return;
  }

  // Only track USDC merge, ignores wrapped collateral from neg risk markets
  const collateralToken = event.params.collateralToken.toHexString();
  if (collateralToken != USDC.toHexString()) {
    return;
  }

  // Merge reduces OI
  const amount = event.params.amount.neg();

  updateOpenInterest(conditionId, amount);
}

export function handlePayoutRedemption(event: PayoutRedemption): void {
  // skip unrecognized conditions
  const conditionId = event.params.conditionId.toHexString();
  const condition = Condition.load(conditionId);

  if (condition == null) {
    return;
  }

  // Only track USDC redemptions, ignores wrapped collateral from neg risk markets
  const collateralToken = event.params.collateralToken.toHexString();
  if (collateralToken != USDC.toHexString()) {
    return;
  }

  // Redeem reduces OI
  const amount = event.params.payout.neg();

  updateOpenInterest(conditionId, amount);
}

export function handleConditionPreparation(event: ConditionPreparation): void {
  // we don't handle conditions with more than 2 outcomes
  if (event.params.outcomeSlotCount.toI32() != 2) {
    return;
  }

  // new condition
  const conditionId = event.params.conditionId.toHexString();
  const condition = new Condition(conditionId);
  condition.save();
}
