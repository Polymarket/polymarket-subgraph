import { BigInt } from '@graphprotocol/graph-ts';
import { assert, describe, test } from 'matchstick-as/assembly/index';

import { COLLATERAL_SCALE_DEC } from '../common/constants';
import { calculatePrices } from '../fpmm-subgraph/src/utils/fpmm-utils';
import { computeFpmmPrice } from '../pnl-subgraph/src/utils/computeFpmmPrice';

describe('fpmmPrices()', () => {
  test('Should calculate the prices correctly', () => {
    const amounts = [BigInt.fromI32(100), BigInt.fromI32(200)];
    // old implementation
    const prices = calculatePrices(amounts);

    const price0 = computeFpmmPrice(amounts, 0);
    const price1 = computeFpmmPrice(amounts, 1);

    assert.stringEquals(
      prices[0].times(COLLATERAL_SCALE_DEC).truncate(0).toString(),
      price0.toString(),
    );
    assert.stringEquals(
      prices[1].times(COLLATERAL_SCALE_DEC).truncate(0).toString(),
      price1.toString(),
    );
    // assert.bigIntEquals(prices[1], price1);
  });
});
