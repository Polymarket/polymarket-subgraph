/* eslint-disable @typescript-eslint/ban-types */

import { BigInt } from '@graphprotocol/graph-ts';
import { COLLATERAL_SCALE } from '../../../common/constants';

// @ts-expect-error: Cannot find name 'u8'.
const computeFpmmPrice = (amounts: BigInt[], outcomeIndex: u8): BigInt =>
  amounts[1 - outcomeIndex]
    .times(COLLATERAL_SCALE)
    .div(amounts[0].plus(amounts[1]));

export { computeFpmmPrice };
