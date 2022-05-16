/* eslint-disable no-param-reassign */
import { BigDecimal, BigInt } from '@graphprotocol/graph-ts';
import { Account } from '../types/schema';

import { bigOne, bigZero } from './constants';
import { loadMarketProfitPerAccount } from './fpmm-utils';
import { countNewTrader } from './global-utils';

export function requireAccount(
  accountAddress: string,
  timestamp: BigInt,
): Account {
  let account = Account.load(accountAddress);
  if (account == null) {
    account = new Account(accountAddress);
    account.collateralVolume = bigZero;
    account.scaledCollateralVolume = bigZero.toBigDecimal();
    account.lastTradedTimestamp = bigZero;
    account.numTrades = bigZero;
    account.creationTimestamp = timestamp;
    account.lastSeenTimestamp = timestamp;
    account.profit = bigZero.toBigDecimal();
    countNewTrader();
    account.save();
  }
  return account as Account;
}

/**
 * Updates the "last seen" timestamp on an Account.
 * @dev This function should be called once on each interaction with a market maker or conditional tokens contract
 * @param accountAddress - Address of account to mark as "seen"
 * @param timestamp - Timestamp at which interaction occurred
 */
export function markAccountAsSeen(
  accountAddress: string,
  timestamp: BigInt,
): void {
  let account = requireAccount(accountAddress, timestamp);
  account.lastSeenTimestamp = timestamp;
  account.save();
}

/**
 * Updates the "last seen" timestamp on an Account.
 * @dev This function should be called once on each interaction with a market maker or conditional tokens contract
 * @param accountAddress - Address of account to mark as "seen"
 * @param timestamp - Timestamp at which interaction occurred
 */
export function incrementAccountTrades(
  accountAddress: string,
  timestamp: BigInt,
): void {
  let account = requireAccount(accountAddress, timestamp);
  account.numTrades = account.numTrades.plus(bigOne);
  account.save();
}

export function updateUserVolume(
  accountAddress: string,
  tradeAmount: BigInt,
  collateralScaleDec: BigDecimal,
  timestamp: BigInt,
): void {
  let account = requireAccount(accountAddress, timestamp);
  account.collateralVolume = account.collateralVolume.plus(tradeAmount);
  account.scaledCollateralVolume = account.collateralVolume.divDecimal(
    collateralScaleDec,
  );
  account.lastTradedTimestamp = timestamp;
  account.save();
}

export function updateUserProfit(
  accountAddress: string,
  pnl: BigDecimal,
  timestamp: BigInt,
  fpmmAddress: string,
): void {
  let account = requireAccount(accountAddress, timestamp);

  account.profit = account.profit.plus(pnl);
  account.save();
  let fpmmProfit = loadMarketProfitPerAccount(fpmmAddress, accountAddress);
  fpmmProfit.amount = fpmmProfit.amount.plus(pnl);
  fpmmProfit.save();

}
