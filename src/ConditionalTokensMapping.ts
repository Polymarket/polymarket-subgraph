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
import { partitionCheck } from './utils/conditional-utils';
import { bigZero } from './utils/constants';
import { getCollateralDetails } from './utils/collateralTokens';
import { markAccountAsSeen, requireAccount } from './utils/account-utils';

export function handlePositionSplit(event: PositionSplit): void {
  if (
    FixedProductMarketMaker.load(event.params.stakeholder.toHexString()) != null
  ) {
    // We don't track splits within the market makers
    return;
  }

  getCollateralDetails(event.params.collateralToken);
  requireAccount(event.params.stakeholder.toHexString(), event.block.timestamp);
  markAccountAsSeen(
    event.params.stakeholder.toHexString(),
    event.block.timestamp,
  );

  let split = new Split(event.transaction.hash.toHexString());
  split.timestamp = event.block.timestamp;
  split.stakeholder = event.params.stakeholder.toHexString();
  split.collateralToken = event.params.collateralToken.toHexString();
  split.parentCollectionId = event.params.parentCollectionId;
  split.condition = event.params.conditionId.toHexString();
  split.partition = event.params.partition;
  split.amount = event.params.amount;
  split.save();

  let condition = Condition.load(split.condition);
  if (condition == null) {
    log.error('Failed to update market positions: condition {} not prepared', [
      split.condition,
    ]);
    return;
  }

  // If the user has split from collateral then we want to update their market position accordingly
  if (partitionCheck(split.partition, condition.outcomeSlotCount)) {
    let marketMakers = condition.fixedProductMarketMakers;
    for (let i = 0; i < marketMakers.length; i += 1) {
      // This is not ideal as in theory we could have multiple market makers for the same condition
      // Given that this subgraph only tracks market makers deployed by Polymarket, this is acceptable for now
      updateMarketPositionsFromSplit(marketMakers[i], event);
    }
  }
}

export function handlePositionsMerge(event: PositionsMerge): void {
  if (
    FixedProductMarketMaker.load(event.params.stakeholder.toHexString()) != null
  ) {
    // We don't track merges within the market makers
    return;
  }
  requireAccount(event.params.stakeholder.toHexString(), event.block.timestamp);
  markAccountAsSeen(
    event.params.stakeholder.toHexString(),
    event.block.timestamp,
  );

  let merge = new Merge(event.transaction.hash.toHexString());
  merge.timestamp = event.block.timestamp;
  merge.stakeholder = event.params.stakeholder.toHexString();
  merge.collateralToken = event.params.collateralToken.toHexString();
  merge.parentCollectionId = event.params.parentCollectionId;
  merge.condition = event.params.conditionId.toHexString();
  merge.partition = event.params.partition;
  merge.amount = event.params.amount;
  merge.save();

  let condition = Condition.load(merge.condition);
  if (condition == null) {
    log.error('Failed to update market positions: condition {} not prepared', [
      merge.condition,
    ]);
    return;
  }

  // If the user has merged a full set of outcome tokens then we want to update their market position accordingly
  if (partitionCheck(merge.partition, condition.outcomeSlotCount)) {
    // This is not ideal as in theory we could have multiple market makers for the same condition
    // Given that this subgraph only tracks market makers deployed by Polymarket, this is acceptable for now
    let marketMakers = condition.fixedProductMarketMakers;
    for (let i = 0; i < marketMakers.length; i += 1) {
      updateMarketPositionsFromMerge(marketMakers[i], event);
    }
  }
}

export function handlePayoutRedemption(event: PayoutRedemption): void {
  requireAccount(event.params.redeemer.toHexString(), event.block.timestamp);
  markAccountAsSeen(event.params.redeemer.toHexString(), event.block.timestamp);

  let redemption = new Redemption(event.transaction.hash.toHexString());
  redemption.timestamp = event.block.timestamp;
  redemption.redeemer = event.params.redeemer.toHexString();
  redemption.collateralToken = event.params.collateralToken.toHexString();
  redemption.parentCollectionId = event.params.parentCollectionId;
  redemption.condition = event.params.conditionId.toHexString();
  redemption.indexSets = event.params.indexSets;
  redemption.payout = event.params.payout;
  redemption.save();

  let condition = Condition.load(redemption.condition);
  if (condition == null) {
    log.error('Failed to update market positions: condition {} not prepared', [
      redemption.condition,
    ]);
    return;
  }

  let marketMakers = condition.fixedProductMarketMakers;
  for (let i = 0; i < marketMakers.length; i += 1) {
    // This is not ideal as in theory we could have multiple market makers for the same condition
    // Given that this subgraph only tracks market makers deployed by Polymarket, this is acceptable for now
    updateMarketPositionsFromRedemption(marketMakers[i], event);
  }
}

export function handleConditionPreparation(event: ConditionPreparation): void {
  let condition = new Condition(event.params.conditionId.toHexString());
  condition.oracle = event.params.oracle;
  condition.questionId = event.params.questionId;
  condition.fixedProductMarketMakers = [];

  let global = requireGlobal();
  global.numConditions += 1;
  global.numOpenConditions += 1;
  global.save();

  condition.outcomeSlotCount = event.params.outcomeSlotCount.toI32();
  condition.save();
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

  if (condition.resolutionTimestamp != null || condition.payouts != null) {
    log.error('should not be able to resolve condition {} more than once', [
      conditionId,
    ]);
    return;
  }

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
