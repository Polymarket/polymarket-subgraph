import { BigDecimal, log } from '@graphprotocol/graph-ts';
import {
  ConditionPreparation,
  ConditionResolution,
  PositionSplit,
  PositionsMerge,
  PayoutRedemption,
} from './types/ConditionalTokens/ConditionalTokens';
import {
  Condition,
  Redemption,
  Merge,
  Split,
  FixedProductMarketMaker,
} from './types/schema';
import { requireGlobal } from './utils/global-utils';
import {
  updateMarketPositionsFromMerge,
  updateMarketPositionsFromRedemption,
  updateMarketPositionsFromSplit,
} from './utils/market-positions-utils';
import { bigZero } from './utils/constants';
import { markAccountAsSeen, requireAccount } from './utils/account-utils';
import { getEventKey } from '../../common/utils/getEventKey';
import { EXCHANGE, NEG_RISK_ADAPTER } from './constants';

export function handlePositionSplit(event: PositionSplit): void {
  // - don't track splits within the market makers
  if (
    FixedProductMarketMaker.load(event.params.stakeholder.toHexString()) != null
  ) {
    return;
  }

  // - don't track splits from the NegRiskAdapter
  //   these are handled in the NegRiskAdapterMapping
  // - don't track splits from the CTFExchange
  if (
    [NEG_RISK_ADAPTER, EXCHANGE].includes(
      event.params.stakeholder.toHexString(),
    )
  ) {
    return;
  }

  // skip unrecognized conditions
  const conditionId = event.params.conditionId.toHexString();
  const condition = Condition.load(event.params.conditionId.toHexString());
  if (condition == null) {
    log.error('Failed to update market positions: condition {} not prepared', [
      conditionId,
    ]);
    return;
  }

  requireAccount(event.params.stakeholder.toHexString(), event.block.timestamp);
  markAccountAsSeen(
    event.params.stakeholder.toHexString(),
    event.block.timestamp,
  );

  const split = new Split(getEventKey(event));
  split.timestamp = event.block.timestamp;
  split.stakeholder = event.params.stakeholder.toHexString();
  split.collateralToken = event.params.collateralToken.toHexString();
  split.parentCollectionId = event.params.parentCollectionId;
  split.condition = event.params.conditionId.toHexString();
  split.partition = event.params.partition;
  split.amount = event.params.amount;
  split.save();

  // negRisk splits must come through the negRiskAdapter
  const negRisk = false;
  updateMarketPositionsFromSplit(
    event.params.conditionId,
    event.params.stakeholder,
    event.params.amount,
    negRisk,
  );
}

export function handlePositionsMerge(event: PositionsMerge): void {
  // - don't track merges within the market makers
  if (
    FixedProductMarketMaker.load(event.params.stakeholder.toHexString()) != null
  ) {
    return;
  }

  // - don't track merges from the NegRiskAdapter
  //   these are handled in the NegRiskAdapterMapping
  // - don't track merges from the CTFExchange
  if (
    [NEG_RISK_ADAPTER, EXCHANGE].includes(
      event.params.stakeholder.toHexString(),
    )
  ) {
    return;
  }

  // skip unrecognized conditions
  const conditionId = event.params.conditionId.toHexString();
  const condition = Condition.load(event.params.conditionId.toHexString());
  if (condition == null) {
    log.error('Failed to update market positions: condition {} not prepared', [
      conditionId,
    ]);
    return;
  }

  requireAccount(event.params.stakeholder.toHexString(), event.block.timestamp);
  markAccountAsSeen(
    event.params.stakeholder.toHexString(),
    event.block.timestamp,
  );

  const merge = new Merge(getEventKey(event));
  merge.timestamp = event.block.timestamp;
  merge.stakeholder = event.params.stakeholder.toHexString();
  merge.collateralToken = event.params.collateralToken.toHexString();
  merge.parentCollectionId = event.params.parentCollectionId;
  merge.condition = event.params.conditionId.toHexString();
  merge.partition = event.params.partition;
  merge.amount = event.params.amount;
  merge.save();

  // negRisk merges must come through the negRiskAdapter
  const negRisk = false;
  updateMarketPositionsFromMerge(
    event.params.conditionId,
    event.params.stakeholder,
    event.params.amount,
    negRisk,
  );
}

export function handlePayoutRedemption(event: PayoutRedemption): void {
  // - don't track redemptions from the NegRiskAdapter
  //   these are handled in the NegRiskAdapterMapping
  if (event.params.redeemer.toHexString() == NEG_RISK_ADAPTER) {
    return;
  }

  // skip unrecognized conditions
  const conditionId = event.params.conditionId.toHexString();
  const condition = Condition.load(event.params.conditionId.toHexString());
  if (condition == null) {
    log.error('Failed to update market positions: condition {} not prepared', [
      conditionId,
    ]);
    return;
  }

  requireAccount(event.params.redeemer.toHexString(), event.block.timestamp);
  markAccountAsSeen(event.params.redeemer.toHexString(), event.block.timestamp);

  const redemption = new Redemption(getEventKey(event));
  redemption.timestamp = event.block.timestamp;
  redemption.redeemer = event.params.redeemer.toHexString();
  redemption.collateralToken = event.params.collateralToken.toHexString();
  redemption.parentCollectionId = event.params.parentCollectionId;
  redemption.condition = event.params.conditionId.toHexString();
  redemption.indexSets = event.params.indexSets;
  redemption.payout = event.params.payout;
  redemption.save();

  // negRisk redemptions must come through the negRiskAdapter
  const negRisk = false;
  updateMarketPositionsFromRedemption(
    event.params.conditionId,
    event.params.redeemer,
    event.params.indexSets,
    event.block.timestamp,
    negRisk,
    [],
  );
}

export function handleConditionPreparation(event: ConditionPreparation): void {
  // we don't handle conditions with more than 2 outcomes
  if (event.params.outcomeSlotCount.toI32() != 2) {
    return;
  }

  // new condition
  const condition = new Condition(event.params.conditionId.toHexString());
  condition.oracle = event.params.oracle;
  condition.questionId = event.params.questionId;
  condition.fixedProductMarketMakers = [];
  condition.outcomeSlotCount = 2;
  condition.save();

  const global = requireGlobal();
  global.numConditions += 1;
  global.numOpenConditions += 1;
  global.save();
}

export function handleConditionResolution(event: ConditionResolution): void {
  let conditionId = event.params.conditionId.toHexString();
  let condition = Condition.load(conditionId);
  if (condition == null) {
    log.error('could not find condition {} to resolve', [conditionId]);
    return;
  }

  let global = requireGlobal();
  global.numOpenConditions -= 1;
  global.numClosedConditions += 1;
  global.save();

  condition.resolutionTimestamp = event.block.timestamp;

  let payoutNumerators = event.params.payoutNumerators;
  let payoutDenominator = bigZero;
  for (let i = 0; i < payoutNumerators.length; i += 1) {
    payoutDenominator = payoutDenominator.plus(payoutNumerators[i]);
  }
  let payoutDenominatorDec = payoutDenominator.toBigDecimal();
  let payouts = new Array<BigDecimal>(payoutNumerators.length);
  for (let i = 0; i < payouts.length; i += 1) {
    payouts[i] = payoutNumerators[i].divDecimal(payoutDenominatorDec);
  }
  condition.payouts = payouts;
  condition.payoutNumerators = payoutNumerators;
  condition.payoutDenominator = payoutDenominator;
  condition.resolutionHash = event.transaction.hash;
  condition.save();
}
