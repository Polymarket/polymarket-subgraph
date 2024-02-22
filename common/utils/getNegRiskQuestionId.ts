import { Bytes } from '@graphprotocol/graph-ts';

const getNegRiskQuestionId = (
  marketId: Bytes,
  // @ts-expect-error Cannot find name 'u8'.
  questionIndex: u8,
): Bytes => {
  // slice off the last two hex chars of the marketId and apped with questionIndex in hex padded to two chars
  const questionId = new Bytes(32);

  for (let i = 0; i < 31; i++) {
    questionId[i] = marketId[i];
  }

  questionId[31] = questionIndex;
  return questionId;
};

export { getNegRiskQuestionId };
