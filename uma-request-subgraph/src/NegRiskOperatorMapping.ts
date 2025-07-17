import { Bytes, BigInt } from '@graphprotocol/graph-ts';

import { RequestActivityType } from './constants';
import { boolToResultArray, createNewRequestEntity } from './helpers';
import { Request, RequestActivity } from './types/schema';
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
  if (!request) request = createNewRequestEntity(requestId);

  request.negRisk = true;
  request.negRiskMarketId = event.params.marketId;
  request.negRiskQuestionId = event.params.questionId;
  request.negRiskFlaggedAt = BigInt.fromI32(0);
  request.negRiskResolved = false;
  request.negRiskResult = [];
  request.save();
}

export function handleNegRiskFlagged(event: QuestionFlaggedEvent): void {
  const questionId = event.params.questionId.toHex();
  let request = Request.load(questionId);

  if (request) {
    request.negRiskFlaggedAt = event.block.timestamp;
    request.save();
  }

  let activityId =
    questionId +
    '-' +
    event.block.number.toString() +
    '-' +
    event.logIndex.toString();
  let activity = new RequestActivity(activityId);

  activity.request = questionId;
  activity.type = RequestActivityType.NEGRISK_FLAG;
  activity.timestamp = event.block.timestamp;
  activity.admin = event.transaction.from;
  activity.save();
}

export function handleNegRiskUnflagged(event: QuestionUnflaggedEvent): void {
  const questionId = event.params.questionId.toHex();
  let request = Request.load(questionId);

  if (request) {
    request.negRiskFlaggedAt = BigInt.fromI32(0);
    request.save();
  }

  let activityId =
    questionId +
    '-' +
    event.block.number.toString() +
    '-' +
    event.logIndex.toString();
  let activity = new RequestActivity(activityId);

  activity.request = questionId;
  activity.type = RequestActivityType.NEGRISK_UNFLAG;
  activity.timestamp = event.block.timestamp;
  activity.admin = event.transaction.from;
  activity.save();
}

export function handleNegRiskReported(event: QuestionReportedEvent): void {
  const questionId = event.params.questionId.toHex();
  let request = Request.load(questionId);

  if (request) {
    request.negRiskResult = boolToResultArray(event.params.result);
    request.save();
  }

  let activityId =
    questionId +
    '-' +
    event.block.number.toString() +
    '-' +
    event.logIndex.toString();
  let activity = new RequestActivity(activityId);

  activity.request = questionId;
  activity.type = RequestActivityType.NEGRISK_REPORT;
  activity.timestamp = event.block.timestamp;
  activity.admin = event.transaction.from;
  activity.save();
}

export function handleNegRiskResolved(event: QuestionResolvedEvent): void {
  const questionId = event.params.questionId.toHex();
  let request = Request.load(questionId);

  if (request) {
    request.negRiskResolved = true;
    request.negRiskResult = boolToResultArray(event.params.result);
    request.save();
  }

  let activityId =
    questionId +
    '-' +
    event.block.number.toString() +
    '-' +
    event.logIndex.toString();
  let activity = new RequestActivity(activityId);

  activity.request = questionId;
  activity.type = RequestActivityType.NEGRISK_RESOLVE;
  activity.timestamp = event.block.timestamp;
  activity.admin = event.transaction.from;
  activity.save();
}

export function handleNegRiskEmergencyResolved(
  event: QuestionEmergencyResolvedEvent,
): void {
  const questionId = event.params.questionId.toHex();
  let request = Request.load(questionId);

  if (request) {
    request.negRiskResolved = true;
    request.negRiskResult = boolToResultArray(event.params.result);
    request.save();
  }

  let activityId =
    questionId +
    '-' +
    event.block.number.toString() +
    '-' +
    event.logIndex.toString();
  let activity = new RequestActivity(activityId);

  activity.request = questionId;
  activity.type = RequestActivityType.NEGRISK_RESOLVE_MANUALLY;
  activity.timestamp = event.block.timestamp;
  activity.admin = event.transaction.from;
  activity.save();
}
