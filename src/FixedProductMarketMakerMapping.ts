import { BigInt, log, Address } from '@graphprotocol/graph-ts'

import {
  FixedProductMarketMaker,
  Account,
  FpmmPoolMembership,
  FpmmParticipation,
  FpmmFundingAddition,
  FpmmFundingRemoval,
  Transaction,
} from "../generated/schema"
import {
  FPMMFundingAdded,
  FPMMFundingRemoved,
  FPMMBuy,
  FPMMSell,
  Transfer,
} from "../generated/templates/FixedProductMarketMaker/FixedProductMarketMaker"
import { nthRoot } from './utils/nth-root';
import { updateVolumes, updateLiquidityFields, getCollateralScale, updateFeeFields, calculatePrices } from './utils/fpmm-utils';
import { updateMarketPositionFromLiquidityAdded, updateMarketPositionFromLiquidityRemoved, updateMarketPositionFromTrade } from './utils/market-positions-utils';
import { bigOne, bigZero } from './utils/constants';

function requireAccount(accountAddress: string): void {
  let account = Account.load(accountAddress);
  if (account == null) {
    account = new Account(accountAddress);
    account.save();
  }
}

function recordBuy(event: FPMMBuy): void {
  let buy = new Transaction(event.transaction.hash.toHexString());
  buy.type = "Buy";
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
  let sell = new Transaction(event.transaction.hash.toHexString());
  sell.type = "Sell";
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
  let fpmmFundingAdded = new FpmmFundingAddition(event.transaction.hash.toHexString());
  fpmmFundingAdded.timestamp = event.block.timestamp;
  fpmmFundingAdded.fpmm = event.address.toHexString();
  fpmmFundingAdded.funder = event.transaction.from.toHexString();
  let amountsAdded = event.params.amountsAdded;
  fpmmFundingAdded.amountsAdded = amountsAdded;

  // The amounts of outcome token are limited by the cheapest outcome.
  // This will have the full balance added to the market maker
  // therefore this is the amount of collateral that the user has split.
  let addedFunds = amountsAdded.slice().sort((a,b)=> a.minus(b).toI32()).pop()

  let amountsRefunded = new Array<BigInt>(amountsAdded.length);
  for (let outcomeIndex = 0; outcomeIndex < amountsAdded.length; outcomeIndex++) {
    // Event emits the number of outcome tokens added to the market maker
    // Subtract this from the amount of collateral added to get the amount refunded to funder
    amountsRefunded[outcomeIndex] = addedFunds.minus(amountsAdded[outcomeIndex])
  }
  fpmmFundingAdded.amountsRefunded = amountsRefunded;
  fpmmFundingAdded.sharesMinted = event.params.sharesMinted;
  fpmmFundingAdded.save();
}

function recordFundingRemoval(event: FPMMFundingRemoved): void {
  let fpmmFundingRemoved = new FpmmFundingRemoval(event.transaction.hash.toHexString());
  fpmmFundingRemoved.timestamp = event.block.timestamp;
  fpmmFundingRemoved.fpmm = event.address.toHexString();
  fpmmFundingRemoved.funder = event.transaction.from.toHexString();
  fpmmFundingRemoved.amountsRemoved = event.params.amountsRemoved;
  fpmmFundingRemoved.collateralRemoved = event.params.collateralRemovedFromFeePool;
  fpmmFundingRemoved.sharesBurnt = event.params.sharesBurnt;
  fpmmFundingRemoved.save();
}

function recordParticipation(fpmmAddress: string, participantAddress: string): void {
  requireAccount(participantAddress);

  let fpmmParticipationId = fpmmAddress.concat(participantAddress);
  let fpmmParticipation = FpmmParticipation.load(fpmmParticipationId);
  if (fpmmParticipation == null) {
    fpmmParticipation = new FpmmParticipation(fpmmParticipationId);
    fpmmParticipation.fpmm = fpmmAddress;
    fpmmParticipation.participant = participantAddress;
    fpmmParticipation.save();
  }
}

