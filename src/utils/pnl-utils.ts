import { MarketProfit } from '../types/schema';
import { bigZero } from './constants';

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
