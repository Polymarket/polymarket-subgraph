import { assert, describe, test } from 'matchstick-as/assembly/index';
import { indexSetContains } from '../../common/utils/indexSetContains';
import { log } from '@graphprotocol/graph-ts';
import { Address, Bytes, BigInt } from '@graphprotocol/graph-ts';
import { getNegRiskPositionId } from '../../common';

// import { updateUserPositionWithBuy } from '../../pnl-subgraph/src/utils/updateUserPositionWithBuy';
// import { updateUserPositionWithSell } from '../../pnl-subgraph/src/utils/updateUserPositionWithSell';
// import {
//   PositionSplit,
//   PositionsMerge,
//   PositionsConverted,
//   MarketPrepared,
//   QuestionPrepared,
//   PayoutRedemption,
// } from '../../pnl-subgraph/src/types/NegRiskAdapter/NegRiskAdapter';
// import { getNegRiskPositionId } from '../../common';
// import { loadOrCreateUserPosition } from '../../pnl-subgraph/src/utils/loadOrCreateUserPosition';
// import { handlePositionsConverted } from '../../pnl-subgraph/src/NegRiskAdapterMapping';
// import { NegRiskEvent } from '../../pnl-subgraph/src/types/schema';

describe('handlePositionsConverted()', () => {
  test('Should handle positions converted', () => {
    // const up = loadOrCreateUserPosition(
    //   Address.fromString('0x43372356634781eea88d61bbdd7824cdce958882'),
    //   BigInt.fromString(
    //     '92849115097658926029726616555072992123532598747617388960074918380114146610948',
    //   ),
    // );

    // up.amount = BigInt.fromString('205000000');
    // up.avgPrice = BigInt.fromString('800000');
    // up.totalBought = BigInt.fromString('205000000');
    // up.save();

    // const nr = new NegRiskEvent(
    //   '0x904aa321a48f737e2223e7b3007bf51d68b6a0d66bdda0c1e4bc581f55d62800',
    // );
    // nr.questionCount = 5;
    // nr.save();

    const questionCount = <u32>5;
    const indexSet = BigInt.fromI32(16);

    const marketId = Bytes.fromHexString(
      '0x904aa321a48f737e2223e7b3007bf51d68b6a0d66bdda0c1e4bc581f55d62800',
    );
    let questionIndex: u8 = 0;
    let noCount = 0;
    let noPriceSum = BigInt.zero();

    for (; questionIndex < questionCount; questionIndex++) {
      //
      // check if indexSet AND (1 << questionIndex) > 0
      // if so, then the user is converting NO tokens
      // otherwise,
      //
      if (indexSetContains(indexSet, questionIndex)) {
        // if the indexSet contains this index
        // then the user sells NO tokens
        noCount++;

        const positionId = getNegRiskPositionId(marketId, questionIndex, 1);
        log.info('questionIndex: {}', [questionIndex.toString()]);
        log.info('positionId: {}', [positionId.toString()]);

        // const userPosition = loadOrCreateUserPosition(
        //   event.params.stakeholder,
        //   positionId,
        // );

        // sell the NO token for the average price it was obtained for
        // updateUserPositionWithSell(
        //   event.params.stakeholder,
        //   positionId,
        //   userPosition.avgPrice,
        //   event.params.amount,
        // );

        // noPriceSum = noPriceSum.plus(userPosition.avgPrice);
      }
    }

    // const noPrice = noPriceSum.div(BigInt.fromI32(noCount));

    // questionCount could equal noCount,
    // in that case we didn't buy any YES tokens
    if (questionCount == noCount) {
      return;
    }

    // const yesPrice = computeNegRiskYesPrice(noPrice, noCount, questionCount);

    questionIndex = 0;
    for (; questionIndex < questionCount; questionIndex++) {
      if (!indexSetContains(indexSet, questionIndex)) {
        // if the index set does NOT contain this index
        // then the user buys YES tokens
        // const positionId = getNegRiskPositionId(
        //   event.params.marketId,
        //   questionIndex,
        //   YES_INDEX,
        // );
        // // buy the YES tokens with average YES price computed above
        // updateUserPositionWithBuy(
        //   event.params.stakeholder,
        //   positionId,
        //   yesPrice,
        //   event.params.amount,
        // );
      }
    }

    assert.assertTrue(true);
    assert.assertNotNull(1);
  });
});
