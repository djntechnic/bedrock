const policies = [];
function registerKpiGradientPolicy(policy) {
  policies.push(policy);
}
function resolveKpiGradientPolicy(columnId) {
  for (let i = policies.length - 1; i >= 0; i--) {
    const res = policies[i](columnId);
    if (res !== null && res !== void 0) {
      return res;
    }
  }
  return null;
}
function __clearKpiGradientPolicies() {
  policies.length = 0;
}
export {
  __clearKpiGradientPolicies,
  registerKpiGradientPolicy,
  resolveKpiGradientPolicy
};
//# sourceMappingURL=kpiGradientRegistry.js.map
