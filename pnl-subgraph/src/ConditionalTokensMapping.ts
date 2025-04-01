import {
  TransferBatch,
  TransferSingle,
} from './types/ConditionalTokens/ConditionalTokens';
import { createRealizedPnl } from './utils/createRealizedPnl';

/**
 * Handles individual OrderFilled events
event TransferSingle(
  address indexed operator,
  address indexed from,
  address indexed to,
  uint256 id,
  uint256 value
);
 * @param event
 */
export function handleTransferSingle(event: TransferSingle): void {
  createRealizedPnl(
    event.block.timestamp,
    event.transaction.hash,
    event.params.from,
    event.params.id,
    event.params.value.neg(),
  );
  createRealizedPnl(
    event.block.timestamp,
    event.transaction.hash,
    event.params.to,
    event.params.id,
    event.params.value,
  );
}

/**
 * Handles individual OrderFilled events
event TransferBatch(
  address indexed operator,
  address indexed from,
  address indexed to,
  uint256[] ids,
  uint256[] values
);
 * @param event
 */
export function handleTransferBatch(event: TransferBatch): void {
  const ids = event.params.ids;
  const values = event.params.values;
  const from = event.params.from;
  const to = event.params.to;

  for (let i = 0; i < ids.length; i++) {
    createRealizedPnl(
      event.block.timestamp,
      event.transaction.hash,
      from,
      ids[i],
      values[i].neg(),
    );
    createRealizedPnl(
      event.block.timestamp,
      event.transaction.hash,
      to,
      ids[i],
      values[i],
    );
  }
}
