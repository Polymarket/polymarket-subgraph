import { BigInt, log } from '@graphprotocol/graph-ts'

import { FixedProductMarketMaker, Account, FpmmPoolMembership } from "../generated/schema"
import {
  FPMMFundingAdded,
  FPMMFundingRemoved,
  FPMMBuy,
  FPMMSell,
  Transfer,
} from "../generated/templates/FixedProductMarketMaker/FixedProductMarketMaker"
import { nthRoot } from './nth-root';
import { timestampToDay, joinDayAndVolume } from './day-volume-utils';

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
  fpmm.liquidityParameter = nthRoot(amountsProduct, newAmounts.length);
  fpmm.save();
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
  fpmm.liquidityParameter = nthRoot(amountsProduct, newAmounts.length);
  fpmm.save();
}

export function handleBuy(event: FPMMBuy): void {
  let fpmmAddress = event.address.toHexString();
  let fpmm = FixedProductMarketMaker.load(fpmmAddress);
  if (fpmm == null) {
    log.error('cannot buy: FixedProductMarketMaker instance for {} not found', [fpmmAddress]);
    return;
  }

  let oldAmounts = fpmm.outcomeTokenAmounts;
  let investmentAmountMinusFees = event.params.investmentAmount.minus(event.params.feeAmount);
  let outcomeIndex = event.params.outcomeIndex.toI32();

  let newAmounts = new Array<BigInt>(oldAmounts.length);
  let amountsProduct = BigInt.fromI32(1);
  for(let i = 0; i < newAmounts.length; i++) {
    if (i == outcomeIndex) {
      newAmounts[i] = oldAmounts[i].plus(investmentAmountMinusFees).minus(event.params.outcomeTokensBought);
    } else {
      newAmounts[i] = oldAmounts[i].plus(investmentAmountMinusFees);
    }
    amountsProduct = amountsProduct.times(newAmounts[i]);
  }
  fpmm.outcomeTokenAmounts = newAmounts;
  fpmm.liquidityParameter = nthRoot(amountsProduct, newAmounts.length);

  let currentDay = timestampToDay(event.block.timestamp);

  if (fpmm.lastActiveDay.notEqual(currentDay)) {
    fpmm.lastActiveDay = currentDay;
    fpmm.collateralVolumeBeforeLastActiveDay = fpmm.collateralVolume;
  }

  fpmm.collateralVolume = fpmm.collateralVolume.plus(investmentAmountMinusFees);
  fpmm.runningDailyVolume = fpmm.collateralVolume.minus(fpmm.collateralVolumeBeforeLastActiveDay);
  fpmm.lastActiveDayAndRunningDailyVolume = joinDayAndVolume(currentDay, fpmm.runningDailyVolume);

  fpmm.save();
}

export function handleSell(event: FPMMSell): void {
  let fpmmAddress = event.address.toHexString()
  let fpmm = FixedProductMarketMaker.load(fpmmAddress);
  if (fpmm == null) {
    log.error('cannot sell: FixedProductMarketMaker instance for {} not found', [fpmmAddress]);
    return;
  }

  let oldAmounts = fpmm.outcomeTokenAmounts;
  let returnAmountPlusFees = event.params.returnAmount.plus(event.params.feeAmount);
  let outcomeIndex = event.params.outcomeIndex.toI32();
  let newAmounts = new Array<BigInt>(oldAmounts.length);
  let amountsProduct = BigInt.fromI32(1);
  for(let i = 0; i < newAmounts.length; i++) {
    if (i == outcomeIndex) {
      newAmounts[i] = oldAmounts[i].minus(returnAmountPlusFees).plus(event.params.outcomeTokensSold);
    } else {
      newAmounts[i] = oldAmounts[i].minus(returnAmountPlusFees);
    }
    amountsProduct = amountsProduct.times(newAmounts[i]);
  }
  fpmm.outcomeTokenAmounts = newAmounts;
  fpmm.liquidityParameter = nthRoot(amountsProduct, newAmounts.length);

  let currentDay = timestampToDay(event.block.timestamp);

  if (fpmm.lastActiveDay.notEqual(currentDay)) {
    fpmm.lastActiveDay = currentDay;
    fpmm.collateralVolumeBeforeLastActiveDay = fpmm.collateralVolume;
  }

  fpmm.collateralVolume = fpmm.collateralVolume.plus(returnAmountPlusFees);
  fpmm.runningDailyVolume = fpmm.collateralVolume.minus(fpmm.collateralVolumeBeforeLastActiveDay);
  fpmm.lastActiveDayAndRunningDailyVolume = joinDayAndVolume(currentDay, fpmm.runningDailyVolume);

  fpmm.save();
}

export function handlePoolShareTransfer(event: Transfer): void {
  let fpmmAddress = event.address.toHexString()

  let fromAddress = event.params.from.toHexString();
  let from = Account.load(fromAddress);
  if (from == null) {
    from = new Account(fromAddress);
    from.save();
  }

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
  let to = Account.load(toAddress);
  if (to == null) {
    to = new Account(toAddress);
    to.save();
  }

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
