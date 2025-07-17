import { Request } from "./types/schema";
import { BigInt, Bytes } from "@graphprotocol/graph-ts";

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