export function handleFundingAdded(event: FPMMFundingAdded): void {
  let fpmmAddress = event.address.toHexString();
  let fpmm = FixedProductMarketMaker.load(fpmmAddress);
  if (fpmm == null) {
    log.error('cannot add funding: FixedProductMarketMaker instance for {} not found', [fpmmAddress]);
    return;
  }

  let oldAmounts = fpmm.outcomeTokenAmounts;
  let amountsAdded = event.params.amountsAdded;
  let newAmounts = new Array<BigInt>(oldAmounts.length);
  let amountsProduct = bigOne;
  for(let i = 0; i < newAmounts.length; i++) {
    newAmounts[i] = oldAmounts[i].plus(amountsAdded[i]);
    amountsProduct = amountsProduct.times(newAmounts[i]);
  }
  fpmm.outcomeTokenAmounts = newAmounts;
  let liquidityParameter = nthRoot(amountsProduct, newAmounts.length);
  let collateralScale = getCollateralScale(fpmm.collateralToken as Address);
  updateLiquidityFields(fpmm as FixedProductMarketMaker, liquidityParameter, collateralScale.toBigDecimal());

  fpmm.totalSupply = fpmm.totalSupply.plus(event.params.sharesMinted);
  fpmm.save();
  recordFundingAddition(event)
  updateMarketPositionFromLiquidityAdded(event)
}

export function handleFundingRemoved(event: FPMMFundingRemoved): void {
  let fpmmAddress = event.address.toHexString();
  let fpmm = FixedProductMarketMaker.load(fpmmAddress);
  if (fpmm == null) {
    log.error('cannot remove funding: FixedProductMarketMaker instance for {} not found', [fpmmAddress]);
    return;
  }

  let oldAmounts = fpmm.outcomeTokenAmounts;
  let amountsRemoved = event.params.amountsRemoved;
  let newAmounts = new Array<BigInt>(oldAmounts.length);
  let amountsProduct = bigOne;
  for(let i = 0; i < newAmounts.length; i++) {
    newAmounts[i] = oldAmounts[i].minus(amountsRemoved[i]);
    amountsProduct = amountsProduct.times(newAmounts[i]);
  }
  fpmm.outcomeTokenAmounts = newAmounts;
  
  let liquidityParameter = nthRoot(amountsProduct, newAmounts.length);
  let collateralScale = getCollateralScale(fpmm.collateralToken as Address);
  updateLiquidityFields(fpmm as FixedProductMarketMaker, liquidityParameter, collateralScale.toBigDecimal());
  
  fpmm.totalSupply = fpmm.totalSupply.minus(event.params.sharesBurnt);
  fpmm.save();
  recordFundingRemoval(event)
  updateMarketPositionFromLiquidityRemoved(event)
}

export function handleBuy(event: FPMMBuy): void {
  let fpmmAddress = event.address.toHexString();
  let fpmm = FixedProductMarketMaker.load(fpmmAddress);
  if (fpmm == null) {
    log.error('cannot buy: FixedProductMarketMaker instance for {} not found', [fpmmAddress]);
    return;
  }

  let oldAmounts = fpmm.outcomeTokenAmounts;
  // let investmentAmountMinusFees = event.params.investmentAmount.minus(event.params.feeAmount);
  let investmentAmount = event.params.investmentAmount

  let outcomeIndex = event.params.outcomeIndex.toI32();

  let newAmounts = new Array<BigInt>(oldAmounts.length);
  let amountsProduct = bigOne;
  for(let i = 0; i < newAmounts.length; i++) {
    if (i == outcomeIndex) {
      newAmounts[i] = oldAmounts[i].plus(investmentAmount).minus(event.params.outcomeTokensBought);
    } else {
      newAmounts[i] = oldAmounts[i].plus(investmentAmount);
    }
    amountsProduct = amountsProduct.times(newAmounts[i]);
  }
  fpmm.outcomeTokenAmounts = newAmounts;
  fpmm.outcomeTokenPrices = calculatePrices(newAmounts);
  let liquidityParameter = nthRoot(amountsProduct, newAmounts.length);
  let collateralScale = getCollateralScale(fpmm.collateralToken as Address);
  let collateralScaleDec = collateralScale.toBigDecimal();
  updateLiquidityFields(fpmm as FixedProductMarketMaker, liquidityParameter, collateralScaleDec);

  updateVolumes(fpmm as FixedProductMarketMaker, event.block.timestamp, investmentAmount, collateralScale, collateralScaleDec);
  updateFeeFields(fpmm as FixedProductMarketMaker, event.params.feeAmount, collateralScaleDec)
  fpmm.save();

  recordParticipation(fpmmAddress, event.params.buyer.toHexString());
  recordBuy(event);
  updateMarketPositionFromTrade(event);
}

