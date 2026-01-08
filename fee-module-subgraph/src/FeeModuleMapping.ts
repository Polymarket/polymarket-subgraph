import { FeeRefunded } from "./types/FeeModule/FeeModule";
import {
    NEG_RISK_FEE_MODULE,
  } from '../../common/constants';
import { getEventKey } from "../../common";
import { FeeRefundedEntity } from "./types/schema";


export function handleFeeRefunded(event: FeeRefunded): void {
    let negRisk = false;
    if(event.address.equals(NEG_RISK_FEE_MODULE)) {
        negRisk = true;
    }

    const feeRefunded = new FeeRefundedEntity(getEventKey(event));
    feeRefunded.tokenId = event.params.id.toString();
    feeRefunded.refundee = event.params.to.toHexString();
    feeRefunded.orderHash = event.params.orderHash.toHexString();
    feeRefunded.timestamp = event.block.timestamp;
    feeRefunded.feeRefunded = event.params.refund;
    feeRefunded.feeCharged = event.params.feeCharged;
    feeRefunded.negRisk = negRisk;
    feeRefunded.save();
}