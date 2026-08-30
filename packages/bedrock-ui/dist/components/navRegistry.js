function isNavItemVisible(item, auth) {
  if (item.module === "admin" && (!auth.user || !auth.isAdmin)) return false;
  if (item.role) {
    if (!auth.user) return false;
    if (!auth.isAdmin && !auth.hasRole(item.role)) return false;
  }
  return true;
}
let items = [];
function registerNavItems(navItems) {
  items = navItems;
}
function getNavItems() {
  return items;
}
function __clearNavItems() {
  items = [];
}
export {
  __clearNavItems,
  getNavItems,
  isNavItemVisible,
  registerNavItems
};
//# sourceMappingURL=navRegistry.js.map
