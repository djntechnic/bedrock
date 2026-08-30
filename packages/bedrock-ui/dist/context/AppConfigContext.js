import { createContext, useContext } from "react";
const AppConfigContext = createContext(null);
function useAppConfigContext() {
  return useContext(AppConfigContext);
}
export {
  AppConfigContext,
  useAppConfigContext
};
//# sourceMappingURL=AppConfigContext.js.map
