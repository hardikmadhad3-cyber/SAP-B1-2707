> Current identity behavior (9 September 2026): per the user?s revised request, series use an explicit assignment SAP-user override when present, otherwise the selected company?s persisted SapUsername. A separate mapping is optional. Environment fallback credentials are never used to determine series permissions. Historical notes below describing mandatory mappings are superseded by this change.

# SAP B1 document series implementation status

This work is **not ready for deployment or a claim of complete SAP parity**. Shared selection logic, frontend integration, creation validation and number-preview integration are present. The integration patch was applied after explicit user approval.

## Implemented

- Shared metadata-aware marketing-document resolver using authenticated company context and a required mapped SAP user.
- Actual posting-period indicator matching; no fiscal-year/name fallback.
- Default priority: eligible user default, eligible company default, lone eligible series; otherwise explicit selection.
- Locked/exhausted/cancellation/subtype/series-group/branch filtering.
- Explicit manual/default metadata and errors distinct from empty eligibility.
- Shared frontend lookup with stale-response cancellation and company/token/date/branch/subtype scope, plus historical-document protection and explicit New/Duplicate/Copy From refresh counters.

## Applied integration patch

[pending-integration.patch](pending-integration.patch) is retained as the review artifact against the workspace before integration, not HEAD. Source hashes are in [pending-integration.json](pending-integration.json). It has been applied; do not reapply it.

1. Connect the tested write-validation helper to SAP marketing-document POST requests. It rejects stale/missing automatic series, validates manual permission/number, removes automatic DocNum previews and aligns India GST type. GET/PATCH/cancel actions are excluded.
2. Route existing next-number controllers through the shared resolver, preserving URLs, path/query series inputs and the nextNumber response wrapper.
3. Remove the redundant purchase-quotation series loader and replace its three call sites with the shared refresh signal. Inspection confirmed none of the callers uses its returned list.
4. Correct purchase debit memo subtype to DM, remove an unverified refund-voucher alias, restrict inherited rights to authorization/all groups and preserve case-sensitive HANA schema names in metadata cache keys.

The write-validation helper is connected to marketing-document creation in sapService.js. Number-preview routes use the shared resolver, and purchase quotation refresh uses the shared hook. Targeted backend/frontend tests and the production build passed after integration. Missing SAP user mappings are rejected even when a shared Service Layer account is configured.

## Configuration and validation limits

- On 9 September 2026, after the user confirmed the SAP login, web user 1 (manager) was mapped to SAP manager for company 6 (TEST_JKLY_LIVE_161125), assignment 18. Other assignments still require their own verified SAP-user mappings.
- Read-only diagnostics used the actual SAP manager user via an in-memory context override. This establishes no non-superuser parity.
- Non-superuser evaluation reads SAP USR3 and active UGR1 grants, but currently requires SAP_SERIES_PERMISSION_CATALOGUE: JSON containing manual and groups permission identifiers. Those identifiers need verification from the installed SAP SDK permissions list. No verified catalogue is available. Missing identifiers cause a configuration error; IDs must not be guessed.
- No SQL Server company is configured. SQL Server tests use dialect fixtures, not a live server.
- No documents were posted and no SAP numbering/period configuration changed.
- Live branch-restricted/non-superuser parity and multi-document shared-series configurations remain to be validated.
- Some old service initial-reference lookup paths and unused local series helpers remain. Review them before release; the shared hook refreshes after initial loading, but this is not full page-level end-to-end proof.

## Read-only HANA checks: 8 September 2026

55 lookups completed: objects 23,17,15,13,14,22,18,19,20,540000006,1470000113 in five companies. Service invoices/credit memos use the corresponding invoice/credit-memo object codes.

| Company ID | Company | Tested posting date |
| --- | --- | --- |
| 2 | TEST_JKL_29072025 | 2027-03-31 |
| 3 | JKLY_LIVE | 2027-03-31 |
| 4 | JKL_LIVEDB | 2027-03-31 |
| 5 | TEST_AYPL_250725 | 2026-03-31 |
| 6 | TEST_JKLY_LIVE_161125 | 2026-03-31 |

