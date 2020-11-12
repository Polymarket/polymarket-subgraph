/* eslint-disable no-param-reassign */
import { BigInt } from '@graphprotocol/graph-ts';
import { Account } from '../types/schema';

import { bigZero } from './constants';

export function requireAccount(accountAddress: string): Account {
  let account = Account.load(accountAddress);
  if (account == null) {
    account = new Account(accountAddress);
    account.lastTradedTimestamp = bigZero;
    account.save();
  }
  return account as Account;
}

export function markTraded(accountAddress: string, timestamp: BigInt): void {
  let account = requireAccount(accountAddress);
  account.lastTradedTimestamp = timestamp;
  account.save();
}
