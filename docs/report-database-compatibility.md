# Report database compatibility

Validated on 2026-09-07.

The report backend now uses ranked LEFT JOINs for latest opportunity stages, groups won-opportunity buckets through a derived table, and scopes metadata to the connection and request. HANA catalog translation includes views such as OINM. Report fixes also cover campaign property columns, financial text conversions, and optional purchase-request fields.

## Validation

- JKL TEST (company 2): 111 read-only report and lookup checks passed, zero query errors.
- TEST_AYPL_250725 (company 5): 111 read-only report and lookup checks passed, zero query errors.
- Checks include default reports, lookup calls, sales and purchase document/period variants, system currency, inventory property filters, and purchase-request optional filters. Query failures caught internally by services were also recorded; none remained.
- 31 regression tests passed across reportDatabaseCompatibility, billOfMaterialsReport, databaseCompatibility, salesDocumentDbCompatibility, and dashboardDbService.
- No live SQL Server connection was configured. As requested, live validation used only HANA. SQL Server-compatible query syntax is retained, with automated coverage; live SQL Server execution remains unverified.
- These checks verify backend execution for the tested criteria, not every possible filter combination or reconciliation of report totals with SAP B1.

Run automated checks from the project root:

```powershell
node --test backend/test/reportDatabaseCompatibility.test.js backend/test/billOfMaterialsReport.test.js backend/test/databaseCompatibility.test.js backend/test/salesDocumentDbCompatibility.test.js backend/test/dashboardDbService.test.js
```

The local read-only validation harness and detailed results are in .report-transfer-backups. No SAP records or company settings were written.

HANA view metadata fields were checked against [SAP's VIEW_COLUMNS reference](https://help.sap.com/docs/PRODUCT_ID/4fe29514fd584807ac9f2a04f6754767/21028f17751910149faef9996f9e43ea.html).
