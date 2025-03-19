
export const MONEYLINE = "moneyline";
export const SPREADS = "spreads";
export const TOTALS = "totals";

export enum GameOrdering {
    HomeVsAway = 0,
    AwayVsHome = 1,
}


export enum MarketType {
    Winner = 0,
    Spreads = 1,
    Totals = 2
}

export enum Underdog {
    Home = 0,
    Away = 1
}

export const GameStateCreated = "Created";
export const GameStateSettled = "Settled";
export const GameStateCanceled = "Canceled";
export const GameStatePaused = "Paused";
export const GameStateEmergencySettled = "EmergencySettled";

export const MarketStateCreated = "Created";
export const MarketStateResolved = "Resolved";
export const MarketStatePaused = "Paused";
export const MarketStateEmergencyResolved = "EmergencyResolved";
