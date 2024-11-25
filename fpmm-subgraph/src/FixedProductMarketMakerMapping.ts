import { BigInt, log } from '@graphprotocol/graph-ts';

import {
  FixedProductMarketMaker,
  FpmmFundingAddition,
  FpmmFundingRemoval,
  FpmmTransaction,
} from './types/schema';
import {
  FPMMFundingAdded,
  FPMMFundingRemoved,
  FPMMBuy,
  FPMMSell,
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
  AddressZero,
  bigOne,
  bigZero,
  TRADE_TYPE_BUY,
  TRADE_TYPE_SELL,
} from './utils/constants';
import { getCollateralScale } from './utils/collateralTokens';
import { increment, max } from './utils/maths';
import { getEventKey } from '../../common/utils/getEventKey';


function recordBuy(event: FPMMBuy): void {
  let buy = new FpmmTransaction(getEventKey(event));
  buy.type = TRADE_TYPE_BUY;
  buy.timestamp = event.block.timestamp;
  buy.market = event.address.toHexString();
  buy.user = event.params.buyer.toHexString();
  buy.tradeAmount = event.params.investmentAmount;
  buy.feeAmount = event.params.feeAmount;
  buy.outcomeIndex = event.params.outcomeIndex;
  buy.outcomeTokensAmount = event.params.outcomeTokensBought;
  buy.save();
}

function recordSell(event: FPMMSell): void {
  let sell = new FpmmTransaction(getEventKey(event));
  sell.type = TRADE_TYPE_SELL;
  sell.timestamp = event.block.timestamp;
  sell.market = event.address.toHexString();
  sell.user = event.params.seller.toHexString();
  sell.tradeAmount = event.params.returnAmount;
  sell.feeAmount = event.params.feeAmount;
  sell.outcomeIndex = event.params.outcomeIndex;
  sell.outcomeTokensAmount = event.params.outcomeTokensSold;
  sell.save();
}

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
  let collateralScale = getCollateralScale(fpmm.collateralToken);
  updateLiquidityFields(
    fpmm as FixedProductMarketMaker,
    liquidityParameter,
    collateralScale.toBigDecimal(),
  );

  fpmm.totalSupply = fpmm.totalSupply.plus(event.params.sharesMinted);
  if (fpmm.totalSupply.equals(event.params.sharesMinted)) {
    // The market maker previously had zero liquidity
    // We then need to update with the initial prices.
    fpmm.outcomeTokenPrices = calculatePrices(newAmounts);
  }

  fpmm.liquidityAddQuantity = increment(fpmm.liquidityAddQuantity);
  fpmm.save();
  recordFundingAddition(event);
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
  let collateralScale = getCollateralScale(fpmm.collateralToken);
  updateLiquidityFields(
    fpmm as FixedProductMarketMaker,
    liquidityParameter,
    collateralScale.toBigDecimal(),
  );

  fpmm.totalSupply = fpmm.totalSupply.minus(event.params.sharesBurnt);
  if (fpmm.totalSupply.equals(bigZero)) {
    // All liquidity has been removed and so prices need to be zeroed out.
    fpmm.outcomeTokenPrices = calculatePrices(newAmounts);
  }

  fpmm.liquidityRemoveQuantity = increment(fpmm.liquidityRemoveQuantity);
  fpmm.save();
  recordFundingRemoval(event);
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
  fpmm.outcomeTokenAmounts = newAmounts;
  fpmm.outcomeTokenPrices = calculatePrices(newAmounts);
  let liquidityParameter = nthRoot(amountsProduct, newAmounts.length);
  let collateralScale = getCollateralScale(fpmm.collateralToken);
  let collateralScaleDec = collateralScale.toBigDecimal();
  updateLiquidityFields(
    fpmm as FixedProductMarketMaker,
    liquidityParameter,
    collateralScaleDec,
  );

  updateVolumes(
    fpmm as FixedProductMarketMaker,
    event.block.timestamp,
    event.params.investmentAmount,
    collateralScaleDec,
    TRADE_TYPE_BUY,
  );
  updateFeeFields(
    fpmm as FixedProductMarketMaker,
    event.params.feeAmount,
    collateralScaleDec,
  );

  fpmm.tradesQuantity = increment(fpmm.tradesQuantity);
  fpmm.buysQuantity = increment(fpmm.buysQuantity);
  fpmm.save();
  recordBuy(event);
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
  let collateralScale = getCollateralScale(fpmm.collateralToken);
  let collateralScaleDec = collateralScale.toBigDecimal();
  updateLiquidityFields(
    fpmm as FixedProductMarketMaker,
    liquidityParameter,
    collateralScaleDec,
  );

  updateVolumes(
    fpmm as FixedProductMarketMaker,
    event.block.timestamp,
    event.params.returnAmount,
    collateralScaleDec,
    TRADE_TYPE_SELL,
  );
  updateFeeFields(
    fpmm as FixedProductMarketMaker,
    event.params.feeAmount,
    collateralScaleDec,
  );

  fpmm.tradesQuantity = increment(fpmm.tradesQuantity);
  fpmm.sellsQuantity = increment(fpmm.sellsQuantity);
  fpmm.save();
  recordSell(event);
}

export function handlePoolShareTransfer(event: Transfer): void {
  let fpmmAddress = event.address.toHexString();
  let fromAddress = event.params.from.toHexString();
  let toAddress = event.params.to.toHexString();
  let sharesAmount = event.params.value;

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
