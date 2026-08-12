export const NEW_SALES_ORDER_ENABLED = process.env.VITE_NEW_SALES_ORDER_ENABLED === 'true';
export const NEW_SALES_ORDER_ALLOW_SAP_WRITES = process.env.VITE_NEW_SALES_ORDER_ALLOW_SAP_WRITES === 'true';

export const NEW_SALES_ORDER_DOCUMENT_TYPE = 'SALES_ORDER';
export const NEW_SALES_ORDER_OBJECT_TYPE = '17';
export const NEW_SALES_ORDER_HEADER_TABLE = 'ORDR';
export const NEW_SALES_ORDER_LINE_TABLE = 'RDR1';

export const NEW_SALES_ORDER_TABS = [
  'Contents',
  'Logistics',
  'Accounting',
  'Tax',
  'Electronic Documents',
  'Attachments',
];

export {
  SALES_DOCUMENT_SCHEMA_LOOKUP_LIMIT as NEW_SALES_ORDER_LOOKUP_LIMIT,
  SALES_DOCUMENT_SCHEMA_LOOKUP_SOURCES as NEW_SALES_ORDER_LOOKUP_SOURCES,
} from '../../utils/salesDocumentSchema';

export const NEW_SALES_ORDER_TEST_BANNER = 'TEST MODE \u2014 SAP WRITES DISABLED';
export const NEW_SALES_ORDER_SUBTITLE = 'Dynamic Company Field Test Page';
export const NEW_SALES_ORDER_WARNING =
  'This is an isolated testing page. Saving creates a local dummy draft only and does not create a document in SAP Business One.';
