import { BigInt } from '@graphprotocol/graph-ts';
import { FeeCharged } from '../types/FeeModule/FeeModule';
import { FeeEvent, GlobalFeeStats, UserFeeStats } from '../types/schema';

function getGlobalFeeStats(): GlobalFeeStats {
  let globalStats = GlobalFeeStats.load('');
  if (globalStats == null) {
    globalStats = new GlobalFeeStats('');
    globalStats.totalExchangeFees = BigInt.fromI32(0);
    globalStats.totalScheduleFees = BigInt.fromI32(0);
    globalStats.totalRefunds = BigInt.fromI32(0);
    globalStats.totalNetFees = BigInt.fromI32(0);
    globalStats.feeEventCount = BigInt.fromI32(0);
  }
  return globalStats;
}

function getUserFeeStats(userAddress: string): UserFeeStats {
  let userStats = UserFeeStats.load(userAddress);
  if (userStats == null) {
    userStats = new UserFeeStats(userAddress);
    userStats.totalExchangeFees = BigInt.fromI32(0);
    userStats.totalScheduleFees = BigInt.fromI32(0);
    userStats.totalRefunds = BigInt.fromI32(0);
    userStats.totalNetFees = BigInt.fromI32(0);
    userStats.feeEventCount = BigInt.fromI32(0);
    userStats.lastFeeEvent = BigInt.fromI32(0);
  }
  return userStats;
}

export function handleFeeCharged(event: FeeCharged): void {
  // Extract event parameters
  const user = event.params.user.toHexString();
  const exchangeFee = event.params.exchangeFee;
  const scheduleFee = event.params.scheduleFee;
  const refundAmount = event.params.refundAmount;
  const netFee = event.params.netFee;
  
  // Create unique ID for the fee event
  const eventId = event.transaction.hash.toHexString() + '-' + event.logIndex.toString();
  
  // Create FeeEvent entity
  const feeEvent = new FeeEvent(eventId);
  feeEvent.user = user;
  feeEvent.exchangeFee = exchangeFee;
  feeEvent.scheduleFee = scheduleFee;
  feeEvent.refundAmount = refundAmount;
  feeEvent.netFee = netFee;
  feeEvent.timestamp = event.block.timestamp;
  feeEvent.txHash = event.transaction.hash.toHexString();
  feeEvent.blockNumber = event.block.number;
  feeEvent.save();
  
  // Update global fee statistics
  const globalStats = getGlobalFeeStats();
  globalStats.totalExchangeFees = globalStats.totalExchangeFees.plus(exchangeFee);
  globalStats.totalScheduleFees = globalStats.totalScheduleFees.plus(scheduleFee);
  globalStats.totalRefunds = globalStats.totalRefunds.plus(refundAmount);
  globalStats.totalNetFees = globalStats.totalNetFees.plus(netFee);
  globalStats.feeEventCount = globalStats.feeEventCount.plus(BigInt.fromI32(1));
  globalStats.save();
  
  // Update user fee statistics
  const userStats = getUserFeeStats(user);
  userStats.totalExchangeFees = userStats.totalExchangeFees.plus(exchangeFee);
  userStats.totalScheduleFees = userStats.totalScheduleFees.plus(scheduleFee);
  userStats.totalRefunds = userStats.totalRefunds.plus(refundAmount);
  userStats.totalNetFees = userStats.totalNetFees.plus(netFee);
  userStats.feeEventCount = userStats.feeEventCount.plus(BigInt.fromI32(1));
  userStats.lastFeeEvent = event.block.timestamp;
  userStats.save();
} 