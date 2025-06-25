import { BigInt } from '@graphprotocol/graph-ts';

import { ProxyCreation } from './types/SafeProxyFactory/SafeProxyFactory';
import { Wallet } from './types/schema';

export function handleProxyCreation(event: ProxyCreation): void {
  const wallet = Wallet.load(event.params.proxy.toHexString());

  if (wallet == null) {
    const newWallet = new Wallet(event.params.proxy.toHexString());
    newWallet.signer = event.params.owner.toHexString();
    newWallet.type = 'safe';
    newWallet.balance = BigInt.fromI32(0);
    newWallet.lastTransfer = BigInt.fromI32(0);
    newWallet.createdAt = event.block.timestamp;
    newWallet.save();
  }
}
