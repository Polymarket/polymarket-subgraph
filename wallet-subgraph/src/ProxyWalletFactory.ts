import { BigInt } from '@graphprotocol/graph-ts';

import {
  PROXY_WALLET_FACTORY,
  PROXY_WALLET_IMPLEMENTATION,
} from '../../common/constants';
import { computeProxyWalletAddress } from '../../common/utils/computeProxyWalletAddress';

import { ProxyCall } from './types/ProxyWalletFactory/ProxyWalletFactory';
import { Wallet } from './types/schema';

export function handleProxyCall(call: ProxyCall): void {
  const signer = call.from;
  const walletAddress = computeProxyWalletAddress(
    signer,
    PROXY_WALLET_FACTORY,
    PROXY_WALLET_IMPLEMENTATION,
  );
  const wallet = Wallet.load(walletAddress.toHexString());

  if (wallet == null) {
    const newWallet = new Wallet(walletAddress.toHexString());
    newWallet.signer = signer.toHexString();
    newWallet.type = 'proxy';
    newWallet.balance = BigInt.fromI32(0);
    newWallet.save();
  }
}
