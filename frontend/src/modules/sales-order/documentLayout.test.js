import {
  buildSalesOrderMatrixColumnsFromLayout,
  buildSalesOrderMatrixColumnsFromSchema,
  buildSalesOrderRowUdfDefinitionsFromSchema,
  getSapStandardSalesMatrixColumns,
  makeSalesOrderHsnColumnEditable,
  mapLiveSalesOrderMatrixToLayout,
} from './documentLayout';

describe('SAP standard matrix fallback', () => {
  it('contains only SAP standard columns and no company UDFs', () => {
    const columns = getSapStandardSalesMatrixColumns();

    expect(columns.length).toBeGreaterThan(0);
    expect(columns.some((column) => String(column.key).toUpperCase().startsWith('U_'))).toBe(false);
    expect(columns.map((column) => column.key)).toEqual(expect.arrayContaining([
      '__lineNumber',
      'itemNo',
      'itemDescription',
      'quantity',
      'unitPrice',
      'taxCode',
      'whse',
      'totalLC',
      'grossTotal',
    ]));
  });

  it('returns fresh column objects so page state cannot mutate the shared fallback', () => {
    const first = getSapStandardSalesMatrixColumns();
    first[0].visible = false;

    expect(getSapStandardSalesMatrixColumns()[0].visible).toBe(true);
  });
});

describe('Sales Order editable HSN column', () => {
  it('overrides a locked SAP layout HSN field without changing other fields', () => {
    const columns = makeSalesOrderHsnColumnEditable([
      { key: 'hsnCode', active: false, readOnly: true, editable: false },
      { key: 'totalLC', active: false, readOnly: true, editable: false },
    ]);

    expect(columns[0]).toEqual(expect.objectContaining({
      key: 'hsnCode',
      active: true,
      readOnly: false,
      editable: true,
    }));
    expect(columns[1]).toEqual(expect.objectContaining({
      key: 'totalLC',
      active: false,
      readOnly: true,
      editable: false,
    }));
  });
});

