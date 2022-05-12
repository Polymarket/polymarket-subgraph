import { Transfer } from './types/ERC20Detailed/ERC20Detailed';
import { CONDITIONAL_TOKENS_ADDRESS } from './utils/constants';
import { updateOpenInterest } from './utils/global-utils';

export function handleERC20Transfer(event: Transfer): void {
  let to = event.params.to.toHexString();
  let from = event.params.from.toHexString();
  let amount = event.params.value;
  if (to == CONDITIONAL_TOKENS_ADDRESS) {
    updateOpenInterest(amount, true);
    return;
  }
  if (from == CONDITIONAL_TOKENS_ADDRESS) {
    updateOpenInterest(amount, false);
  }
}
