import { Address } from '@graphprotocol/graph-ts';
import { FPMM } from '../types/schema';

export const findFPMM = (id: Address): boolean => {
  const fpmm = FPMM.load(id.toString());
  if (fpmm == null) {
    return false;
  }
  return true;
};