describe('buildSalesOrderMatrixColumnsFromLayout', () => {
  it('resolves calculated SAP captions when Form Settings supplies numeric control UIDs', () => {
    // These arbitrary numeric values exercise caption resolution; they are not
    // asserted SAP B1 column IDs.
    const columns = buildSalesOrderMatrixColumnsFromLayout({
      includeLineNumber: false,
      layoutColumns: [
        { columnUid: '160', fieldName: '160', columnTitle: 'Tax Code', columnOrder: 6, visible: true, editable: true },
        { columnUid: '17', fieldName: '17', columnTitle: 'Total (Doc)', columnOrder: 7, visible: true, editable: false },
        { columnUid: '29', fieldName: '29', columnTitle: 'COGS Distr. Rule', columnOrder: 10, visible: true, editable: false },
        { columnUid: '900000001', fieldName: '900000001', columnTitle: 'In Stock', columnOrder: 29, visible: true, editable: false },
        { columnUid: '1470002145', fieldName: '1470002145', columnTitle: 'UoM Name', columnOrder: 30, visible: true, editable: false },
        { columnUid: '900000002', fieldName: '900000002', columnTitle: 'Qty in Whse', columnOrder: 31, visible: true, editable: false },
      ],
    });

    expect(columns.map(({ key, order }) => [key, order])).toEqual([
      ['taxCode', 6],
      ['grossTotal', 7],
      ['cogsDistRule', 10],
      ['inStock', 29],
      ['uomName', 30],
      ['qtyInWhse', 31],
    ]);
    expect(columns.slice(1)).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'grossTotal', readOnly: true }),
      expect.objectContaining({ key: 'inStock', readOnly: true }),
      expect.objectContaining({ key: 'uomName', readOnly: false, active: true }),
      expect.objectContaining({ key: 'qtyInWhse', readOnly: true }),
    ]));
  });

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

  it('keeps the line number order supplied by the live SAP layout', () => {
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

    const lineNumber = columns.find((column) => column.key === '__lineNumber');
    expect(lineNumber).toMatchObject({
      key: '__lineNumber',
      valueKey: '__lineNumber',
      rendererKey: '__lineNumber',
      label: '#',
      order: 25,
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

  it('uses the visible SAP caption before a stale physical UID when resolving Unit Price', () => {
    const [unitPrice] = buildSalesOrderMatrixColumnsFromLayout({
      includeLineNumber: false,
      layoutColumns: [{
        fieldName: 'ShipDate',
        columnUid: '14',
        columnTitle: 'Unit Price',
        visible: true,
        editable: true,
        columnOrder: 1,
        dataType: 'date',
        source: 'live-sap-metadata',
      }],
      liveMatrixColumns: [{
        key: 'unitPrice',
        label: 'Unit Price',
        sapField: 'Price',
        type: 'number',
        numeric: true,
        sapControlled: true,
      }],
    });

    expect(unitPrice).toMatchObject({
      key: 'unitPrice',
      type: 'number',
      numeric: true,
      label: 'Unit Price',
      active: true,
    });
  });

  it('keeps SAP Active true for a read-only display field', () => {
    const [total] = buildSalesOrderMatrixColumnsFromLayout({
      includeLineNumber: false,
      layoutColumns: [{
        fieldName: 'LineTotal',
        columnTitle: 'Total',
        visible: true,
        editable: true,
        columnOrder: 1,
        dataType: 'number',
        source: 'live-sap-metadata',
      }],
    });

    expect(total).toMatchObject({
      key: 'totalLC',
      active: true,
      readOnly: true,
    });
  });

  it('keeps payload-backed SAP line fields editable when Form Settings marks them Active', () => {
    const columns = buildSalesOrderMatrixColumnsFromLayout({
      includeLineNumber: false,
      layoutColumns: [
        { fieldName: 'CogsOcrCod', columnTitle: 'COGS Distr. Rule', visible: true, editable: true, columnOrder: 1 },
        { fieldName: 'AcctCode', columnTitle: 'G/L Account', visible: true, editable: true, columnOrder: 2 },
        { fieldName: 'WtLiable', columnTitle: 'WTax Liable', visible: true, editable: true, columnOrder: 3 },
        { fieldName: 'AgrNo', columnTitle: 'Blanket Agreement No.', visible: true, editable: true, columnOrder: 4 },
        { fieldName: 'Commission', columnTitle: 'Comm. %', visible: true, editable: true, columnOrder: 5 },
        { fieldName: 'NoInvtryMv', columnTitle: 'Without Qty Posting', visible: true, editable: true, columnOrder: 6 },
        { fieldName: 'LocCode', columnTitle: 'Loc.', visible: true, editable: true, columnOrder: 7 },
      ],
    });

    expect(columns.map((column) => ({
      key: column.key,
      serviceLayerField: column.serviceLayerField,
      active: column.active,
      readOnly: column.readOnly,
    }))).toEqual([
      { key: 'cogsDistRule', serviceLayerField: 'COGSCostingCode', active: true, readOnly: false },
      { key: 'glAccount', serviceLayerField: 'AccountCode', active: true, readOnly: false },
      { key: 'wTaxLiable', serviceLayerField: 'WTLiable', active: true, readOnly: false },
      { key: 'blanketAgreementNo', serviceLayerField: 'AgreementNo', active: true, readOnly: false },
      { key: 'commPercent', serviceLayerField: 'CommissionPercent', active: true, readOnly: false },
      { key: 'withoutQtyPosting', serviceLayerField: 'WithoutInventoryMovement', active: true, readOnly: false },
      { key: 'loc', serviceLayerField: 'LocationCode', active: true, readOnly: false },
    ]);
  });

  it('does not collapse U_Description into the standard Item Description column', () => {
    const columns = buildSalesOrderMatrixColumnsFromLayout({
      includeLineNumber: false,
      layoutColumns: [
        { fieldName: 'Dscription', columnTitle: 'Item Description', visible: true, editable: true, columnOrder: 2 },
        { fieldName: 'U_Description', columnTitle: 'Description', visible: true, editable: true, columnOrder: 44, isUdf: true },
      ],
      rowUdfFields: [
        { key: 'U_Description', sapField: 'U_Description', label: 'Description', type: 'text' },
      ],
    });

    expect(columns.map((column) => [column.key, column.label, column.order])).toEqual([
      ['itemDescription', 'Item Description', 2],
      ['U_Description', 'Description', 44],
    ]);
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

  it('maps a live QUT1 ReqDate column to editable Service Layer RequiredDate', () => {
    const [requiredDate] = buildSalesOrderMatrixColumnsFromSchema({
      lineTable: 'QUT1',
      schemaLineFields: [{
        id: 'QUT1.ReqDate',
        stateKey: 'requiredDate',
        sapField: 'RequiredDate',
        databaseField: 'ReqDate',
        tableName: 'QUT1',
        label: 'Required Date',
        storage: 'standard',
        type: 'date',
        renderer: 'date',
        visible: true,
        editable: true,
        order: 10,
      }],
    });

    expect(requiredDate).toMatchObject({
      key: 'requiredDate',
      type: 'date',
      readOnly: false,
      active: true,
      writableStandardField: true,
      serviceLayerField: 'RequiredDate',
      payloadKey: 'requiredDate',
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

  it('uses the requested document line table for dynamic UDF lookups', () => {
    const schemaFields = [{
      id: 'INV1.U_Source',
      stateKey: 'U_Source',
      sapField: 'U_Source',
      tableName: 'INV1',
      label: 'Source',
      storage: 'udf',
      type: 'lookup',
      visible: true,
      editable: true,
      lookup: { source: 'udf-linked-table', fieldId: 'INV1.U_Source' },
      linkedTable: '@SOURCE',
    }];
    const rowUdfs = buildSalesOrderRowUdfDefinitionsFromSchema(schemaFields, { lineTable: 'INV1' });
    const [column] = buildSalesOrderMatrixColumnsFromSchema({
      schemaLineFields: schemaFields,
      rowUdfFields: rowUdfs,
      lineTable: 'INV1',
    });

    expect(rowUdfs[0].lookupSource).toBe('udf:INV1:U_Source');
    expect(column.lookupSource).toBe('udf:INV1:U_Source');
  });
});
