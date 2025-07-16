import {
  QuestionFlagged as QuestionFlaggedEvent,
  QuestionPaused as QuestionPausedEvent,
  QuestionUnpaused as QuestionUnpausedEvent,
  QuestionReset as QuestionResetEvent,
  QuestionInitialized as QuestionInitializedEvent,
  QuestionResolved as QuestionResolvedEvent,
  QuestionManuallyResolved as QuestionManuallyResolvedEvent
} from "./types/UmaCtfAdapterV4/UmaCtfAdapterV4";
import { Request, RequestActivity } from "./types/schema";
import { RequestActivityType } from "./RequestActivityType";
import { BigInt, Bytes } from '@graphprotocol/graph-ts';

export function handleInitialize(event: QuestionInitializedEvent): void {
  const id = event.params.questionID.toHex();
  let request = Request.load(id);

  if (!request) {
    request = new Request(id);
    request.negRisk = false;
    request.negRiskMarketId = new Bytes(0);
    request.negRiskQuestionId = new Bytes(0);
    request.negRiskFlaggedAt = BigInt.fromI32(0);
    request.negRiskResolved = false;
    request.negRiskResult = [];
    request.flaggedAt = BigInt.fromI32(0);
    request.paused = false;
    request.resolved = false;
    request.result = [];
  }

  request.adapter = event.address;
  request.ancillaryData = event.params.ancillaryData;
  request.adapter = event.address;
  request.requestTimestamp = event.block.timestamp;
  request.save();

  let activityId = request.id + "-" + event.block.number.toString() + "-" + event.logIndex.toString();
  let activity = new RequestActivity(activityId);
  activity.request = request.id;
  activity.activityType = RequestActivityType.INITIALIZE;
  activity.timestamp = event.block.timestamp;
  activity.admin = event.transaction.from;
  activity.save();
}

export function handleFlag(event: QuestionFlaggedEvent): void {
  const id = event.params.questionID.toHex();
  let request = Request.load(id);
  if (request) {
    request.flaggedAt = event.block.timestamp;
    request.paused = true;
    request.save();
  }
  let activityId = id + "-" + event.block.number.toString() + "-" + event.logIndex.toString();
  let activity = new RequestActivity(activityId);
  activity.request = id;
  activity.activityType = RequestActivityType.FLAG;
  activity.timestamp = event.block.timestamp;
  activity.admin = event.transaction.from;
  activity.save();
}

export function handlePause(event: QuestionPausedEvent): void {
  const id = event.params.questionID.toHex();
  let request = Request.load(id);
  if (request) {
    request.paused = true;
    request.save();
  }
  let activityId = id + "-" + event.block.number.toString() + "-" + event.logIndex.toString();
  let activity = new RequestActivity(activityId);
  activity.request = id;
  activity.activityType = RequestActivityType.PAUSE;
  activity.timestamp = event.block.timestamp;
  activity.admin = event.transaction.from;
  activity.save();
}

export function handleUnpause(event: QuestionUnpausedEvent): void {
  const id = event.params.questionID.toHex();
  let request = Request.load(id);
  if (request) {
    request.paused = false;
    request.save();
  }
  let activityId = id + "-" + event.block.number.toString() + "-" + event.logIndex.toString();
  let activity = new RequestActivity(activityId);
  activity.request = id;
  activity.activityType = RequestActivityType.UNPAUSE;
  activity.timestamp = event.block.timestamp;
  activity.admin = event.transaction.from;
  activity.save();
}

export function handleReset(event: QuestionResetEvent): void {
  const id = event.params.questionID.toHex();
  let request = Request.load(id);
  if (request) {
    request.requestTimestamp = event.block.timestamp;
    request.save();
  }
  let activityId = id + "-" + event.block.number.toString() + "-" + event.logIndex.toString();
  let activity = new RequestActivity(activityId);
  activity.request = id;
  activity.activityType = RequestActivityType.RESET;
  activity.timestamp = event.block.timestamp;
  activity.admin = event.transaction.from;
  activity.save();
}

export function handleResolved(event: QuestionResolvedEvent): void {
  const id = event.params.questionID.toHex();
  let request = Request.load(id);
  if (request) {
    request.resolved = true;
    request.result = event.params.payouts;
    request.save();
  }
  let activityId = id + "-" + event.block.number.toString() + "-" + event.logIndex.toString();
  let activity = new RequestActivity(activityId);
  activity.request = id;
  activity.activityType = RequestActivityType.RESOLVE;
  activity.timestamp = event.block.timestamp;
  activity.admin = event.transaction.from;
  activity.save();
}

export function handleManuallyResolved(event: QuestionManuallyResolvedEvent): void {
  const id = event.params.questionID.toHex();
  let request = Request.load(id);
  if (request) {
    request.resolved = true;
    request.result = event.params.payouts;
    request.save();
  }
  let activityId = id + "-" + event.block.number.toString() + "-" + event.logIndex.toString();
  let activity = new RequestActivity(activityId);
  activity.request = id;
  activity.activityType = RequestActivityType.RESOLVE_MANUALLY;
  activity.timestamp = event.block.timestamp;
  activity.admin = event.transaction.from;
  activity.save();
} 