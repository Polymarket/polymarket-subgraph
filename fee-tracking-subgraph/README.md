# Fee Tracking Subgraph

This subgraph tracks fee events from the Polymarket FeeModule contract, monitoring the difference between exchange fees and schedule fees, as well as refunds to ensure users only pay the intended fee amount.

## Purpose

The fee tracking subgraph monitors:
- Exchange fees charged by the underlying exchange
- Schedule fees calculated by our fee formula
- Refunds given to users
- Net fees actually paid by users

This helps ensure the fee system works as intended and provides transparency into fee collection.

## Entities

### FeeEvent
Tracks individual fee events with:
- User who paid the fee
- Exchange fee amount
- Schedule fee amount
- Refund amount
- Net fee amount
- Timestamp and transaction details

### GlobalFeeStats
Aggregate statistics across all fee events:
- Total exchange fees charged
- Total schedule fees
- Total refunds given
- Total net fees collected
- Total number of fee events

### UserFeeStats
Per-user fee statistics:
- User's total exchange fees paid
- User's total schedule fees
- User's total refunds received
- User's total net fees paid
- User's fee event count and last event timestamp

## Usage

Query fee events:
```graphql
{
  feeEvents(first: 10, orderBy: timestamp, orderDirection: desc) {
    user
    exchangeFee
    scheduleFee
    refundAmount
    netFee
    timestamp
  }
}
```

Query global statistics:
```graphql
{
  globalFeeStats(id: "") {
    totalExchangeFees
    totalScheduleFees
    totalRefunds
    totalNetFees
    feeEventCount
  }
}
```

Query user statistics:
```graphql
{
  userFeeStats(id: "0xUserAddress") {
    totalExchangeFees
    totalScheduleFees
    totalRefunds
    totalNetFees
    feeEventCount
    lastFeeEvent
  }
}
```

## Deployment

This subgraph requires:
- FeeModule contract address
- Start block for indexing
- Network configuration

Update the `subgraph.template.yaml` with the correct contract address and start block before deployment. 