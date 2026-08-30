let hasHost = false;
function registerDashboardPinHost() {
  hasHost = true;
}
function hasDashboardPinHost() {
  return hasHost;
}
function __clearDashboardPinHost() {
  hasHost = false;
}
export {
  __clearDashboardPinHost,
  hasDashboardPinHost,
  registerDashboardPinHost
};
//# sourceMappingURL=dashboardPinRegistry.js.map
