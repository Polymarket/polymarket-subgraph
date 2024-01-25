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

const TRADE_TYPE_BUY = 'Buy';
const TRADE_TYPE_SELL = 'Sell';

export {
  COLLATERAL_SCALE,
  CONDITIONAL_TOKENS,
  EXCHANGE,
  NEG_RISK_ADAPTER,
  NEG_RISK_EXCHANGE,
  NEG_RISK_OPERATOR,
  NEG_RISK_WRAPPED_COLLATERAL,
  USDC,
  TRADE_TYPE_BUY,
  TRADE_TYPE_SELL,
};
