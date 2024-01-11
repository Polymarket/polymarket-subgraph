import { BigDecimal, log } from '@graphprotocol/graph-ts';

import {
  PositionSplit,
  PositionsMerge,
  PositionResolved,
} from './types/NegRiskAdapter';

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
