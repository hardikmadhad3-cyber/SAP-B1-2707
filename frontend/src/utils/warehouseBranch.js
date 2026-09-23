const warehouseBranchFilterCache = new WeakMap();

export const getWarehouseBranchId = (warehouse = {}) => {
  if (!warehouse || typeof warehouse !== "object") return "";

  return (
    warehouse.BranchID ??
    warehouse.BPLId ??
    warehouse.BPLID ??
    warehouse.Branch ??
    warehouse.branchId ??
    ""
  );
};

export const filterWarehousesByBranch = (warehouses = [], branchId = "") => {
  const warehouseList = Array.isArray(warehouses) ? warehouses : [];
  const normalizedBranchId = String(branchId || "").trim();
  if (!normalizedBranchId) return warehouseList;

  let branchCache = warehouseBranchFilterCache.get(warehouseList);
  if (!branchCache) {
    branchCache = new Map();
    warehouseBranchFilterCache.set(warehouseList, branchCache);
  }
  if (branchCache.has(normalizedBranchId)) {
    return branchCache.get(normalizedBranchId);
  }

  const filteredWarehouses = warehouseList.filter((warehouse) => {
    const warehouseBranchId = String(getWarehouseBranchId(warehouse) || "").trim();
    return !warehouseBranchId || warehouseBranchId === normalizedBranchId;
  });
  branchCache.set(normalizedBranchId, filteredWarehouses);
  return filteredWarehouses;
};
