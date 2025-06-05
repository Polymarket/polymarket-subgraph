import { BigInt } from '@graphprotocol/graph-ts';

import {
  PROXY_WALLET_FACTORY,
  PROXY_WALLET_IMPLEMENTATION,
} from '../../common/constants';
import { computeProxyWalletAddress } from '../../common/utils/computeProxyWalletAddress';

import { RelayCallCall } from './types/RelayHub/RelayHub';
import { Wallet } from './types/schema';

export function handleRelayCall(call: RelayCallCall): void {
  const from = call.inputs.from;
  const to = call.inputs.to;

  // ignore if not a proxy wallet factory call
  if (!to.equals(PROXY_WALLET_FACTORY)) {
    return;
  }

  const walletAddress = computeProxyWalletAddress(
    from,
    PROXY_WALLET_FACTORY,
    PROXY_WALLET_IMPLEMENTATION,
  );
  const wallet = Wallet.load(walletAddress.toHexString());

  if (wallet == null) {
    const newWallet = new Wallet(walletAddress.toHexString());
    newWallet.signer = from.toHexString();
    newWallet.type = 'proxy';
    newWallet.balance = BigInt.fromI32(0);
    newWallet.save();
  }
}
