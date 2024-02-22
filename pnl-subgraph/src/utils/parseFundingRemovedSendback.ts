/* eslint-disable @typescript-eslint/ban-types */

import { BigInt } from '@graphprotocol/graph-ts';
import { computeFpmmPrice } from './computeFpmmPrice';
import { FPMMFundingRemoved } from '../types/templates/FixedProductMarketMaker/FixedProductMarketMaker';

class FundingRemovedSendback {
  // @ts-expect-error: Cannot find name 'u8'.
  outcomeIndex: u8;

  price: BigInt;

  amount: BigInt;
}

// event FPMMFundingRemoved(
//   address indexed funder,
//   uint[] amountsRemoved,
//   uint collateralRemovedFromFeePool,
//   uint sharesBurnt
// );
const parseFundingRemovedSendback = (
  event: FPMMFundingRemoved,
): FundingRemovedSendback => {
  // sendback index is the _larger_ value
  const outcomeIndex =
    // @ts-expect-error: Cannot find name 'u8'.
    <u8>(
      (event.params.amountsRemoved[0] > event.params.amountsRemoved[1] ? 0 : 1)
    );

  // amount is larger - smaller
  const amount = event.params.amountsRemoved[outcomeIndex].minus(
    event.params.amountsRemoved[1 - outcomeIndex],
  );

  const price = computeFpmmPrice(event.params.amountsRemoved, outcomeIndex);

  return {
    outcomeIndex,
    price,
    amount,
  };
};

export { parseFundingRemovedSendback, FundingRemovedSendback };
