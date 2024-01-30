/* eslint-disable @typescript-eslint/ban-types */

import { BigInt, log } from '@graphprotocol/graph-ts';

import {
  FixedProductMarketMaker,
  FpmmFundingAddition,
  FpmmFundingRemoval,
} from './types/schema';
import {
  FPMMBuy,
  FPMMSell,
  FPMMFundingAdded,
  FPMMFundingRemoved,
  Transfer,
} from './types/templates/FixedProductMarketMaker/FixedProductMarketMaker';
import { nthRoot } from './utils/nth-root';
import {
  updateVolumes,
  updateLiquidityFields,
  updateFeeFields,
  calculatePrices,
  loadPoolMembership,
} from './utils/fpmm-utils';
import {
  updateMarketPositionFromFPMMBuy,
  updateMarketPositionFromFPMMSell,
  updateMarketPositionFromLiquidityAdded,
  updateMarketPositionFromLiquidityRemoved,
} from './utils/market-positions-utils';

import {
  AddressZero,
  bigOne,
  bigZero,
  TRADE_TYPE_BUY,
  TRADE_TYPE_SELL,
} from './utils/constants';
import { updateGlobalVolume } from './utils/global-utils';
import { increment, max } from './utils/maths';
import {
  incrementAccountTrades,
  markAccountAsSeen,
  requireAccount,
  updateUserVolume,
} from './utils/account-utils';

function recordFundingAddition(event: FPMMFundingAdded): void {
  let fpmmFundingAdded = new FpmmFundingAddition(
    event.transaction.hash.toHexString(),
  );
  fpmmFundingAdded.timestamp = event.block.timestamp;
  fpmmFundingAdded.fpmm = event.address.toHexString();
  fpmmFundingAdded.funder = event.params.funder.toHexString();
  let amountsAdded = event.params.amountsAdded;
  fpmmFundingAdded.amountsAdded = amountsAdded;

  // The amounts of outcome token are limited by the cheapest outcome.
  // This will have the full balance added to the market maker
  // therefore this is the amount of collateral that the user has split.
  let addedFunds = max(amountsAdded);

  let amountsRefunded = new Array<BigInt>(amountsAdded.length);
  for (
    let outcomeIndex = 0;
    outcomeIndex < amountsAdded.length;
    outcomeIndex += 1
  ) {
    // Event emits the number of outcome tokens added to the market maker
    // Subtract this from the amount of collateral added to get the amount refunded to funder
    amountsRefunded[outcomeIndex] = addedFunds.minus(
      amountsAdded[outcomeIndex],
    );
  }
  fpmmFundingAdded.amountsRefunded = amountsRefunded;
  fpmmFundingAdded.sharesMinted = event.params.sharesMinted;
  fpmmFundingAdded.save();
}

function recordFundingRemoval(event: FPMMFundingRemoved): void {
  let fpmmFundingRemoved = new FpmmFundingRemoval(
    event.transaction.hash.toHexString(),
  );
  fpmmFundingRemoved.timestamp = event.block.timestamp;
  fpmmFundingRemoved.fpmm = event.address.toHexString();
  fpmmFundingRemoved.funder = event.params.funder.toHexString();
  fpmmFundingRemoved.amountsRemoved = event.params.amountsRemoved;
  fpmmFundingRemoved.collateralRemoved =
    event.params.collateralRemovedFromFeePool;
  fpmmFundingRemoved.sharesBurnt = event.params.sharesBurnt;
  fpmmFundingRemoved.save();
}

export function handleFundingAdded(event: FPMMFundingAdded): void {
  let fpmmAddress = event.address.toHexString();
  let fpmm = FixedProductMarketMaker.load(fpmmAddress);
  if (fpmm == null) {
    log.error(
      'cannot add funding: FixedProductMarketMaker instance for {} not found',
      [fpmmAddress],
    );
    return;
  }

  let oldAmounts = fpmm.outcomeTokenAmounts;
  let amountsAdded = event.params.amountsAdded;
  let newAmounts = new Array<BigInt>(oldAmounts.length);
  let amountsProduct = bigOne;
  for (let i = 0; i < newAmounts.length; i += 1) {
    newAmounts[i] = oldAmounts[i].plus(amountsAdded[i]);
    amountsProduct = amountsProduct.times(newAmounts[i]);
  }
  fpmm.outcomeTokenAmounts = newAmounts;
  let liquidityParameter = nthRoot(amountsProduct, newAmounts.length);
  updateLiquidityFields(fpmm as FixedProductMarketMaker, liquidityParameter);

  fpmm.totalSupply = fpmm.totalSupply.plus(event.params.sharesMinted);
  if (fpmm.totalSupply.equals(event.params.sharesMinted)) {
    // The market maker previously had zero liquidity
    // We then need to update with the initial prices.
    fpmm.outcomeTokenPrices = calculatePrices(newAmounts);
  }

  fpmm.liquidityAddQuantity = increment(fpmm.liquidityAddQuantity);
  fpmm.save();
  markAccountAsSeen(event.params.funder.toHexString(), event.block.timestamp);
  recordFundingAddition(event);
  updateMarketPositionFromLiquidityAdded(event);
}

