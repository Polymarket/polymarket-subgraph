import { log } from '@graphprotocol/graph-ts';
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
// import { getEventKey } from '../../common/utils/getEventKey';
import { Game, Market } from './types/schema';
import { getGameOrdering, getMarketType, getMarketUnderdog } from './utils';

export function handleGameCreated(event: GameCreated): void {
    // new game
    const game = new Game(event.params.gameId.toHexString().toLowerCase());
    game.ancillaryData = event.params.ancillaryData.toHexString();;
    game.ordering = getGameOrdering(event.params.ordering);
    game.state = GameState.Created;
    game.homeScore =0;
    game.awayScore =0;
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
    game.state = GameState.Settled;
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
    game.state = GameState.EmergencySettled;
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
    game.state = GameState.Canceled;
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
    game.state = GameState.Paused;
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
    game.state = GameState.Created;
    game.save();
}

export function handleMarketCreated(event: MarketCreated): void {
    // new market
    const market = new Market(event.params.marketId.toHexString().toLowerCase());
    market.gameId = event.params.gameId.toHexString().toLowerCase();
    market.state = MarketState.Created;
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

    market.state = MarketState.Resolved;
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

    market.state = MarketState.EmergencyResolved;
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

    market.state = MarketState.Paused;
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

    market.state = MarketState.Created;
    market.save();
}


