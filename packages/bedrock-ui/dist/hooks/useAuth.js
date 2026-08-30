import { useContext } from "react";
import { AuthContext } from "../context/AuthContext.js";
function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within <AuthProvider>");
  }
  return ctx;
}
export {
  useAuth
};
//# sourceMappingURL=useAuth.js.map
