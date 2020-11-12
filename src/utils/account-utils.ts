/* eslint-disable no-param-reassign */
import { BigDecimal, BigInt } from '@graphprotocol/graph-ts';
import { Account } from '../types/schema';

import { bigZero } from './constants';

export function requireAccount(accountAddress: string): Account {
  let account = Account.load(accountAddress);
  if (account == null) {
    account = new Account(accountAddress);
    account.collateralVolume = bigZero;
    account.scaledCollateralVolume = bigZero.toBigDecimal();
    account.lastTradedTimestamp = bigZero;
    account.save();
  }
  return account as Account;
}

export function updateUserVolume(
  accountAddress: string,
  tradeAmount: BigInt,
  collateralScaleDec: BigDecimal,
  timestamp: BigInt,
): void {
  let account = requireAccount(accountAddress);
  account.collateralVolume = account.collateralVolume.plus(tradeAmount);
  account.scaledCollateralVolume = account.collateralVolume.divDecimal(
    collateralScaleDec,
  );
  account.lastTradedTimestamp = timestamp;
  account.save();
}
