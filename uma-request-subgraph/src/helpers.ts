import { BigInt, Bytes } from '@graphprotocol/graph-ts';

import { Request } from './types/schema';

export function createNewRequestEntity(id: string): Request {
  let request = new Request(id);
  request.requestTimestamp = BigInt.fromI32(0);
  request.ancillaryData = new Bytes(0);
  request.adapter = Bytes.empty();
  request.requestor = Bytes.empty();
  request.paused = false;
  request.resolved = false;
  request.result = [];
  request.negRisk = false;
  request.negRiskMarketId = new Bytes(0);
  request.negRiskQuestionId = new Bytes(0);
  request.negRiskFlaggedAt = BigInt.fromI32(0);
  request.negRiskResolved = false;
  request.negRiskResult = [];
  request.flaggedAt = BigInt.fromI32(0);
  return request;
}

export function boolToResultArray(result: boolean): BigInt[] {
  return result
    ? [BigInt.fromI32(1), BigInt.fromI32(0)]
    : [BigInt.fromI32(0), BigInt.fromI32(1)];
}
