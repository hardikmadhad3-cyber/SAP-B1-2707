import {
  buildSalesOrderMatrixColumnsFromLayout,
  buildSalesOrderMatrixColumnsFromSchema,
  buildSalesOrderRowUdfDefinitionsFromSchema,
  mapLiveSalesOrderMatrixToLayout,
} from './documentLayout';

describe('buildSalesOrderMatrixColumnsFromLayout', () => {
  it('keeps Item No. on the standard item lookup renderer when SAP layout marks it as a UDF column', () => {
    const [itemColumn] = buildSalesOrderMatrixColumnsFromLayout({
      includeLineNumber: false,
      layoutColumns: [
        {
          fieldName: 'U_ItemCode',
          columnUid: 'U_ItemCode',
          columnTitle: 'Item No.',
          columnOrder: 1,
          width: 160,
          dataType: 'string',
          isUdf: true,
        },
      ],
      liveMatrixColumns: [
        {
          key: 'itemNo',
          label: 'Item No.',
          sapField: 'ItemCode',
          minWidth: 160,
        },
      ],
      rowUdfFields: [
        {
          key: 'U_ItemCode',
          label: 'Item No.',
          type: 'select',
          options: ['A0001', 'A0002'],
        },
      ],
    });

    expect(itemColumn).toMatchObject({
      key: 'itemNo',
      valueKey: 'itemNo',
      rendererKey: 'itemNo',
      isUdf: false,
      type: 'text',
    });
    expect(itemColumn.options).toBeUndefined();
  });

  it('does not append schema-only columns when SAP layout fallback is authoritative', () => {
    const columns = buildSalesOrderMatrixColumnsFromLayout({
      includeLineNumber: false,
      layoutColumns: [
        {
          fieldName: 'ItemCode',
          columnUid: '1',
          columnTitle: 'Item No.',
          columnOrder: 1,
          width: 160,
          dataType: 'string',
        },
      ],
      liveMatrixColumns: [
        {
          key: 'itemNo',
          valueKey: 'itemNo',
          rendererKey: 'itemNo',
          fieldName: 'ItemCode',
          label: 'Item No.',
          sapField: 'ItemCode',
          minWidth: 160,
          schemaDriven: true,
        },
        {
          key: 'U_AgentMaster',
          valueKey: 'U_AgentMaster',
          rendererKey: 'U_AgentMaster',
          fieldName: 'U_AgentMaster',
          label: 'Agent Master',
          sapField: 'U_AgentMaster',
          isUdf: true,
          schemaDriven: true,
          lookupSource: 'udf:RDR1:U_AgentMaster',
        },
      ],
      rowUdfFields: [
        {
          key: 'U_AgentMaster',
          label: 'Agent Master',
          type: 'lookup',
          lookupSource: 'udf:RDR1:U_AgentMaster',
        },
      ],
    });

    expect(columns.map((column) => column.valueKey)).toEqual(['itemNo']);
  });

  it('can append missing live schema columns only when explicitly enabled', () => {
    const columns = buildSalesOrderMatrixColumnsFromLayout({
      appendMissingLiveColumns: true,
      includeLineNumber: false,
      layoutColumns: [
        {
          fieldName: 'ItemCode',
          columnUid: '1',
          columnTitle: 'Item No.',
          columnOrder: 1,
          width: 160,
          dataType: 'string',
        },
      ],
      liveMatrixColumns: [
        {
          key: 'itemNo',
          valueKey: 'itemNo',
          rendererKey: 'itemNo',
          fieldName: 'ItemCode',
          label: 'Item No.',
          sapField: 'ItemCode',
          minWidth: 160,
          schemaDriven: true,
        },
        {
          key: 'U_AgentMaster',
          valueKey: 'U_AgentMaster',
          rendererKey: 'U_AgentMaster',
          fieldName: 'U_AgentMaster',
          label: 'Agent Master',
          sapField: 'U_AgentMaster',
          isUdf: true,
          schemaDriven: true,
          lookupSource: 'udf:RDR1:U_AgentMaster',
        },
      ],
      rowUdfFields: [
        {
          key: 'U_AgentMaster',
          label: 'Agent Master',
          type: 'lookup',
          lookupSource: 'udf:RDR1:U_AgentMaster',
        },
      ],
    });

    expect(columns.map((column) => column.valueKey)).toEqual(['itemNo', 'U_AgentMaster']);
  });

  it('pins the line number column first even when SAP layout places it later', () => {
    const columns = buildSalesOrderMatrixColumnsFromLayout({
      layoutColumns: [
        {
          fieldName: 'ItemCode',
          columnUid: '1',
          columnTitle: 'Item No.',
          columnOrder: 1,
          width: 160,
        },
        {
          fieldName: 'LineNum',
          columnUid: '0',
          columnTitle: '#',
          columnOrder: 25,
          width: 55,
        },
      ],
      liveMatrixColumns: [
        { key: 'itemNo', fieldName: 'ItemCode', label: 'Item No.' },
        { key: '__lineNumber', fieldName: 'LineNum', label: '#', order: 25 },
      ],
    });

    const sorted = [...columns].sort((left, right) => Number(left.order) - Number(right.order));
    expect(sorted[0]).toMatchObject({
      key: '__lineNumber',
      valueKey: '__lineNumber',
      rendererKey: '__lineNumber',
      label: '#',
      order: -10000,
      readOnly: true,
    });
  });

  it('deduplicates live schema columns that resolve to the same SAP display title', () => {
    const columns = buildSalesOrderMatrixColumnsFromLayout({
      includeLineNumber: false,
      layoutColumns: [],
      liveMatrixColumns: [
        {
          key: 'uomName',
          valueKey: 'uomName',
          fieldName: 'unitMsr',
          label: 'UoM Name',
          schemaDriven: true,
        },
        {
          key: 'uomCode',
          valueKey: 'uomCode',
          fieldName: 'UomCode',
          label: 'UoM Name',
          schemaDriven: true,
        },
        {
          key: 'hsnCode',
          valueKey: 'hsnCode',
          fieldName: 'HsnEntry',
          label: 'HSN',
          schemaDriven: true,
        },
      ],
    });

    expect(columns.map((column) => column.label)).toEqual(['UoM Name', 'HSN']);
  });

  it('adds and pins the SAP row number when a live matrix response omits it', () => {
    const columns = buildSalesOrderMatrixColumnsFromLayout({
      layoutColumns: [],
      liveMatrixColumns: [
        { key: 'itemNo', fieldName: 'ItemCode', label: 'Item No.', order: 1 },
      ],
    });

    expect(columns.map((column) => column.label)).toEqual(['#', 'Item No.']);
    expect(columns[0]).toMatchObject({
      key: '__lineNumber',
      readOnly: true,
      active: false,
      order: -10000,
    });
  });

  it('preserves live SAP matrix order and visibility when adapting it to layout metadata', () => {
    const layout = mapLiveSalesOrderMatrixToLayout([
      { key: 'quantity', sapField: 'Quantity', label: 'Quantity', order: 4, visible: true, active: true },
      { key: 'unitPrice', sapField: 'Price', label: 'Unit Price', order: 5, visible: true, active: true },
      { key: 'U_CostSheet', sapField: 'U_CostSheet', label: 'Cost-Sheet', order: 13, visible: true, active: true, isUdf: true },
    ]);

    expect(layout.map((column) => column.columnTitle)).toEqual(['Quantity', 'Unit Price', 'Cost-Sheet']);
    expect(layout.map((column) => column.columnOrder)).toEqual([4, 5, 13]);
    expect(layout[2]).toMatchObject({ fieldName: 'U_CostSheet', isUdf: true, source: 'live-sap-metadata' });
  });
});

