import { BigInt, log } from '@graphprotocol/graph-ts';
import {
  ConditionPreparation,
  ConditionResolution,
  PositionSplit,
  PositionsMerge,
  PayoutRedemption,
} from './types/ConditionalTokens/ConditionalTokens';
import {
  COLLATERAL_SCALE,
  EXCHANGE,
  NEG_RISK_ADAPTER,
  USDC,
} from './constants';
import { computePositionId } from './utils/ctf-utils';
import { updateUserPositionWithSell } from './utils/updateUserPositionWithSell';
import { updateUserPositionWithBuy } from './utils/updateUserPositionWithBuy';
import { Condition, UserPosition } from './types/schema';
import { getUserPositionEntityId } from './utils/getUserPositionEntityId';

export function handlePositionSplit(event: PositionSplit): void {
  // - don't track splits from the NegRiskAdapter
  //   these are handled in the NegRiskAdapterMapping
  // - don't track splits from the CTFExchange
  if (
    [NEG_RISK_ADAPTER.toHexString(), EXCHANGE.toHexString()].includes(
      event.params.stakeholder.toHexString(),
    )
  ) {
    return;
  }

  const SELL_PRICE = COLLATERAL_SCALE.div(BigInt.fromI32(2));
  for (let outcomeIndex = 0; outcomeIndex < 2; outcomeIndex++) {
    const positionId = computePositionId(
      USDC,
      event.params.conditionId,
      outcomeIndex,
    );
    updateUserPositionWithSell(
      event.params.stakeholder,
      positionId,
      SELL_PRICE,
      event.params.amount,
    );
  }
}

export function handlePositionsMerge(event: PositionsMerge): void {
  // - don't track merges from the NegRiskAdapter
  //   these are handled in the NegRiskAdapterMapping
  // - don't track merges from the CTFExchange
  if (
    [NEG_RISK_ADAPTER.toHexString(), EXCHANGE.toHexString()].includes(
      event.params.stakeholder.toHexString(),
    )
  ) {
    return;
  }

  const BUY_PRICE = COLLATERAL_SCALE.div(BigInt.fromI32(2));
  for (let outcomeIndex = 0; outcomeIndex < 2; outcomeIndex++) {
    const positionId = computePositionId(
      USDC,
      event.params.conditionId,
      outcomeIndex,
    );
    updateUserPositionWithBuy(
      event.params.stakeholder,
      positionId,
      BUY_PRICE,
      event.params.amount,
    );
  }
}

export function handlePayoutRedemption(event: PayoutRedemption): void {
  // - don't track redemptions from the NegRiskAdapter
  //   these are handled in the NegRiskAdapterMapping
  if (
    [NEG_RISK_ADAPTER.toHexString()].includes(
      event.params.redeemer.toHexString(),
    )
  ) {
    return;
  }

  const conditionId = event.params.conditionId;
  let condition = Condition.load(conditionId.toHexString());

  if (condition == null) {
    log.error('Failed to update market positions: condition {} not prepared', [
      conditionId.toHexString(),
    ]);
    return;
  }

  if (condition.payoutDenominator == BigInt.zero()) {
    log.error('Failed to update market positions: payoutDenominator is 0', []);
    return;
  }

  const payoutNumerators = condition.payoutNumerators;
  const payoutDenominator = condition.payoutDenominator;

  for (let outcomeIndex = 0; outcomeIndex < 2; outcomeIndex++) {
    const positionId = computePositionId(USDC, conditionId, outcomeIndex);

    const userPosition = UserPosition.load(
      getUserPositionEntityId(event.params.redeemer, positionId),
    );

    if (userPosition === null) {
      return;
    }

    const amount = userPosition.amount;
    const price = payoutNumerators[outcomeIndex]
      .times(COLLATERAL_SCALE)
      .div(payoutDenominator);
    updateUserPositionWithSell(
      event.params.redeemer,
      positionId,
      price,
      amount,
    );
  }
}

export function handleConditionPreparation(event: ConditionPreparation): void {
  // we don't handle conditions with more than 2 outcomes
  if (event.params.outcomeSlotCount.toI32() !== 2) {
    return;
  }

  let condition = new Condition(event.params.conditionId.toHexString());

  condition.save();
}

export function handleConditionResolution(event: ConditionResolution): void {
  let conditionId = event.params.conditionId.toHexString();
  let condition = Condition.load(conditionId);
  if (condition == null) {
    log.error('could not find condition {} to resolve', [conditionId]);
    return;
  }

  condition.payoutNumerators = event.params.payoutNumerators;
  condition.payoutDenominator = event.params.payoutNumerators.reduce(
    (cur, acc) => cur.plus(acc),
    BigInt.zero(),
  );

  condition.save();
}
