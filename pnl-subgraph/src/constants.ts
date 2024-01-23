import { Address, BigInt } from '@graphprotocol/graph-ts';

const CONDITIONAL_TOKENS = Address.fromHexString(
  '0x4d97dcd97ec945f40cf65f87097ace5ea0476045',
);
const USDC = Address.fromHexString(
  '0x2791bca1f2de4661ed88a30c99a7a9449aa84174',
);
const NEG_RISK_WRAPPED_COLLATERAL = Address.fromHexString(
  '0x3a3bd7bb9528e159577f7c2e685cc81a765002e2',
);
const NEG_RISK_ADAPTER = Address.fromHexString(
  '0xd91e80cf2e7be2e162c6513ced06f1dd0da35296',
);
const EXCHANGE = Address.fromHexString(
  '0x4bfb41d5b3570defd03c39a9a4d8de6bd8b8982e',
);
const NEG_RISK_EXCHANGE = Address.fromHexString(
  '0xc5d563a36ae78145c45a50134d48a1215220f80a',
);
const NEG_RISK_OPERATOR = Address.fromHexString(
  '0x71523d0f655b41e805cec45b17163f528b59b820',
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
