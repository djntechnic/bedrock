import { log } from "../utils/logger.js";
function debug(message, context) {
  log.debug(context ?? {}, message);
}
function info(message, context) {
  log.info(context ?? {}, message);
}
function warn(message, context) {
  log.warn(context ?? {}, message);
}
function error(message, context) {
  log.error(context ?? {}, message);
}
const logger = { debug, info, warn, error };
export {
  logger
};
//# sourceMappingURL=logger.js.map
