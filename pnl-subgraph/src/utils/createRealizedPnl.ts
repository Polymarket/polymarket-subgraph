/* eslint-disable @typescript-eslint/ban-types */
import { Address, BigDecimal, BigInt, Bytes } from '@graphprotocol/graph-ts';
import { COLLATERAL_SCALE_DEC } from '../../../common/constants';
import { HistoricalPnl, Price } from '../types/schema';
import { findFPMM } from './findFPMM';

export const createRealizedPnl = (
  timestamp: BigInt,
  evtTxHash: Bytes,
  user: Address,
  tokenID: BigInt,
  amount: BigInt,
): void => {
  if (
    [
      '0x4d97dcd97ec945f40cf65f87097ace5ea0476045',
      '0x4bfb41d5b3570defd03c39a9a4d8de6bd8b8982e',
      '0x78769D50Be1763ed1CA0D5E878D93f05aabff29e',
      '0x3a3bd7bb9528e159577f7c2e685cc81a765002e2',
      '0xa5ef39c3d3e10d0b270233af41cac69796b12966',
      '0xA2bD9CC3e04996Ca683C834E4D86A016f6bbDE5A',
      '0x0000000000000000000000000000000000000000',
    ].includes(user.toHexString()) ||
    findFPMM(user)
  ) {
    return;
  }

  const price = Price.load(tokenID.toString());

  let p: BigDecimal | null = null;
  if (tokenID == BigInt.fromI32(0)) p = BigDecimal.fromString('1');
  if (price) p = price.p;

  if (!p) return;

  let historicalPnl = HistoricalPnl.load(`
    ${evtTxHash.toHexString()}-${user.toHexString()}-${tokenID.toString()}`);

  if (!historicalPnl) {
    historicalPnl = new HistoricalPnl(
      `${evtTxHash.toHexString()}-${user.toHexString()}-${tokenID.toString()}`,
    );
    historicalPnl.realizedPnl = BigDecimal.fromString('0');
  }

  historicalPnl.user = user.toHexString();
  historicalPnl.realizedPnl.plus(
    amount.toBigDecimal().times(p).div(COLLATERAL_SCALE_DEC),
  );
  historicalPnl.date = timestamp;
  historicalPnl.save();
};
