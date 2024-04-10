import {
  PositionSplit,
  PositionsMerge,
  PayoutRedemption,
} from './types/NegRiskAdapter/NegRiskAdapter';
import { Condition } from './types/schema';
import { updateOpenInterest } from './oi-utils';

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
