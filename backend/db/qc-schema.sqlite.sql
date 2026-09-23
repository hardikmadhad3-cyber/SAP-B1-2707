PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS qc_addons (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  addon_code TEXT NOT NULL UNIQUE,
  addon_name TEXT NOT NULL,
  version TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  description TEXT,
  installed_on TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS qc_document_mappings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  document_type TEXT NOT NULL,
  document_code TEXT NOT NULL,
  qc_workflow TEXT NOT NULL,
  inspection_level TEXT NOT NULL,
  mandatory_inspection INTEGER NOT NULL DEFAULT 0,
  block_outward_if_failed INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(document_type, document_code)
);

CREATE TABLE IF NOT EXISTS qc_parameters (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  parameter_code TEXT NOT NULL UNIQUE,
  parameter_name TEXT NOT NULL,
  parameter_type TEXT NOT NULL,
  uom TEXT,
  test_method TEXT,
  is_ctq INTEGER NOT NULL DEFAULT 0,
  spec_min REAL,
  spec_max REAL,
  spec_target REAL,
  allowed_values TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS qc_workflows (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  workflow_name TEXT NOT NULL UNIQUE,
  workflow_type TEXT NOT NULL,
  trigger_event TEXT NOT NULL,
  assigned_inspector TEXT NOT NULL,
  approval_required TEXT NOT NULL DEFAULT 'No Approval',
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS qc_transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  transaction_no TEXT NOT NULL UNIQUE,
  direction TEXT NOT NULL,
  source_type TEXT NOT NULL,
  source_doc_no TEXT,
  source_doc_entry INTEGER,
  source_line_num INTEGER,
  party_name TEXT,
  item_code TEXT NOT NULL,
  lot_no TEXT,
  quantity REAL NOT NULL,
  uom TEXT,
  inspection_status TEXT NOT NULL DEFAULT 'Open',
  final_decision TEXT NOT NULL DEFAULT 'Pending',
  inspector_name TEXT,
  inspection_date TEXT,
  remarks TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS qc_item_parameter_mappings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  item_code TEXT NOT NULL,
  item_name TEXT,
  parameter_code TEXT NOT NULL,
  parameter_name TEXT,
  instrument_code TEXT,
  instrument_name TEXT,
  uom TEXT,
  parameter_type TEXT,
  rule_name TEXT,
  from_value TEXT,
  to_value TEXT,
  expected_value TEXT,
  is_optional INTEGER NOT NULL DEFAULT 0,
  remarks TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  user_name TEXT,
  document_no TEXT,
  so_num TEXT,
  so_key TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(item_code, parameter_code)
);

CREATE TABLE IF NOT EXISTS qc_instruments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  instrument_code TEXT NOT NULL UNIQUE,
  instrument_name TEXT NOT NULL,
  remarks TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
