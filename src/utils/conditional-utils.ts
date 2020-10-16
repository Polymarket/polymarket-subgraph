import { BigInt } from '@graphprotocol/graph-ts';

/*
 * Checks whether the partition corresponds to a full set
 */
export function partitionCheck(
  partition: BigInt[],
  outcomeSlotCount: i32,
): boolean {
  return partition.length == outcomeSlotCount;
}
