/* eslint-disable @typescript-eslint/ban-types */

import { BigInt } from '@graphprotocol/graph-ts';
import { COLLATERAL_SCALE } from '../../../common/constants';

// be careful that noCount does not equal questionCount!
const computeNegRiskYesPrice = (
  noPrice: BigInt,
  // @ts-expect-error Cannot find name 'i32'.
  noCount: i32,
  // @ts-expect-error Cannot find name 'i32'.
  questionCount: i32,
): BigInt =>
  noPrice
    .times(BigInt.fromI32(noCount))
    .minus(COLLATERAL_SCALE.times(BigInt.fromI32(noCount - 1)))
    .div(BigInt.fromI32(questionCount - noCount));

export { computeNegRiskYesPrice };
