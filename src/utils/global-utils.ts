import { Global } from "../../generated/schema";

export function requireGlobal(): Global {
  let global = Global.load('');
  if (global == null) {
    global = new Global('');
    global.numConditions = 0;
    global.numOpenConditions = 0;
    global.numClosedConditions = 0;
  }
  return global as Global;
}
