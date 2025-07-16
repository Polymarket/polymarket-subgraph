import { Bytes, BigInt } from "@graphprotocol/graph-ts";

import { RequestActivityType } from "./RequestActivityType";
import {
  QuestionPrepared as QuestionPreparedEvent,
  QuestionFlagged as QuestionFlaggedEvent,
  QuestionUnflagged as QuestionUnflaggedEvent,
  QuestionReported as QuestionReportedEvent,
  QuestionResolved as QuestionResolvedEvent,
  QuestionEmergencyResolved as QuestionEmergencyResolvedEvent
} from "./types/NegRiskOperator/NegRiskOperator";
import { Request, RequestActivity } from "./types/schema";

function boolToResultArray(result: boolean): BigInt[] {
  return result ? [BigInt.fromI32(1), BigInt.fromI32(0)] : [BigInt.fromI32(0), BigInt.fromI32(1)];
}

export function handleQuestionPrepared(event: QuestionPreparedEvent): void {
  const requestId = event.params.requestId.toHex();
  let request = Request.load(requestId);

  if (!request) {
    request = new Request(requestId);
    request.requestTimestamp = event.block.timestamp;
    request.ancillaryData = new Bytes(0);
    request.adapter = event.address;
    request.requestor = event.transaction.from;
    request.flaggedAt = BigInt.fromI32(0);
    request.paused = false;
    request.resolved = false;
    request.result = [];
  }
  
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
  let activityId = questionId + "-" + event.block.number.toString() + "-" + event.logIndex.toString();
  let activity = new RequestActivity(activityId);
  activity.request = questionId;
  activity.activityType = RequestActivityType.NEGRISK_FLAG;
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
  let activityId = questionId + "-" + event.block.number.toString() + "-" + event.logIndex.toString();
  let activity = new RequestActivity(activityId);
  activity.request = questionId;
  activity.activityType = RequestActivityType.NEGRISK_UNFLAG;
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
  let activityId = questionId + "-" + event.block.number.toString() + "-" + event.logIndex.toString();
  let activity = new RequestActivity(activityId);
  activity.request = questionId;
  activity.activityType = RequestActivityType.NEGRISK_REPORT;
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
  let activityId = questionId + "-" + event.block.number.toString() + "-" + event.logIndex.toString();
  let activity = new RequestActivity(activityId);
  activity.request = questionId;
  activity.activityType = RequestActivityType.NEGRISK_RESOLVE;
  activity.timestamp = event.block.timestamp;
  activity.admin = event.transaction.from;
  activity.save();
}

export function handleNegRiskEmergencyResolved(event: QuestionEmergencyResolvedEvent): void {
  const questionId = event.params.questionId.toHex();
  let request = Request.load(questionId);
  if (request) {
    request.negRiskResolved = true;
    request.negRiskResult = boolToResultArray(event.params.result);
    request.save();
  }
  let activityId = questionId + "-" + event.block.number.toString() + "-" + event.logIndex.toString();
  let activity = new RequestActivity(activityId);
  activity.request = questionId;
  activity.activityType = RequestActivityType.NEGRISK_RESOLVE_MANUALLY;
  activity.timestamp = event.block.timestamp;
  activity.admin = event.transaction.from;
  activity.save();
} 