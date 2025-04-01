import { BigInt } from '@graphprotocol/graph-ts';
import { CONDITIONAL_TOKENS, USDC } from '../../common/constants';
import { Transfer } from './types/templates/ERC20Detailed/ERC20Detailed';
import { createRealizedPnl } from './utils/createRealizedPnl';
import { findFPMM } from './utils/findFPMM';

export function handleTransfer(event: Transfer): void {
  if (
    event.address == USDC &&
    (event.params.from == CONDITIONAL_TOKENS ||
      event.params.to == CONDITIONAL_TOKENS ||
      findFPMM(event.params.from) ||
      findFPMM(event.params.to))
  ) {
    createRealizedPnl(
      event.block.timestamp,
      event.transaction.hash,
      event.params.from,
      BigInt.fromI32(0),
      event.params.value.neg(),
    );
    createRealizedPnl(
      event.block.timestamp,
      event.transaction.hash,
      event.params.to,
      BigInt.fromI32(0),
      event.params.value,
    );
  }
}
