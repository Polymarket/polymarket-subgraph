import { Bytes } from '@graphprotocol/graph-ts';

import {
  FPMMBuy,
  FPMMSell,
} from './types/templates/FixedProductMarketMaker/FixedProductMarketMaker';
import { updateUserPositionWithBuy } from './utils/updateUserPositionWithBuy';
import { computePositionId } from '../../common';
import { COLLATERAL_SCALE, USDC } from '../../common/constants';
import { FPMM } from './types/schema';
import { updateUserPositionWithSell } from './utils/updateUserPositionWithSell';

export function handleBuy(event: FPMMBuy): void {
  // buyer
  // investmentAmount
  // feeAmount
  // outcomeIndex
  // outcomeTokensBought

  if (event.params.outcomeTokensBought.isZero()) {
    return;
  }

  // price is investmentAmount / outcomeTokensBought
  const price = event.params.investmentAmount
    .times(COLLATERAL_SCALE)
    .div(event.params.outcomeTokensBought);
  let outcomeIndex = event.params.outcomeIndex.toI32();

  const fpmm = FPMM.load(event.address.toHexString());
  if (fpmm == null) {
    return;
  }
  const conditionId = fpmm.conditionId;

  // FPMM tokens are never neg risk
  const positionId = computePositionId(
    USDC,
    Bytes.fromHexString(conditionId),
    // @ts-expect-error: Cannot find name 'u8'.
    <u8>outcomeIndex,
  );

  updateUserPositionWithBuy(
    event.params.buyer,
    positionId,
    price,
    event.params.outcomeTokensBought,
  );
}

export function handleSell(event: FPMMSell): void {
  // sller
  // returnAmount
  // feeAmount
  // outcomeIndex
  // outcomeTokensSold

  if (event.params.outcomeTokensSold.isZero()) {
    return;
  }

  // price is returnAmount / outcomeTokensSold
  const price = event.params.returnAmount
    .times(COLLATERAL_SCALE)
    .div(event.params.outcomeTokensSold);
  let outcomeIndex = event.params.outcomeIndex.toI32();

  const fpmm = FPMM.load(event.address.toHexString());
  if (fpmm == null) {
    return;
  }
  const conditionId = fpmm.conditionId;

  // FPMM tokens are never neg risk
  const positionId = computePositionId(
    USDC,
    Bytes.fromHexString(conditionId),
    // @ts-expect-error: Cannot find name 'u8'.
    <u8>outcomeIndex,
  );

  updateUserPositionWithSell(
    event.params.seller,
    positionId,
    price,
    event.params.outcomeTokensSold,
  );
}
