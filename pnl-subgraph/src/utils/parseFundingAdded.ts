/* eslint-disable @typescript-eslint/ban-types */

import { BigInt } from '@graphprotocol/graph-ts';
import { computeFpmmPrice } from './computeFpmmPrice';
import { FPMMFundingAdded } from '../types/templates/FixedProductMarketMaker/FixedProductMarketMaker';

class RefundDetails {
  // @ts-expect-error: Cannot find name 'u8'.
  outcomeIndex: u8;

  price: BigInt;

  amount: BigInt;
}

// the taker is always the exchange!
const parseFundingAddedRefundDetails = (
  event: FPMMFundingAdded,
): RefundDetails => {
  // refunded index is the _smaller_ value
  const outcomeIndex =
    // @ts-expect-error: Cannot find name 'u8'.
    <u8>(event.params.amountsAdded[0] > event.params.amountsAdded[1] ? 1 : 0);
  const amount = event.params.amountsAdded[1 - outcomeIndex].minus(
    event.params.amountsAdded[outcomeIndex],
  );
  const price = computeFpmmPrice(event.params.amountsAdded, outcomeIndex);

  return {
    outcomeIndex,
    price,
    amount,
  };
};

export { parseFundingAddedRefundDetails, RefundDetails };
