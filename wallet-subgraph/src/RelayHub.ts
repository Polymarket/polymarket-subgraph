import { BigInt } from '@graphprotocol/graph-ts';

import {
  PROXY_WALLET_FACTORY,
  PROXY_WALLET_IMPLEMENTATION,
} from '../../common/constants';
import { computeProxyWalletAddress } from '../../common/utils/computeProxyWalletAddress';

import { TransactionRelayed } from './types/RelayHub/RelayHub';
import { Wallet } from './types/schema';

export function handleTransactionRelayed(event: TransactionRelayed): void {
  const from = event.params.from;
  const to = event.params.to;

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
    newWallet.lastTransfer = BigInt.fromI32(0);
    newWallet.createdAt = event.block.timestamp;
    newWallet.save();
  }
}
