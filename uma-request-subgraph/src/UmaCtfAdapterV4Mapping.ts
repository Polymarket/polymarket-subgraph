import { BigInt, Bytes } from '@graphprotocol/graph-ts';

import { RequestActivityType } from './constants';
import { createNewRequestEntity } from './helpers';
import { Request, RequestActivity } from './types/schema';
import {
  QuestionInitialized as QuestionInitializedEvent,
  QuestionResolved as QuestionResolvedEvent,
  QuestionFlagged as QuestionFlaggedEvent,
  QuestionPaused as QuestionPausedEvent,
  QuestionUnpaused as QuestionUnpausedEvent,
  QuestionReset as QuestionResetEvent,
  QuestionManuallyResolved as QuestionManuallyResolvedEvent,
} from './types/UmaCtfAdapterV4/UmaCtfAdapterV4';

export function handleInitialize(event: QuestionInitializedEvent): void {
  const id = event.params.questionID.toHex();
  let request = Request.load(id);
  if (!request) request = createNewRequestEntity(id);

  request.adapter = event.address;
  request.ancillaryData = event.params.ancillaryData;
  request.requestor = event.transaction.from;
  request.requestTimestamp = event.block.timestamp;
  request.save();

  let activityId =
    request.id +
    '-' +
    event.block.number.toString() +
    '-' +
    event.logIndex.toString();
  let activity = new RequestActivity(activityId);

  activity.request = request.id;
  activity.type = RequestActivityType.INITIALIZE;
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

  let activityId =
    id + '-' + event.block.number.toString() + '-' + event.logIndex.toString();
  let activity = new RequestActivity(activityId);

  activity.request = id;
  activity.type = RequestActivityType.RESOLVE;
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

  let activityId =
    id + '-' + event.block.number.toString() + '-' + event.logIndex.toString();
  let activity = new RequestActivity(activityId);

  activity.request = id;
  activity.type = RequestActivityType.FLAG;
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

  let activityId =
    id + '-' + event.block.number.toString() + '-' + event.logIndex.toString();
  let activity = new RequestActivity(activityId);

  activity.request = id;
  activity.type = RequestActivityType.PAUSE;
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

  let activityId =
    id + '-' + event.block.number.toString() + '-' + event.logIndex.toString();
  let activity = new RequestActivity(activityId);

  activity.request = id;
  activity.type = RequestActivityType.UNPAUSE;
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

  let activityId =
    id + '-' + event.block.number.toString() + '-' + event.logIndex.toString();
  let activity = new RequestActivity(activityId);

  activity.request = id;
  activity.type = RequestActivityType.RESET;
  activity.timestamp = event.block.timestamp;
  activity.admin = event.transaction.from;
  activity.save();
}

export function handleManuallyResolved(
  event: QuestionManuallyResolvedEvent,
): void {
  const id = event.params.questionID.toHex();
  let request = Request.load(id);

  if (request) {
    request.resolved = true;
    request.result = event.params.payouts;
    request.save();
  }

  let activityId =
    id + '-' + event.block.number.toString() + '-' + event.logIndex.toString();
  let activity = new RequestActivity(activityId);

  activity.request = id;
  activity.type = RequestActivityType.RESOLVE_MANUALLY;
  activity.timestamp = event.block.timestamp;
  activity.admin = event.transaction.from;
  activity.save();
}
