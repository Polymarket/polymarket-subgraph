import { BigInt } from '@graphprotocol/graph-ts'

/*
 * Checks whether the partition corresponds to a full set
 * see: https://github.com/gnosis/conditional-tokens-contracts/blob/master/contracts/ConditionalTokens.sol
 */
export function partitionCheck(partition: BigInt[], outcomeSlotCount: i32): boolean {
  let freeIndexSet = (1 << outcomeSlotCount) - 1;
  for (let i = 0; i < partition.length; i++) {
    let indexSet = partition[i];
    freeIndexSet ^= indexSet.toI32();
  }
  return freeIndexSet == 0
}