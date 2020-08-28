import { BigInt, log, Address, EthereumEvent } from '@graphprotocol/graph-ts'

import {
  FixedProductMarketMaker,
  Account,
  FpmmPoolMembership,
  FpmmParticipation,
  FpmmFundingAddition,
  FpmmFundingRemoval,
  MarketPosition,
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
import { updateVolumes, updateLiquidityFields, getCollateralScale, updateFeeFields } from './utils/fpmm-utils';

function requireAccount(accountAddress: string): void {
  let account = Account.load(accountAddress);
  if (account == null) {
    account = new Account(accountAddress);
    account.save();
  }
}

/*
 * Returns the user's position for the given market and outcome
 * If no such position exists then a null position is generated
 */
function getMarketPosition(user: string, market: string, outcomeIndex: BigInt): MarketPosition {
  let positionId = user + market + outcomeIndex.toString()
  let position = MarketPosition.load(positionId);
    if (position == null) {
      position = new MarketPosition(positionId);
      position.market = market;
      position.user = user;
      position.outcomeIndex = outcomeIndex;
      position.totalQuantity = BigInt.fromI32(0);
      position.totalValue = BigInt.fromI32(0);
    }
  return position
}

function updateMarketPosition(event: EthereumEvent): void {
  let transaction = Transaction.load(event.transaction.hash.toHexString());
  if (transaction == null) {
    log.error(
      'Could not find a transaction with hash: {}',
      [event.transaction.hash.toString()],
    );
  }
  
  let position = getMarketPosition(transaction.user, transaction.market, transaction.outcomeIndex)
  position.totalQuantity = transaction.type == "Buy" ? position.totalQuantity.plus(transaction.outcomeTokensAmount) : position.totalQuantity.minus(transaction.outcomeTokensAmount);
  position.totalValue = transaction.type == "Buy" ? position.totalValue.plus(transaction.tradeAmount) : position.totalValue.minus(transaction.tradeAmount);
  position.save()
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
  fpmmFundingAdded.sharesMinted = event.params.sharesMinted;
  fpmmFundingAdded.save();
}

function recordFundingRemoval(event: FPMMFundingRemoved): void {
  let fpmmFundingRemoved = new FpmmFundingRemoval(event.transaction.hash.toHexString());
  fpmmFundingRemoved.timestamp = event.block.timestamp;
  fpmmFundingRemoved.fpmm = event.address.toHexString();
  fpmmFundingRemoved.funder = event.transaction.from.toHexString();
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
  let amountsProduct = BigInt.fromI32(1);
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
  let amountsProduct = BigInt.fromI32(1);
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
  let amountsProduct = BigInt.fromI32(1);
  for(let i = 0; i < newAmounts.length; i++) {
    if (i == outcomeIndex) {
      newAmounts[i] = oldAmounts[i].plus(investmentAmount).minus(event.params.outcomeTokensBought);
    } else {
      newAmounts[i] = oldAmounts[i].plus(investmentAmount);
    }
    amountsProduct = amountsProduct.times(newAmounts[i]);
  }
  fpmm.outcomeTokenAmounts = newAmounts;
  let liquidityParameter = nthRoot(amountsProduct, newAmounts.length);
  let collateralScale = getCollateralScale(fpmm.collateralToken as Address);
  let collateralScaleDec = collateralScale.toBigDecimal();
  updateLiquidityFields(fpmm as FixedProductMarketMaker, liquidityParameter, collateralScaleDec);

  updateVolumes(fpmm as FixedProductMarketMaker, event.block.timestamp, investmentAmount, collateralScale, collateralScaleDec);
  updateFeeFields(fpmm as FixedProductMarketMaker, event.params.feeAmount, collateralScaleDec)
  fpmm.save();

  recordParticipation(fpmmAddress, event.params.buyer.toHexString());
  recordBuy(event);
  updateMarketPosition(event);
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
  let amountsProduct = BigInt.fromI32(1);
  for(let i = 0; i < newAmounts.length; i++) {
    if (i == outcomeIndex) {
      newAmounts[i] = oldAmounts[i].minus(returnAmount).plus(event.params.outcomeTokensSold);
    } else {
      newAmounts[i] = oldAmounts[i].minus(returnAmount);
    }
    amountsProduct = amountsProduct.times(newAmounts[i]);
  }
  fpmm.outcomeTokenAmounts = newAmounts;
  let liquidityParameter = nthRoot(amountsProduct, newAmounts.length);
  let collateralScale = getCollateralScale(fpmm.collateralToken as Address);
  let collateralScaleDec = collateralScale.toBigDecimal();
  updateLiquidityFields(fpmm as FixedProductMarketMaker, liquidityParameter, collateralScaleDec);

  updateVolumes(fpmm as FixedProductMarketMaker, event.block.timestamp, returnAmount, collateralScale, collateralScaleDec);
  updateFeeFields(fpmm as FixedProductMarketMaker, event.params.feeAmount, collateralScaleDec)

  fpmm.save();

  recordParticipation(fpmmAddress, event.params.seller.toHexString());
  recordSell(event);
  updateMarketPosition(event);
}

export function handlePoolShareTransfer(event: Transfer): void {
  let fpmmAddress = event.address.toHexString()

  let fromAddress = event.params.from.toHexString();
  requireAccount(fromAddress);

  let fromMembershipId = fpmmAddress.concat(fromAddress);
  let fromMembership = FpmmPoolMembership.load(fromMembershipId);
  if (fromMembership == null) {
    fromMembership = new FpmmPoolMembership(fromMembershipId);
    fromMembership.pool = fpmmAddress;
    fromMembership.funder = fromAddress;
    fromMembership.amount = event.params.value.neg();
  } else {
    fromMembership.amount = fromMembership.amount.minus(event.params.value);
  }
  fromMembership.save();

  let toAddress = event.params.to.toHexString();
  requireAccount(toAddress);

  let toMembershipId = fpmmAddress.concat(toAddress);
  let toMembership = FpmmPoolMembership.load(toMembershipId);
  if (toMembership == null) {
    toMembership = new FpmmPoolMembership(toMembershipId);
    toMembership.pool = fpmmAddress;
    toMembership.funder = toAddress;
    toMembership.amount = event.params.value;
  } else {
    toMembership.amount = toMembership.amount.plus(event.params.value);
  }
  toMembership.save();
}
