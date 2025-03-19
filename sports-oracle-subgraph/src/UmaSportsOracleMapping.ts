import { log, BigInt } from '@graphprotocol/graph-ts';
import {
    GameCreated,
    GameSettled,
    GameEmergencySettled,
    GameCanceled,
    GamePaused,
    GameUnpaused,
    MarketCreated,
    MarketResolved,
    MarketEmergencyResolved,
    MarketPaused,
    MarketUnpaused,
  } from './types/UmaSportsOracle/UmaSportsOracle';
import { Game, Market } from './types/schema';
import { getGameOrdering, getMarketType, getMarketUnderdog } from './utils';
import { 
    GameStateCreated,
    GameStateSettled,
    GameStateCanceled,
    GameStatePaused,
    GameStateEmergencySettled, 
    MarketStateCreated, 
    MarketStateResolved,
    MarketStatePaused,
    MarketStateEmergencyResolved
} from "./constants"

export function handleGameCreated(event: GameCreated): void {
    // new game
    const game = new Game(event.params.gameId.toHexString().toLowerCase());
    game.ancillaryData = event.params.ancillaryData.toHexString();;
    game.ordering = getGameOrdering(event.params.ordering);
    game.state = GameStateCreated;
    game.homeScore = BigInt.zero();
    game.awayScore = BigInt.zero();
    game.save();
}

export function handleGameSettled(event: GameSettled): void {
    const gameId = event.params.gameId.toHexString().toLowerCase();
    // skip unknown gameIds
    const game = Game.load(gameId);
    if (game == null) {
        log.error('Game not found: {}', [
            gameId,
        ]);
        return;
    }
    game.state = GameStateSettled;
    game.homeScore = event.params.home;
    game.awayScore = event.params.away;
    game.save();
}

export function handleGameEmergencySettled(event: GameEmergencySettled): void {
    const gameId = event.params.gameId.toHexString().toLowerCase();
    // skip unknown gameIds
    const game = Game.load(gameId);
    if (game == null) {
        log.error('Game not found: {}', [
            gameId,
        ]);
        return;
    }
    game.state = GameStateEmergencySettled;
    game.homeScore = event.params.home;
    game.awayScore = event.params.away;
    game.save();
}

export function handleGameCanceled(event: GameCanceled): void {
    const gameId = event.params.gameId.toHexString().toLowerCase();
    // skip unknown gameIds
    const game = Game.load(gameId);
    if (game == null) {
        log.error('Game not found: {}', [
            gameId,
        ]);
        return;
    }
    game.state = GameStateCanceled;
    game.save();
}

export function handleGamePaused(event: GamePaused): void {
    const gameId = event.params.gameId.toHexString().toLowerCase();
    // skip unknown gameIds
    const game = Game.load(gameId);
    if (game == null) {
        log.error('Game not found: {}', [
            gameId,
        ]);
        return;
    }
    game.state = GameStatePaused;
    game.save();
}

export function handleGameUnpaused(event: GameUnpaused): void {
    const gameId = event.params.gameId.toHexString().toLowerCase();
    // skip unknown gameIds
    const game = Game.load(gameId);
    if (game == null) {
        log.error('Game not found: {}', [gameId]);
        return;
    }
    game.state = GameStateCreated;
    game.save();
}

export function handleMarketCreated(event: MarketCreated): void {
    // new market
    const market = new Market(event.params.marketId.toHexString().toLowerCase());
    market.gameId = event.params.gameId.toHexString().toLowerCase();
    market.state = MarketStateCreated;
    market.marketType = getMarketType(event.params.marketType);
    market.underdog = getMarketUnderdog(event.params.underdog);
    market.line = event.params.line;
    market.payouts = [];
    market.save()
}

export function handleMarketResolved(event: MarketResolved): void {
    const marketId = event.params.marketId.toHexString().toLowerCase();
    // skip unknown marketId
    const market = Market.load(marketId);
    if (market == null) {
        log.error('market not found: {}', [marketId]);
        return;
    }

    market.state = MarketStateResolved;
    market.payouts = event.params.payouts;
    market.save();
}

export function handleMarketEmergencyResolved(event: MarketEmergencyResolved): void {
    const marketId = event.params.marketId.toHexString().toLowerCase();
    // skip unknown marketId
    const market = Market.load(marketId);
    if (market == null) {
        log.error('market not found: {}', [marketId]);
        return;
    }

    market.state = MarketStateEmergencyResolved;
    market.payouts = event.params.payouts;
    market.save();
}

export function handleMarketPaused(event: MarketPaused): void {
    const marketId = event.params.marketId.toHexString().toLowerCase();
    // skip unknown marketId
    const market = Market.load(marketId);
    if (market == null) {
        log.error('market not found: {}', [marketId]);
        return;
    }

    market.state = MarketStatePaused;
    market.save();
}

export function handleMarketUnpaused(event: MarketUnpaused): void {
    const marketId = event.params.marketId.toHexString().toLowerCase();
    // skip unknown marketId
    const market = Market.load(marketId);
    if (market == null) {
        log.error('market not found: {}', [marketId]);
        return;
    }

    market.state = MarketStateCreated;
    market.save();
}


