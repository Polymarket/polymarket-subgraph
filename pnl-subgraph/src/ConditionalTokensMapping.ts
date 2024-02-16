import { BigInt, log } from '@graphprotocol/graph-ts';

import {
  ConditionPreparation,
  ConditionResolution,
  PositionSplit,
  PositionsMerge,
  PayoutRedemption,
} from './types/ConditionalTokens/ConditionalTokens';

import { updateUserPositionWithSell } from './utils/updateUserPositionWithSell';
import { updateUserPositionWithBuy } from './utils/updateUserPositionWithBuy';
import { loadOrCreateUserPosition } from './utils/loadOrCreateUserPosition';

import {
  COLLATERAL_SCALE,
  EXCHANGE,
  FIFTY_CENTS,
  NEG_RISK_ADAPTER,
} from '../../common/constants';
import { createCondition } from './utils/createCondition';
import { loadCondition } from './utils/loadCondition';

// SPLIT
export function handlePositionSplit(event: PositionSplit): void {
  const conditionId = event.params.conditionId;
  const condition = loadCondition(conditionId);
  if (condition == null) {
    // ignore
    return;
  }

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

  // @ts-expect-error Cannot find name 'u8'.
  let outcomeIndex: u8 = 0;
  for (; outcomeIndex < 2; outcomeIndex++) {
    const positionId = condition.positionIds[outcomeIndex];

    updateUserPositionWithBuy(
      event.params.stakeholder,
      positionId,
      FIFTY_CENTS,
      event.params.amount,
    );
  }
}

// MERGE
export function handlePositionsMerge(event: PositionsMerge): void {
  const conditionId = event.params.conditionId;
  const condition = loadCondition(conditionId);
  if (condition == null) {
    // ignore
    return;
  }

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

  // @ts-expect-error Cannot find name 'u8'.
  let outcomeIndex: u8 = 0;
  for (; outcomeIndex < 2; outcomeIndex++) {
    const positionId = condition.positionIds[outcomeIndex];

    updateUserPositionWithSell(
      event.params.stakeholder,
      positionId,
      FIFTY_CENTS,
      event.params.amount,
    );
  }
}

// REDEEM
export function handlePayoutRedemption(event: PayoutRedemption): void {
  const conditionId = event.params.conditionId;
  const condition = loadCondition(conditionId);
  if (condition == null) {
    // ignore
    return;
  }

  // - don't track redemptions from the NegRiskAdapter
  //   these are handled in the NegRiskAdapterMapping
  if (
    [NEG_RISK_ADAPTER.toHexString()].includes(
      event.params.redeemer.toHexString(),
    )
  ) {
    return;
  }

  if (condition.payoutDenominator == BigInt.zero()) {
    log.error('Failed to update market positions: payoutDenominator is 0', []);
    return;
  }

  const payoutNumerators = condition.payoutNumerators;
  const payoutDenominator = condition.payoutDenominator;

  // @ts-expect-error Cannot find name 'u8'.
  let outcomeIndex: u8 = 0;
  for (; outcomeIndex < 2; outcomeIndex++) {
    const positionId = condition.positionIds[outcomeIndex];

    const userPosition = loadOrCreateUserPosition(
      event.params.redeemer,
      positionId,
    );

    // the user redeems their entire amount
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
  if (event.params.outcomeSlotCount.toI32() != 2) {
    return;
  }

  const negRisk =
    event.params.oracle.toHexString() == NEG_RISK_ADAPTER.toHexString();

  // this is the only place we make new conditions !
  const condition = createCondition(event.params.conditionId, negRisk);
  condition.save();
}

export function handleConditionResolution(event: ConditionResolution): void {
  const conditionId = event.params.conditionId;
  const condition = loadCondition(conditionId);
  if (condition == null) {
    // ignore
    return;
  }

  condition.payoutNumerators = event.params.payoutNumerators;
  condition.payoutDenominator = event.params.payoutNumerators.reduce(
    (cur, acc) => cur.plus(acc),
    BigInt.zero(),
  );

  condition.save();
}