Dates were the final configured posting-period date in each company. Legitimate empty automatic lists and multiple eligible choices were observed.

Company 6 returned sales-order Series 127, JKLYSO25, next number 335 on 2026-03-31. Screenshot date 2026-09-08 returned no eligible series because no posting period covers that date. 335 is only the read-time preview, never a hardcoded expected value.

## Checks and acceptance

Backend resolver/access/write/payload/database-compatibility tests pass. Frontend hook/default tests pass. Targeted ESLint found no errors across the 21 pages and shared utilities. Production build compiled with warnings, including unused imports/helpers. The patch is applied and integrated. Live document creation and complete SAP UI parity remain unverified.

Before acceptance, compare every document family against SAP using identical company, mapped SAP user, posting date, branch and actual subtype. Include non-superusers, multiple branches, manual numbering, empty lists, rapid context switches, historical documents and copy/duplicate target numbering on both database engines. Verify next numbers at comparison time.

## SAP references

- [Period indicators](https://help.sap.com/docs/SAP_BUSINESS_ONE/68a2e87fb29941b5bf959a184d9c6727/4505bc2524a70489e10000000a155369.html)
- [A/P invoice subtypes](https://help.sap.com/doc/089315d8d0f8475a9fc84fb919b501a3/10.0/en-US/SDKHelp/OPCH.html)
- [Authorization groups](https://help.sap.com/doc/089315d8d0f8475a9fc84fb919b501a3/10.0/en-US/SDKHelp/OUGR.html)
- [System permission lookup](https://help.sap.com/doc/089315d8d0f8475a9fc84fb919b501a3/10.0/en-US/SDKHelp/SAPbobsCOM~SBObob~GetSystemPermission.html)

## Quotation follow-up: 9 September 2026

The persisted company-6 mapping was verified. Read-only SAP checks found quotation Series 137, JKLYSQ25, NextNumber 1, indicator FY2025-26. The resolver returns it for 2026-03-31, but returns no series for 2026-09-09 because OFPR has no covering posting period. The SAP screenshot displays that series on an unsaved document; posting acceptance on that date remains unverified. A running backend may retain the old assignment for its five-minute cache TTL; restarting the backend clears it immediately.

## SAP display correction: 9 September 2026

The user supplied a second SAP screenshot confirming JKLYSQ25 and Manual at posting date 2026-09-09. Display lookup now uses the latest configured period indicator when the requested date exceeds the entire configured calendar. This reproduces the observed company behavior; it is not evidence of universal SAP parity. It never guesses from series names, fills internal calendar gaps, or bypasses branch, subtype, permission, lock or range filters. All series in that display period remain available. Creation explicitly resolves with purpose=posting and still requires the actual posting period. Responses expose postingPeriodValid, periodContextSource and per-series PostingEligible separately from display eligibility.

Live HANA checks with the persisted manager mapping returned quotation JKLYSQ25/1 and order JKLYSO25/335 for 2026-09-09, with Manual available and no lookup error. Eleven document objects were checked; purchase quotation/request had no automatic series in that period. Full SAP UI comparisons for other families and live SQL Server checks remain outstanding. Earlier notes describing an empty display list on this date refer to the superseded behavior.

## Company-configured SAP identity

The company?s configured SAP account now supplies numbering permissions/defaults when a user assignment has no override. The admin assignment form permits blank overrides and validates the company SAP login against its own OUSR table. Explicit overrides still take priority; missing/locked users and database errors remain errors. This does not change web-login authentication or authenticate each web user directly against SAP.

59 targeted backend tests passed. Live read-only checks using persisted configuration, without in-memory user overrides, returned quotation series successfully in all five active assigned HANA companies on 2026-09-09: JKL_LIVEDB JKLSQ26/10023, TEST_JKL_29072025 JKLSQ26/10004, JKLY_LIVE JKLYSQ26/5, TEST_AYPL_250725 AYPLSQ25/10001, TEST_JKLY_LIVE_161125 JKLYSQ25/1. These are read-time previews. New companies require their database and SAP connection configuration; no company-specific series code or names are needed. Non-superuser permission catalogue and live SQL Server validation limitations remain.
