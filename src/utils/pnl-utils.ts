import { BigInt } from '@graphprotocol/graph-ts';
import { MarketProfit } from '../types/schema';
import { bigZero } from './constants';

/**
 * Calculates the profit generated by a sell
 * @param avgBuyPrice   - Average buy price
 * @param avgSellPrice  - Average Sell price
 * @param amountSold    - Amount of tokens sold, including fees if any
 * @param fee           - Fees paid
 * @returns
 */
export function calculateProfit(
  avgBuyPrice: BigInt,
  avgSellPrice: BigInt,
  amountSold: BigInt,
  fee: BigInt,
): BigInt {
  return avgSellPrice.minus(avgBuyPrice).times(amountSold).minus(fee);
}

export function loadMarketProfit(
  conditionId: string,
  user: string,
): MarketProfit {
  let key = user + conditionId; // user + conditionId
  let marketProfit = MarketProfit.load(key);
  if (marketProfit == null) {
    marketProfit = new MarketProfit(key);
    marketProfit.user = user;
    marketProfit.condition = conditionId;
    marketProfit.profit = bigZero;
    marketProfit.scaledProfit = bigZero.toBigDecimal();
  }
  return marketProfit as MarketProfit;
}
