import { Transfer } from './types/ERC20Detailed/ERC20Detailed';
import { updateOpenInterest } from './utils/global-utils';

export function handleERC20Transfer(event: Transfer): void {
  let toAddress = event.params.to.toHexString();
  let fromAddress = event.params.from.toHexString();
  let amount = event.params.value;
  updateOpenInterest(amount, toAddress, fromAddress);
}