export function handleFundingRemoved(event: FPMMFundingRemoved): void {
  let fpmmAddress = event.address.toHexString();
  let fpmm = FixedProductMarketMaker.load(fpmmAddress);
  if (fpmm == null) {
    log.error(
      'cannot remove funding: FixedProductMarketMaker instance for {} not found',
      [fpmmAddress],
    );
    return;
  }

  let oldAmounts = fpmm.outcomeTokenAmounts;
  let amountsRemoved = event.params.amountsRemoved;
  let newAmounts = new Array<BigInt>(oldAmounts.length);
  let amountsProduct = bigOne;
  for (let i = 0; i < newAmounts.length; i += 1) {
    newAmounts[i] = oldAmounts[i].minus(amountsRemoved[i]);
    amountsProduct = amountsProduct.times(newAmounts[i]);
  }
  fpmm.outcomeTokenAmounts = newAmounts;

  let liquidityParameter = nthRoot(amountsProduct, newAmounts.length);
  updateLiquidityFields(fpmm as FixedProductMarketMaker, liquidityParameter);

  fpmm.totalSupply = fpmm.totalSupply.minus(event.params.sharesBurnt);
  if (fpmm.totalSupply.equals(bigZero)) {
    // All liquidity has been removed and so prices need to be zeroed out.
    fpmm.outcomeTokenPrices = calculatePrices(newAmounts);
  }

  fpmm.liquidityRemoveQuantity = increment(fpmm.liquidityRemoveQuantity);
  fpmm.save();
  markAccountAsSeen(event.params.funder.toHexString(), event.block.timestamp);
  recordFundingRemoval(event);
  updateMarketPositionFromLiquidityRemoved(event);
}

export function handleBuy(event: FPMMBuy): void {
  let fpmmAddress = event.address.toHexString();
  let fpmm = FixedProductMarketMaker.load(fpmmAddress);
  if (fpmm == null) {
    log.error('cannot buy: FixedProductMarketMaker instance for {} not found', [
      fpmmAddress,
    ]);
    return;
  }

  let oldAmounts = fpmm.outcomeTokenAmounts;
  let investmentAmountMinusFees = event.params.investmentAmount.minus(
    event.params.feeAmount,
  );

  let outcomeIndex = event.params.outcomeIndex.toI32();

  let newAmounts = new Array<BigInt>(oldAmounts.length);
  let amountsProduct = bigOne;
  for (let i = 0; i < newAmounts.length; i += 1) {
    if (i == outcomeIndex) {
      newAmounts[i] = oldAmounts[i]
        .plus(investmentAmountMinusFees)
        .minus(event.params.outcomeTokensBought);
    } else {
      newAmounts[i] = oldAmounts[i].plus(investmentAmountMinusFees);
    }
    amountsProduct = amountsProduct.times(newAmounts[i]);
  }

  // UPDATE FPMM AMOUNTS
  fpmm.outcomeTokenAmounts = newAmounts;
  // UPDATE FPMM PRICES FROM NEW AMOUNTS
  fpmm.outcomeTokenPrices = calculatePrices(newAmounts);

  // CONSTANT (?)
  let liquidityParameter = nthRoot(amountsProduct, newAmounts.length);
  // UPDATE LIQ FIELDS
  updateLiquidityFields(fpmm as FixedProductMarketMaker, liquidityParameter);

  // UPDATE VOLUMES
  updateVolumes(
    fpmm as FixedProductMarketMaker,
    event.block.timestamp,
    event.params.investmentAmount,
    TRADE_TYPE_BUY,
  );

  // UPDATE FEE FIELDS
  updateFeeFields(fpmm as FixedProductMarketMaker, event.params.feeAmount);

  // SAVE FPMM
  fpmm.tradesQuantity = increment(fpmm.tradesQuantity);
  fpmm.buysQuantity = increment(fpmm.buysQuantity);
  fpmm.save();

  // UPDATE USER VOLUME
  updateUserVolume(
    event.params.buyer.toHexString(),
    event.params.investmentAmount,
    event.block.timestamp,
  );
  // MARK ACCOUNT AS SEEN
  markAccountAsSeen(event.params.buyer.toHexString(), event.block.timestamp);
  incrementAccountTrades(
    event.params.buyer.toHexString(),
    event.block.timestamp,
  );

  // UPDATE GLOBAL VOLUME
  updateGlobalVolume(
    event.params.investmentAmount,
    event.params.feeAmount,
    TRADE_TYPE_BUY,
  );

  // UPDATE MARKET POSITION
  const conditionId = fpmm.conditions[0];
  updateMarketPositionFromFPMMBuy(event, conditionId);
}

