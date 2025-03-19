
const MONEYLINE = "moneyline";
const SPREADS = "spreads";
const TOTALS = "totals";

enum GameOrdering {
    HomeVsAway = 0,
    AwayVsHome = 1,
}

enum GameState {
    Created = "Created",
    Settled = "Settled",
    Canceled = "Canceled",
    Paused = "Paused",
    EmergencySettled = "EmergencySettled"
}

enum MarketType {
    Winner = 0,
    Spreads = 1,
    Totals = 2
}


enum MarketState {
    Created = "Created",
    Resolved = "Resolved",
    Paused = "Paused",
    EmergencyResolved = "EmergencyResolved"
}

enum Underdog {
    Home = 0,
    Away = 1
}
