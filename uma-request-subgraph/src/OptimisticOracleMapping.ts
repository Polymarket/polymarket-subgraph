import { crypto, Bytes } from '@graphprotocol/graph-ts';

import { RequestActivityType } from './constants';
import { Request, RequestActivity } from './types/schema';
import {
  ProposePrice as ProposePriceEvent,
  DisputePrice as DisputePriceEvent,
} from './types/OptimisticOracleV2/OptimisticOracleV2';

export function handleProposePrice(event: ProposePriceEvent): void {
  const id = crypto.keccak256(event.params.ancillaryData).toHex();
  let request = Request.load(id);

  if (request) {
    let activityId =
      id +
      '-' +
      event.block.number.toString() +
      '-' +
      event.logIndex.toString();
    let activity = new RequestActivity(activityId);

    activity.request = id;
    activity.activityType = RequestActivityType.PROPOSE;
    activity.timestamp = event.block.timestamp;
    activity.admin = event.transaction.from;
    activity.save();
  }
}

export function handleDisputePrice(event: DisputePriceEvent): void {
  const id = crypto.keccak256(event.params.ancillaryData).toHex();
  let request = Request.load(id);

  if (request) {
    let activityId =
      id +
      '-' +
      event.block.number.toString() +
      '-' +
      event.logIndex.toString();
    let activity = new RequestActivity(activityId);

    activity.request = id;
    activity.activityType = RequestActivityType.DISPUTE;
    activity.timestamp = event.block.timestamp;
    activity.admin = event.transaction.from;
    activity.save();
  }
}
