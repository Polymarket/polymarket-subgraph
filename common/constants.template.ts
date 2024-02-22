import { Address, BigInt } from '@graphprotocol/graph-ts';

const CONDITIONAL_TOKENS = Address.fromString(
  '{{ contracts.ConditionalTokens.address }}',
);
const USDC = Address.fromString('{{ contracts.USDC.address }}');
const NEG_RISK_WRAPPED_COLLATERAL = Address.fromString(
  '{{ contracts.NegRiskWrappedCollateral.address }}',
);
const NEG_RISK_ADAPTER = Address.fromString(
  '{{ contracts.NegRiskAdapter.address }}',
);
const EXCHANGE = Address.fromString(
  '{{ contracts.Exchange.address }}', //
);
const NEG_RISK_EXCHANGE = Address.fromString(
  '{{ contracts.NegRiskExchange.address }}',
);
const NEG_RISK_OPERATOR = Address.fromString(
  '{{ contracts.NegRiskOperator.address }}',
);
const COLLATERAL_SCALE = BigInt.fromI32(10).pow(6);
const COLLATERAL_SCALE_DEC = COLLATERAL_SCALE.toBigDecimal();

enum TradeType {
  BUY = 0,
  SELL = 1,
}

const FIFTY_CENTS = COLLATERAL_SCALE.div(BigInt.fromI32(2));

export {
  COLLATERAL_SCALE,
  COLLATERAL_SCALE_DEC,
  CONDITIONAL_TOKENS,
  EXCHANGE,
  FIFTY_CENTS,
  NEG_RISK_ADAPTER,
  NEG_RISK_EXCHANGE,
  NEG_RISK_OPERATOR,
  NEG_RISK_WRAPPED_COLLATERAL,
  USDC,
  TradeType,
};