export function handleSell(event: FPMMSell): void {
  let fpmmAddress = event.address.toHexString();
  let fpmm = FixedProductMarketMaker.load(fpmmAddress);
  if (fpmm == null) {
    log.error(
      'cannot sell: FixedProductMarketMaker instance for {} not found',
      [fpmmAddress],
    );
    return;
  }

  let oldAmounts = fpmm.outcomeTokenAmounts;
  let returnAmountPlusFees = event.params.returnAmount.plus(
    event.params.feeAmount,
  );

  let outcomeIndex = event.params.outcomeIndex.toI32();
  let newAmounts = new Array<BigInt>(oldAmounts.length);
  let amountsProduct = bigOne;
  for (let i = 0; i < newAmounts.length; i += 1) {
    if (i == outcomeIndex) {
      newAmounts[i] = oldAmounts[i]
        .minus(returnAmountPlusFees)
        .plus(event.params.outcomeTokensSold);
    } else {
      newAmounts[i] = oldAmounts[i].minus(returnAmountPlusFees);
    }
    amountsProduct = amountsProduct.times(newAmounts[i]);
  }
  fpmm.outcomeTokenAmounts = newAmounts;
  fpmm.outcomeTokenPrices = calculatePrices(newAmounts);
  let liquidityParameter = nthRoot(amountsProduct, newAmounts.length);
  updateLiquidityFields(fpmm as FixedProductMarketMaker, liquidityParameter);

  updateVolumes(
    fpmm as FixedProductMarketMaker,
    event.block.timestamp,
    event.params.returnAmount,
    TRADE_TYPE_SELL,
  );
  updateFeeFields(fpmm as FixedProductMarketMaker, event.params.feeAmount);

  fpmm.tradesQuantity = increment(fpmm.tradesQuantity);
  fpmm.sellsQuantity = increment(fpmm.sellsQuantity);
  fpmm.save();

  updateUserVolume(
    event.params.seller.toHexString(),
    event.params.returnAmount,
    event.block.timestamp,
  );
  markAccountAsSeen(event.params.seller.toHexString(), event.block.timestamp);
  incrementAccountTrades(
    event.params.seller.toHexString(),
    event.block.timestamp,
  );

  updateGlobalVolume(
    event.params.returnAmount,
    event.params.feeAmount,
    TRADE_TYPE_SELL,
  );

  const conditionId = fpmm.conditions[0];
  updateMarketPositionFromFPMMSell(event, conditionId);
}

export function handlePoolShareTransfer(event: Transfer): void {
  let fpmmAddress = event.address.toHexString();
  let fromAddress = event.params.from.toHexString();
  let toAddress = event.params.to.toHexString();
  let sharesAmount = event.params.value;

  requireAccount(fromAddress, event.block.timestamp);
  requireAccount(toAddress, event.block.timestamp);

  if (fromAddress != AddressZero) {
    let fromMembership = loadPoolMembership(fpmmAddress, fromAddress);
    fromMembership.amount = fromMembership.amount.minus(sharesAmount);
    fromMembership.save();
  }

  if (toAddress != AddressZero) {
    let toMembership = loadPoolMembership(fpmmAddress, toAddress);
    toMembership.amount = toMembership.amount.plus(sharesAmount);
    toMembership.save();
  }
}
