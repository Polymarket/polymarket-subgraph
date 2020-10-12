import { BigInt } from '@graphprotocol/graph-ts';

/*
 * Checks whether the partition corresponds to a full set
 * see: https://github.com/gnosis/conditional-tokens-contracts/blob/master/contracts/ConditionalTokens.sol
 *
 * Note: we have removed all safety checks for invalid partitions as these are enforced onchain.
 */
export function partitionCheck(
  partition: BigInt[],
  outcomeSlotCount: i32,
): boolean {
  // eslint-disable-next-line no-bitwise
  let freeIndexSet = (1 << outcomeSlotCount) - 1;
  for (let i = 0; i < partition.length; i += 1) {
    // Perform bitwise XOR between freeIndex set and partition set
    // This removes all positions encoded in each set from freeIndexSet
    // eslint-disable-next-line no-bitwise
    freeIndexSet ^= partition[i].toI32();
  }

  // If the partition contains the full set of outcomes then the result
  // should be equal to zero as all positions have been XOR'ed out.
  return freeIndexSet == 0;
}
