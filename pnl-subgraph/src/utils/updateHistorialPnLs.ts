/* eslint-disable @typescript-eslint/ban-types */

import { Address, BigInt } from '@graphprotocol/graph-ts';
import { HistoricalPnL } from '../types/schema';

const updateHistorialPnLs = (
  user: Address,
  deltaPnL: BigInt,
  date: BigInt,
): void => {
  const historicalPnLId = `${user.toHexString()}-${date.toString()}`;
  let historicalPnL = HistoricalPnL.load(historicalPnLId);

  if (historicalPnL == null) {
    historicalPnL = new HistoricalPnL(historicalPnLId);
    historicalPnL.user = user.toHexString();
    historicalPnL.realizedPnl = BigInt.zero();
    historicalPnL.date = date;
  }

  historicalPnL.realizedPnl = historicalPnL.realizedPnl.plus(deltaPnL);
  historicalPnL.save();
};

export { updateHistorialPnLs };