export function handleSell(event: FPMMSell): void {
  let fpmmAddress = event.address.toHexString()
  let fpmm = FixedProductMarketMaker.load(fpmmAddress);
  if (fpmm == null) {
    log.error('cannot sell: FixedProductMarketMaker instance for {} not found', [fpmmAddress]);
    return;
  }

  let oldAmounts = fpmm.outcomeTokenAmounts;
  // let returnAmountPlusFees = event.params.returnAmount.plus(event.params.feeAmount);
  let returnAmount = event.params.returnAmount;

  let outcomeIndex = event.params.outcomeIndex.toI32();
  let newAmounts = new Array<BigInt>(oldAmounts.length);
  let amountsProduct = bigOne;
  for(let i = 0; i < newAmounts.length; i++) {
    if (i == outcomeIndex) {
      newAmounts[i] = oldAmounts[i].minus(returnAmount).plus(event.params.outcomeTokensSold);
    } else {
      newAmounts[i] = oldAmounts[i].minus(returnAmount);
    }
    amountsProduct = amountsProduct.times(newAmounts[i]);
  }
  fpmm.outcomeTokenAmounts = newAmounts;
  fpmm.outcomeTokenPrices = calculatePrices(newAmounts);
  let liquidityParameter = nthRoot(amountsProduct, newAmounts.length);
  let collateralScale = getCollateralScale(fpmm.collateralToken as Address);
  let collateralScaleDec = collateralScale.toBigDecimal();
  updateLiquidityFields(fpmm as FixedProductMarketMaker, liquidityParameter, collateralScaleDec);

  updateVolumes(fpmm as FixedProductMarketMaker, event.block.timestamp, returnAmount, collateralScale, collateralScaleDec);
  updateFeeFields(fpmm as FixedProductMarketMaker, event.params.feeAmount, collateralScaleDec)

  fpmm.save();

  recordParticipation(fpmmAddress, event.params.seller.toHexString());
  recordSell(event);
  updateMarketPositionFromTrade(event);
}

function loadPoolMembership(fpmmAddress: string, userAddress: string): FpmmPoolMembership {
  let poolMembershipId = fpmmAddress.concat(userAddress);
  let poolMembership = FpmmPoolMembership.load(poolMembershipId);
  if (poolMembership == null) {
    poolMembership = new FpmmPoolMembership(poolMembershipId);
    poolMembership.pool = fpmmAddress;
    poolMembership.funder = userAddress;
    poolMembership.amount = bigZero;
  }
  return poolMembership as FpmmPoolMembership
}

export function handlePoolShareTransfer(event: Transfer): void {
  let fpmmAddress = event.address.toHexString()
  let fromAddress = event.params.from.toHexString();
  let toAddress = event.params.to.toHexString();

  requireAccount(fromAddress);
  requireAccount(toAddress);

  let fromMembership = loadPoolMembership(fpmmAddress, fromAddress);
  fromMembership.amount = fromMembership.amount.minus(event.params.value);
  fromMembership.save();

  let toMembership = loadPoolMembership(fpmmAddress, fromAddress);
  toMembership.amount = toMembership.amount.plus(event.params.value);
  toMembership.save();
}
