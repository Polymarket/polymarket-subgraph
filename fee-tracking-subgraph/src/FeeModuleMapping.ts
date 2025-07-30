import { BigInt } from '@graphprotocol/graph-ts';
import { FeeRefunded, FeeWithdrawn } from '../types/FeeModule/FeeModule';
import { FeeRefund, FeeWithdrawal, GlobalFeeStats, UserFeeStats } from '../types/schema';

function getGlobalFeeStats(): GlobalFeeStats {
  let globalStats = GlobalFeeStats.load('');
  if (globalStats == null) {
    globalStats = new GlobalFeeStats('');
    globalStats.totalRefunds = BigInt.fromI32(0);
    globalStats.totalWithdrawals = BigInt.fromI32(0);
    globalStats.refundEventCount = BigInt.fromI32(0);
    globalStats.withdrawalEventCount = BigInt.fromI32(0);
  }
  return globalStats;
}

function getUserFeeStats(userAddress: string): UserFeeStats {
  let userStats = UserFeeStats.load(userAddress);
  if (userStats == null) {
    userStats = new UserFeeStats(userAddress);
    userStats.totalRefunds = BigInt.fromI32(0);
    userStats.totalWithdrawals = BigInt.fromI32(0);
    userStats.refundEventCount = BigInt.fromI32(0);
    userStats.withdrawalEventCount = BigInt.fromI32(0);
    userStats.lastRefundEvent = BigInt.fromI32(0);
    userStats.lastWithdrawalEvent = BigInt.fromI32(0);
  }
  return userStats;
}

export function handleFeeRefunded(event: FeeRefunded): void {
  // Extract event parameters
  const orderHash = event.params.orderHash.toHexString();
  const maker = event.params.maker.toHexString();
  const tokenId = event.params.id;
  const refundAmount = event.params.refund;
  const feeAmount = event.params.feeAmount;
  
  // Create unique ID for the fee refund event
  const eventId = event.transaction.hash.toHexString() + '-' + event.logIndex.toString();
  
  // Create FeeRefund entity
  const feeRefund = new FeeRefund(eventId);
  feeRefund.orderHash = orderHash;
  feeRefund.maker = maker;
  feeRefund.tokenId = tokenId;
  feeRefund.refundAmount = refundAmount;
  feeRefund.feeAmount = feeAmount;
  feeRefund.timestamp = event.block.timestamp;
  feeRefund.txHash = event.transaction.hash.toHexString();
  feeRefund.blockNumber = event.block.number;
  feeRefund.save();
  
  // Update global fee statistics
  const globalStats = getGlobalFeeStats();
  globalStats.totalRefunds = globalStats.totalRefunds.plus(refundAmount);
  globalStats.refundEventCount = globalStats.refundEventCount.plus(BigInt.fromI32(1));
  globalStats.save();
  
  // Update user fee statistics
  const userStats = getUserFeeStats(maker);
  userStats.totalRefunds = userStats.totalRefunds.plus(refundAmount);
  userStats.refundEventCount = userStats.refundEventCount.plus(BigInt.fromI32(1));
  userStats.lastRefundEvent = event.block.timestamp;
  userStats.save();
}

export function handleFeeWithdrawn(event: FeeWithdrawn): void {
  // Extract event parameters
  const token = event.params.token.toHexString();
  const to = event.params.to.toHexString();
  const tokenId = event.params.id;
  const amount = event.params.amount;
  
  // Create unique ID for the fee withdrawal event
  const eventId = event.transaction.hash.toHexString() + '-' + event.logIndex.toString();
  
  // Create FeeWithdrawal entity
  const feeWithdrawal = new FeeWithdrawal(eventId);
  feeWithdrawal.token = token;
  feeWithdrawal.to = to;
  feeWithdrawal.tokenId = tokenId;
  feeWithdrawal.amount = amount;
  feeWithdrawal.timestamp = event.block.timestamp;
  feeWithdrawal.txHash = event.transaction.hash.toHexString();
  feeWithdrawal.blockNumber = event.block.number;
  feeWithdrawal.save();
  
  // Update global fee statistics
  const globalStats = getGlobalFeeStats();
  globalStats.totalWithdrawals = globalStats.totalWithdrawals.plus(amount);
  globalStats.withdrawalEventCount = globalStats.withdrawalEventCount.plus(BigInt.fromI32(1));
  globalStats.save();
  
  // Update user fee statistics
  const userStats = getUserFeeStats(to);
  userStats.totalWithdrawals = userStats.totalWithdrawals.plus(amount);
  userStats.withdrawalEventCount = userStats.withdrawalEventCount.plus(BigInt.fromI32(1));
  userStats.lastWithdrawalEvent = event.block.timestamp;
  userStats.save();
} 