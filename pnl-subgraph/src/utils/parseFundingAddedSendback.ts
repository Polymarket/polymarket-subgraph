/* eslint-disable @typescript-eslint/ban-types */

import { BigInt } from '@graphprotocol/graph-ts';
import { computeFpmmPrice } from './computeFpmmPrice';
import { FPMMFundingAdded } from '../types/templates/FixedProductMarketMaker/FixedProductMarketMaker';

class FundingAddedSendback {
  // @ts-expect-error: Cannot find name 'u8'.
  outcomeIndex: u8;

  price: BigInt;

  amount: BigInt;
}

// event FPMMFundingAdded(
//   address indexed funder,
//   uint[] amountsAdded,
//   uint sharesMinted
// );
const parseFundingAddedSendback = (
  event: FPMMFundingAdded,
): FundingAddedSendback => {
  // refunded index is the _smaller_ value
  const outcomeIndex =
    // @ts-expect-error: Cannot find name 'u8'.
    <u8>(event.params.amountsAdded[0] > event.params.amountsAdded[1] ? 1 : 0);

  // amount is larger - smaller
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

export { parseFundingAddedSendback, FundingAddedSendback };
