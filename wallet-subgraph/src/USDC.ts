import { BigInt } from '@graphprotocol/graph-ts';

import { GlobalUSDCBalance, Wallet } from './types/schema';
import { Transfer } from './types/USDC/ERC20';

function getGlobalUSDCBalance(): GlobalUSDCBalance {
  let globalUSDCBalance = GlobalUSDCBalance.load('');
  if (globalUSDCBalance == null) {
    globalUSDCBalance = new GlobalUSDCBalance('');
    globalUSDCBalance.balance = BigInt.fromI32(0);
    globalUSDCBalance.save();
  }
  return globalUSDCBalance;
}

export function handleUSDCTransfer(event: Transfer): void {
  // to
  {
    const wallet = Wallet.load(event.params.to.toHexString());
    if (wallet != null) {
      wallet.balance = wallet.balance.plus(event.params.amount);
      wallet.lastTransfer = event.block.timestamp;
      wallet.save();

      const globalUSDCBalance = getGlobalUSDCBalance();
      globalUSDCBalance.balance = globalUSDCBalance.balance.plus(
        event.params.amount,
      );
      globalUSDCBalance.save();
    }
  }

  // from
  {
    const wallet = Wallet.load(event.params.from.toHexString());
    if (wallet != null) {
      wallet.balance = wallet.balance.minus(event.params.amount);
      wallet.lastTransfer = event.block.timestamp;
      wallet.save();

      const globalUSDCBalance = getGlobalUSDCBalance();
      globalUSDCBalance.balance = globalUSDCBalance.balance.minus(
        event.params.amount,
      );
      globalUSDCBalance.save();
    }
  }
}
