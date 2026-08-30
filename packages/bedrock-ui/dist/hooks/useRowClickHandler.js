import { useFlyoutStore } from "../store/flyoutStore.js";
function useRowClickHandler(config, visibleRows) {
  const { openFlyout } = useFlyoutStore();
  return function handleRowClick(row, index) {
    const { player_id } = row.original;
    if (!player_id) return;
    const flatRows = visibleRows.map((r) => ({
      player_id: r.original.player_id,
      full_name: String(r.original.full_name ?? "")
    }));
    openFlyout(player_id, index, flatRows, config.readOnly === 1);
  };
}
export {
  useRowClickHandler
};
//# sourceMappingURL=useRowClickHandler.js.map