describe('buildSalesOrderMatrixColumnsFromSchema', () => {
  it('keeps SAP schema order and maps layout-only standard fields to stable render keys', () => {
    const columns = buildSalesOrderMatrixColumnsFromSchema({
      schemaLineFields: [
        { id: 'RDR1.Quantity', stateKey: 'quantity', sapField: 'Quantity', databaseField: 'Quantity', tableName: 'RDR1', label: 'Quantity', storage: 'standard', type: 'number', renderer: 'number', visible: true, editable: true, order: 1 },
        { id: 'RDR1.Price', stateKey: 'unitPrice', sapField: 'UnitPrice', databaseField: 'Price', tableName: 'RDR1', label: 'Unit Price', storage: 'standard', type: 'number', renderer: 'number', visible: true, editable: true, order: 2 },
        { id: 'RDR1.VatGroup', stateKey: 'taxCode', sapField: 'TaxCode', databaseField: 'VatGroup', tableName: 'RDR1', label: 'Tax Code', storage: 'standard', type: 'lookup', renderer: 'lookup', visible: true, editable: true, order: 3, lookup: { source: 'tax-codes' } },
        { id: 'RDR1.GTotal', stateKey: 'grossTotal', sapField: 'GrossTotal', databaseField: 'GTotal', tableName: 'RDR1', label: 'Total (Doc)', storage: 'calculated', type: 'number', renderer: 'number', visible: true, editable: false, readOnly: true, order: 4 },
        { id: 'RDR1.TrnsCode', stateKey: 'lineShippingType', sapField: 'ShippingMethod', databaseField: 'TrnsCode', tableName: 'RDR1', label: 'Shipping Type', storage: 'standard', type: 'lookup', renderer: 'lookup', visible: true, editable: true, order: 5, lookup: { source: 'shipping-types' } },
        { id: 'RDR1.TaxOnly', stateKey: 'taxLiable', sapField: 'TaxOnly', databaseField: 'TaxOnly', tableName: 'RDR1', label: 'Tax Liable', storage: 'standard', type: 'checkbox', renderer: 'checkbox', visible: true, editable: true, order: 6 },
        { id: 'RDR1.VatSum', stateKey: 'taxAmount', sapField: 'TaxAmount', databaseField: 'VatSum', tableName: 'RDR1', label: 'Tax Amount (Doc)', storage: 'calculated', type: 'number', renderer: 'number', visible: true, editable: false, readOnly: true, order: 7 },
        { id: 'RDR1.unitMsr', stateKey: 'unitMsr', sapField: 'unitMsr', databaseField: 'unitMsr', tableName: 'RDR1', label: 'UoM Name', storage: 'display-only', type: 'text', renderer: 'text', visible: true, editable: false, readOnly: true, order: 8 },
      ],
    });

    expect(columns.map((column) => column.label)).toEqual([
      'Quantity',
      'Unit Price',
      'Tax Code',
      'Total (Doc)',
      'Shipping Type',
      'Tax Liable',
      'Tax Amount (Doc)',
      'UoM Name',
    ]);
    expect(columns.map((column) => column.key)).toEqual([
      'quantity',
      'unitPrice',
      'taxCode',
      'grossTotal',
      'lineShippingType',
      'taxLiable',
      'taxAmount',
      'uomName',
    ]);
    expect(columns[4]).toMatchObject({
      lookupSource: 'shipping-types',
      writableStandardField: true,
      serviceLayerField: 'ShippingMethod',
    });
    expect(columns[5]).toMatchObject({
      type: 'checkbox',
      writableStandardField: true,
      serviceLayerField: 'TaxOnly',
    });
  });

  it('maps writable live standard RDR1 fields to Sales Order payload keys and keeps calculated fields read-only', () => {
    const columns = buildSalesOrderMatrixColumnsFromSchema({
      schemaLineFields: [
        {
          id: 'RDR1.WhsCode',
          stateKey: 'warehouseCode',
          sapField: 'WarehouseCode',
          databaseField: 'WhsCode',
          tableName: 'RDR1',
          label: 'Warehouse',
          storage: 'standard',
          type: 'lookup',
          visible: true,
          editable: true,
          order: 10,
          lookup: { source: 'warehouses' },
        },
        {
          id: 'RDR1.LineTotal',
          stateKey: 'lineTotal',
          sapField: 'LineTotal',
          databaseField: 'LineTotal',
          tableName: 'RDR1',
          label: 'Total',
          storage: 'calculated',
          type: 'number',
          visible: true,
          editable: false,
          readOnly: true,
          order: 20,
        },
      ],
    });

    expect(columns[0]).toMatchObject({
      key: 'whse',
      valueKey: 'whse',
      rendererKey: 'whse',
      readOnly: false,
      active: true,
      schemaDriven: true,
      writableStandardField: true,
      serviceLayerField: 'WarehouseCode',
      payloadKey: 'whse',
    });
    expect(columns[1]).toMatchObject({
      key: 'totalLC',
      valueKey: 'totalLC',
      readOnly: true,
      active: false,
      schemaDriven: true,
      writableStandardField: false,
    });
  });

  it('turns live RDR1 UDF schema fields into editable matrix columns with Sales Order lookup sources', () => {
    const schemaFields = [
      {
        id: 'RDR1.U_PackingType',
        stateKey: 'U_PackingType',
        sapField: 'U_PackingType',
        tableName: 'RDR1',
        label: 'Packing Type',
        storage: 'udf',
        type: 'lookup',
        renderer: 'lookup',
        visible: true,
        editable: true,
        order: 23,
        width: 150,
        lookup: { source: 'udf-linked-table', fieldId: 'RDR1.U_PackingType' },
        linkedTable: '@PACK_TYPES',
      },
    ];
    const rowUdfs = buildSalesOrderRowUdfDefinitionsFromSchema(schemaFields);
    const columns = buildSalesOrderMatrixColumnsFromSchema({
      schemaLineFields: schemaFields,
      rowUdfFields: rowUdfs,
    });

    expect(rowUdfs[0]).toMatchObject({
      key: 'U_PackingType',
      lookupSource: 'udf:RDR1:U_PackingType',
      lookupTable: '@PACK_TYPES',
      sapControlled: true,
    });
    expect(columns[0]).toMatchObject({
      key: 'U_PackingType',
      valueKey: 'U_PackingType',
      isUdf: true,
      schemaDriven: true,
      lookupSource: 'udf:RDR1:U_PackingType',
      field: expect.objectContaining({ key: 'U_PackingType' }),
    });
  });
});
