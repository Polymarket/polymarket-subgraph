/* eslint-disable @typescript-eslint/ban-types */
import { BigInt } from '@graphprotocol/graph-ts';
import { MarketOpenInterest, GlobalOpenInterest } from './types/schema';

function getMarketOpenInterest(condition: string): MarketOpenInterest {
  let oi = MarketOpenInterest.load(condition);
  if (oi == null) {
    oi = new MarketOpenInterest(condition);
    oi.amount = BigInt.fromI32(0);
  }
  return oi as MarketOpenInterest;
}

function getGlobalOpenInterest(): GlobalOpenInterest {
  let oi = GlobalOpenInterest.load('');
  if (oi == null) {
    oi = new GlobalOpenInterest('');
    oi.amount = BigInt.fromI32(0);
  }
  return oi as GlobalOpenInterest;
}

export function updateGlobalOpenInterest(amount: BigInt, updatedAt: BigInt): void {
  let globaloi = getGlobalOpenInterest();
  globaloi.amount = globaloi.amount.plus(amount);
  globaloi.updatedAt = updatedAt;
  globaloi.save();
}

export function updateMarketOpenInterest(
  condition: string,
  amount: BigInt,
  updatedAt: BigInt,
): void {
  let mktoi = getMarketOpenInterest(condition);
  mktoi.amount = mktoi.amount.plus(amount);
  mktoi.updatedAt = updatedAt;
  mktoi.save();
}

export function updateOpenInterest(condition: string, amount: BigInt, updatedAt: BigInt): void {
  // Update OI for the market
  updateMarketOpenInterest(condition, amount, updatedAt);

  // Update Global OI
  updateGlobalOpenInterest(amount, updatedAt);
}
