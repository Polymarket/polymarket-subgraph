export const POLYGON_USDC = '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174';
export const MUMBAI_USDC = '0x2E8DCfE708D44ae2e406a1c02DFE2Fa13012f961';

export function getCollateralAddress(networkName: string): string {
  if (networkName == 'matic') {
    return POLYGON_USDC;
  }
  if (networkName == 'mumbai') {
    return MUMBAI_USDC;
  }
  return '';
}
