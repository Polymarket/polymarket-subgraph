import { ethereum } from '@graphprotocol/graph-ts';

const getEventKey = (event: ethereum.Event): string => {
  return (
    event.transaction.hash.toHexString() + '_' + event.logIndex.toHexString()
  );
};

export { getEventKey };
