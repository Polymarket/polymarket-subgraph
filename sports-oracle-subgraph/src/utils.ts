import { MONEYLINE, SPREADS,TOTALS, MarketType, GameOrdering, Underdog } from "./constants"

// @ts-expect-error Cannot find name 'i32'.
export function getMarketType(marketTypeEnum: i32): string {
    if (marketTypeEnum == MarketType.Winner) {
        return MONEYLINE;
    } else if (marketTypeEnum == MarketType.Spreads) {
        return SPREADS;
    } else {
        return TOTALS;
    }
}

// @ts-expect-error Cannot find name 'i32'.
export function getGameOrdering(gameOrderingEnum: i32): string {
    if(gameOrderingEnum == GameOrdering.HomeVsAway) {
        return "home"
    } else {
        return "away"
    }
}

// @ts-expect-error Cannot find name 'i32'.
export function getMarketUnderdog(underdogEnum: i32): string {
    if (underdogEnum == Underdog.Home) {
        return "home";
    }
    return "away";
}