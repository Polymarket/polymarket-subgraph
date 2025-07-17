import { Bytes, BigInt } from '@graphprotocol/graph-ts';

import { RequestActivityType } from './constants';
import { boolToResultArray, createNewRequestEntity } from './helpers';
import { NegRiskQuestion, Request, RequestActivity } from './types/schema';
import {
  QuestionPrepared as QuestionPreparedEvent,
  QuestionReported as QuestionReportedEvent,
  QuestionResolved as QuestionResolvedEvent,
  QuestionFlagged as QuestionFlaggedEvent,
  QuestionUnflagged as QuestionUnflaggedEvent,
  QuestionEmergencyResolved as QuestionEmergencyResolvedEvent,
} from './types/NegRiskOperator/NegRiskOperator';

export function handleQuestionPrepared(event: QuestionPreparedEvent): void {
  const requestId = event.params.requestId.toHex();
  let request = Request.load(requestId);

  if (!request) {
    request = createNewRequestEntity(requestId);
  }

  // always overwrite questionId
  request.questionId = event.params.questionId;

  request.negRisk = true;
  request.negRiskMarketId = event.params.marketId;
  request.negRiskFlaggedAt = BigInt.fromI32(0);
  request.negRiskResolved = false;
  request.negRiskResult = [];
  request.save();

  // save negRisk question indexed by questionId
  const negRiskQuestion = new NegRiskQuestion(
    event.params.questionId.toHexString(),
  );
  negRiskQuestion.requestId = event.params.requestId;

  negRiskQuestion.save();
}

export function handleQuestionResolved(event: QuestionResolvedEvent): void {
  const negRiskQuestion = NegRiskQuestion.load(
    event.params.questionId.toHexString(),
  );

  if (!negRiskQuestion) {
    return;
  }

  const requestId = negRiskQuestion.requestId.toHex();
  const request = Request.load(requestId);

  if (request) {
    request.negRiskResolved = true;
    request.negRiskResult = boolToResultArray(event.params.result);
    request.save();
  }

  const activityId =
    requestId +
    '-' +
    event.block.number.toString() +
    '-' +
    event.logIndex.toString();
  const activity = new RequestActivity(activityId);

  activity.request = requestId;
  activity.type = RequestActivityType.NEGRISK_RESOLVE;
  activity.timestamp = event.block.timestamp;
  activity.admin = event.transaction.from;
  activity.save();
}

export function handleQuestionFlagged(event: QuestionFlaggedEvent): void {
  const negRiskQuestion = NegRiskQuestion.load(
    event.params.questionId.toHexString(),
  );

  if (!negRiskQuestion) {
    return;
  }

  const requestId = negRiskQuestion.requestId.toHex();
  const request = Request.load(requestId);

  if (request) {
    request.negRiskFlaggedAt = event.block.timestamp;
    request.save();
  }

  const activityId =
    requestId +
    '-' +
    event.block.number.toString() +
    '-' +
    event.logIndex.toString();
  const activity = new RequestActivity(activityId);

  activity.request = requestId;
  activity.type = RequestActivityType.NEGRISK_FLAG;
  activity.timestamp = event.block.timestamp;
  activity.admin = event.transaction.from;
  activity.save();
}

export function handleQuestionUnflagged(event: QuestionUnflaggedEvent): void {
  const negRiskQuestion = NegRiskQuestion.load(
    event.params.questionId.toHexString(),
  );

  if (!negRiskQuestion) {
    return;
  }

  const requestId = negRiskQuestion.requestId.toHex();
  const request = Request.load(requestId);

  if (request) {
    request.negRiskFlaggedAt = BigInt.fromI32(0);
    request.save();
  }

  const activityId =
    requestId +
    '-' +
    event.block.number.toString() +
    '-' +
    event.logIndex.toString();
  const activity = new RequestActivity(activityId);

  activity.request = requestId;
  activity.type = RequestActivityType.NEGRISK_UNFLAG;
  activity.timestamp = event.block.timestamp;
  activity.admin = event.transaction.from;
  activity.save();
}

export function handleQuestionReported(event: QuestionReportedEvent): void {
  const negRiskQuestion = NegRiskQuestion.load(
    event.params.questionId.toHexString(),
  );

  if (!negRiskQuestion) {
    return;
  }

  const requestId = negRiskQuestion.requestId.toHex();
  const request = Request.load(requestId);

  if (request) {
    request.negRiskResult = boolToResultArray(event.params.result);
    request.save();
  }

  const activityId =
    requestId +
    '-' +
    event.block.number.toString() +
    '-' +
    event.logIndex.toString();
  const activity = new RequestActivity(activityId);

  activity.request = requestId;
  activity.type = RequestActivityType.NEGRISK_REPORT;
  activity.timestamp = event.block.timestamp;
  activity.admin = event.transaction.from;
  activity.save();
}

export function handleQuestionEmergencyResolved(
  event: QuestionEmergencyResolvedEvent,
): void {
  const negRiskQuestion = NegRiskQuestion.load(
    event.params.questionId.toHexString(),
  );

  if (!negRiskQuestion) {
    return;
  }

  const requestId = negRiskQuestion.requestId.toHex();
  const request = Request.load(requestId);

  if (request) {
    request.negRiskResolved = true;
    request.negRiskResult = boolToResultArray(event.params.result);
    request.save();
  }

  const activityId =
    requestId +
    '-' +
    event.block.number.toString() +
    '-' +
    event.logIndex.toString();
  const activity = new RequestActivity(activityId);

  activity.request = requestId;
  activity.type = RequestActivityType.NEGRISK_RESOLVE_MANUALLY;
  activity.timestamp = event.block.timestamp;
  activity.admin = event.transaction.from;
  activity.save();
}
