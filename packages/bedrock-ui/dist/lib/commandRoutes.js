let routes = [];
function registerCommandRoutes(items) {
  routes = items;
}
function getCommandRoutes() {
  return routes;
}
function __clearCommandRoutes() {
  routes = [];
}
export {
  __clearCommandRoutes,
  getCommandRoutes,
  registerCommandRoutes
};
//# sourceMappingURL=commandRoutes.js.map
