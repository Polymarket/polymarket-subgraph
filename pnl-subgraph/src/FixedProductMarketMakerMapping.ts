import { BigInt } from '@graphprotocol/graph-ts';
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
import { computeFpmmPrice } from './utils/computeFpmmPrice';

export function handleBuy(event: FPMMBuy): void {
  //   event FPMMBuy(
  //     address indexed buyer,
  //     uint investmentAmount,
  //     uint feeAmount,
  //     uint indexed outcomeIndex,
  //     uint outcomeTokensBought
  // );

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
  //   event FPMMSell(
  //     address indexed seller,
  //     uint returnAmount,
  //     uint feeAmount,
  //     uint indexed outcomeIndex,
  //     uint outcomeTokensSold
  // );

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
  //   event FPMMFundingAdded(
  //     address indexed funder,
  //     uint[] amountsAdded,
  //     uint sharesMinted
  // );

  const fpmm = FPMM.load(event.address.toHexString());

  if (fpmm == null) {
    return;
  }

  const conditionId = fpmm.conditionId;
  const condition = Condition.load(conditionId);

  // ensure the condition exists _before_ we parse the sendback
  if (condition == null) {
    return;
  }

  // if no tokens were exchanged, do nothing
  if (
    event.params.amountsAdded[0].plus(event.params.amountsAdded[1]).isZero()
  ) {
    return;
  }

  const sendbackDetails = parseFundingAddedSendback(event);
  const positionId = condition.positionIds[sendbackDetails.outcomeIndex];

  // we consider that the user is buying the resulting token
  // at the market price
  updateUserPositionWithBuy(
    event.params.funder,
    positionId,
    sendbackDetails.price,
    sendbackDetails.amount,
  );

  // the largest amounts added is the total USDC spent
  const totalUSDCSpend =
    event.params.amountsAdded[0] > event.params.amountsAdded[1]
      ? event.params.amountsAdded[0]
      : event.params.amountsAdded[1];
  // we compute the cost of the token received
  const tokenCost = sendbackDetails.amount.times(sendbackDetails.price);
  // the leftover USDC is used to purchase the LP position
  const LPShareCost = totalUSDCSpend.minus(tokenCost);
  // then the price of the LP position is the cost of the LP position divided by the number of shares minted
  const LPSharePrice = LPShareCost.times(COLLATERAL_SCALE).div(
    event.params.sharesMinted,
  );

  updateUserPositionWithBuy(
    event.params.funder,
    BigInt.fromByteArray(event.address),
    LPSharePrice,
    event.params.sharesMinted,
  );
}

export function handleFundingRemoved(event: FPMMFundingRemoved): void {
  //   event FPMMFundingRemoved(
  //     address indexed funder,
  //     uint[] amountsRemoved,
  //     uint collateralRemovedFromFeePool,
  //     uint sharesBurnt
  // );

  const fpmm = FPMM.load(event.address.toHexString());

  if (fpmm == null) {
    return;
  }
  const conditionId = fpmm.conditionId;
  const condition = Condition.load(conditionId);

  // ensure the condition exists _before_ we parse the sendback
  if (condition == null) {
    return;
  }

  // if no tokens were exchanged, do nothing
  if (
    event.params.amountsRemoved[0].plus(event.params.amountsRemoved[1]).isZero()
  ) {
    return;
  }

  for (let i = 0; i < 2; i++) {
    const positionId = condition.positionIds[i];

    updateUserPositionWithBuy(
      event.params.funder,
      positionId,
      // @ts-expect-error: Cannot find name 'u8'.
      computeFpmmPrice(event.params.amountsRemoved, <u8>i),
      event.params.amountsRemoved[i],
    );
  }

  // now we consider selling the LP shares
  updateUserPositionWithSell(
    event.params.funder,
    BigInt.fromByteArray(event.address),
    // the price of the LP position is the collateral removed from the fee pool divided by the shares burnt
    event.params.collateralRemovedFromFeePool
      .times(COLLATERAL_SCALE)
      .div(event.params.sharesBurnt),
    event.params.sharesBurnt,
  );
}
