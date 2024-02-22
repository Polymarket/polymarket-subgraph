import {
  FPMMBuy,
  FPMMFundingAdded,
  FPMMFundingRemoved,
  FPMMSell,
} from './types/templates/FixedProductMarketMaker/FixedProductMarketMaker';
import { updateUserPositionWithBuy } from './utils/updateUserPositionWithBuy';
import { COLLATERAL_SCALE } from '../../common/constants';
import { Condition, FPMM } from './types/schema';
import { updateUserPositionWithSell } from './utils/updateUserPositionWithSell';
import { parseFundingAddedSendback } from './utils/parseFundingAddedSendback';
import { parseFundingRemovedSendback } from './utils/parseFundingRemovedSendback';

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
  const outcomeIndex = event.params.outcomeIndex.toI32();

  const fpmm = FPMM.load(event.address.toHexString());
  if (fpmm == null) {
    return;
  }
  const conditionId = fpmm.conditionId;

  const condition = Condition.load(conditionId);
  if (condition == null) {
    return;
  }

  const positionId = condition.positionIds[outcomeIndex];

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
  const outcomeIndex = event.params.outcomeIndex.toI32();

  const fpmm = FPMM.load(event.address.toHexString());
  if (fpmm == null) {
    return;
  }
  const conditionId = fpmm.conditionId;
  const condition = Condition.load(conditionId);
  if (condition == null) {
    return;
  }

  const positionId = condition.positionIds[outcomeIndex];

  updateUserPositionWithSell(
    event.params.seller,
    positionId,
    price,
    event.params.outcomeTokensSold,
  );
}

export function handleFundingAdded(event: FPMMFundingAdded): void {
  const fpmm = FPMM.load(event.address.toHexString());
  if (fpmm == null) {
    return;
  }
  const conditionId = fpmm.conditionId;

  const condition = Condition.load(conditionId);
  if (condition == null) {
    return;
  }

  const sendbackDetails = parseFundingAddedSendback(event);
  const positionId = condition.positionIds[sendbackDetails.outcomeIndex];

  updateUserPositionWithBuy(
    event.params.funder,
    positionId,
    sendbackDetails.price,
    sendbackDetails.amount,
  );
}

export function handleFundingRemoved(event: FPMMFundingRemoved): void {
  const fpmm = FPMM.load(event.address.toHexString());
  if (fpmm == null) {
    return;
  }
  const conditionId = fpmm.conditionId;

  const sendbackDetails = parseFundingRemovedSendback(event);

  const condition = Condition.load(conditionId);
  if (condition == null) {
    return;
  }

  const positionId = condition.positionIds[sendbackDetails.outcomeIndex];

  updateUserPositionWithBuy(
    event.params.funder,
    positionId,
    sendbackDetails.price,
    sendbackDetails.amount,
  );
}
