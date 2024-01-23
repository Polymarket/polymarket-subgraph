/* eslint-disable @typescript-eslint/ban-types */

import { Bytes, BigInt, Address } from '@graphprotocol/graph-ts';
import { computePositionId } from './ctf-utils';
import { USDC, NEG_RISK_WRAPPED_COLLATERAL } from '../constants';

const getPositionId = (
  conditionId: Bytes,
  outcomeIndex: number,
  negRisk: boolean,
): BigInt => {
  // if its the standard exchange, use USDC
  // otherwise, its the negrisk exchange, use wrapped collateral
  const collateral = negRisk ? NEG_RISK_WRAPPED_COLLATERAL : USDC;

  return computePositionId(
    Address.fromString(collateral),
    conditionId,
    outcomeIndex,
  );
};

export { getPositionId };
