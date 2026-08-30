const NO_ACCENT = () => void 0;
const useNoAccent = () => NO_ACCENT;
let registeredHook = null;
function registerRowAccentResolver(hook) {
  registeredHook = hook;
}
function useRowAccentResolver(enabled) {
  const resolver = (registeredHook ?? useNoAccent)();
  return enabled ? resolver : NO_ACCENT;
}
function __clearRowAccentResolver() {
  registeredHook = null;
}
export {
  __clearRowAccentResolver,
  registerRowAccentResolver,
  useRowAccentResolver
};
//# sourceMappingURL=rowAccentRegistry.js.map
