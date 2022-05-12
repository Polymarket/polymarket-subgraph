import { BigInt } from '@graphprotocol/graph-ts';
import { Global } from '../types/schema';
import { bigZero } from './constants';

export function requireGlobal(): Global {
  let global = Global.load('');
  if (global == null) {
    global = new Global('');
    global.openInterest = bigZero;
  }
  return global as Global;
}

export function updateOpenInterest(
  amount: BigInt,
  isTransferToCT: boolean,
): void {
  let global = requireGlobal();

  if (isTransferToCT) {
    global.openInterest = global.openInterest.plus(amount);
  } else {
    global.openInterest = global.openInterest.minus(amount);
  }
  global.save();
}
