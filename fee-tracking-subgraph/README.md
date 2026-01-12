# Fee Tracking Subgraph

This subgraph tracks fee events from the Polymarket FeeModule contract, monitoring fee refunds and withdrawals to ensure transparency in the fee system.

## Purpose

The fee tracking subgraph monitors:
- Fee refunds given to users when the actual fee charged is higher than the intended fee
- Fee withdrawals by administrators
- Per-user fee statistics and global fee statistics

This helps ensure the fee system works as intended and provides transparency into fee collection and refunds.

## Entities

### FeeRefund
Tracks individual fee refund events with:
- Order hash that triggered the refund
- Maker address who received the refund
- Token ID (0 for collateral, otherwise CTF token ID)
- Refund amount
- Original fee amount charged
- Timestamp and transaction details

### FeeWithdrawal
Tracks fee withdrawal events with:
- Token address
- Recipient address
- Token ID (0 for collateral, otherwise CTF token ID)
- Amount withdrawn
- Timestamp and transaction details

### GlobalFeeStats
Aggregate statistics across all fee events:
- Total refunds given
- Total fees withdrawn
- Number of refund events
- Number of withdrawal events

### UserFeeStats
Per-user fee statistics:
- User's total refunds received
- User's total withdrawals
- User's refund event count
- User's withdrawal event count
- Last refund and withdrawal event timestamps

## Usage

Query fee refunds:
```graphql
{
  feeRefunds(first: 10, orderBy: timestamp, orderDirection: desc) {
    orderHash
    maker
    tokenId
    refundAmount
    feeAmount
    timestamp
  }
}
```

Query fee withdrawals:
```graphql
{
  feeWithdrawals(first: 10, orderBy: timestamp, orderDirection: desc) {
    token
    to
    tokenId
    amount
    timestamp
  }
}
```

Query global statistics:
```graphql
{
  globalFeeStats(id: "") {
    totalRefunds
    totalWithdrawals
    refundEventCount
    withdrawalEventCount
  }
}
```

Query user statistics:
```graphql
{
  userFeeStats(id: "0xUserAddress") {
    totalRefunds
    totalWithdrawals
    refundEventCount
    withdrawalEventCount
    lastRefundEvent
    lastWithdrawalEvent
  }
}
```

## Deployment

This subgraph requires:
- FeeModule contract address
- Start block for indexing
- Network configuration

Update the `subgraph.template.yaml` with the correct contract address and start block before deployment. 