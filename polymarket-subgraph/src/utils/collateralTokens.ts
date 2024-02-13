import { Address, BigInt } from '@graphprotocol/graph-ts';
import { Collateral } from '../types/schema';
import { ERC20Detailed } from '../types/templates/ERC20Detailed/ERC20Detailed';

function getTokenName(collateralAddress: Address): string {
  let collateralToken = ERC20Detailed.bind(collateralAddress);
  let result = collateralToken.try_name();

  return result.reverted ? '' : result.value;
}

function getTokenSymbol(collateralAddress: Address): string {
  let collateralToken = ERC20Detailed.bind(collateralAddress);
  let result = collateralToken.try_symbol();

  return result.reverted ? '' : result.value;
}

export function getTokenDecimals(collateralAddress: Address): i32 {
  let collateralToken = ERC20Detailed.bind(collateralAddress);
  let result = collateralToken.try_decimals();

  return result.reverted ? 0 : result.value;
}

export function getCollateralDetails(collateralAddress: Address): Collateral {
  let collateral = Collateral.load(collateralAddress.toHexString());
  if (collateral == null) {
    collateral = new Collateral(collateralAddress.toHexString());
    collateral.name = getTokenName(collateralAddress);
    collateral.symbol = getTokenSymbol(collateralAddress);
    collateral.decimals = getTokenDecimals(collateralAddress);
    collateral.save();
  }
  return collateral as Collateral;
}

export function getCollateralScale(collateralTokenAddress: string): BigInt {
  let collateralToken = Collateral.load(collateralTokenAddress) as Collateral;
  return BigInt.fromI32(10).pow(<u8>collateralToken.decimals);
}
