import { filterWarehousesByBranch } from './warehouseBranch';

describe('filterWarehousesByBranch', () => {
  const warehouses = [
    { WhsCode: 'MAIN', BPLId: '' },
    { WhsCode: 'B1', BPLId: 1 },
    { WhsCode: 'B2', BPLId: 2 },
  ];

  test('returns a stable filtered collection for the same company list and branch', () => {
    const first = filterWarehousesByBranch(warehouses, 1);
    const second = filterWarehousesByBranch(warehouses, '1');

    expect(second).toBe(first);
    expect(first.map((warehouse) => warehouse.WhsCode)).toEqual(['MAIN', 'B1']);
  });

  test('keeps separate cached results for different branches', () => {
    const branchOne = filterWarehousesByBranch(warehouses, 1);
    const branchTwo = filterWarehousesByBranch(warehouses, 2);

    expect(branchTwo).not.toBe(branchOne);
    expect(branchTwo.map((warehouse) => warehouse.WhsCode)).toEqual(['MAIN', 'B2']);
  });

  test('returns the original list when no branch is selected', () => {
    expect(filterWarehousesByBranch(warehouses, '')).toBe(warehouses);
  });
});
