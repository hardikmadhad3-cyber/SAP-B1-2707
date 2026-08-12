# Project Guidance

This project aims to reproduce SAP Business One behavior reliably across multiple companies. Treat every change as multi-company work, not a one-company workaround.

When fixing a document-page issue:
- Check whether the same pattern exists on related pages such as Sales Quotation, Sales Order, Delivery, A/R Invoice, A/R Credit Memo, A/P Invoice, A/P Credit Memo, Purchase Order, and GRPO.
- Prefer shared SAP B1 utilities for behavior like numbering series, branch filtering, fiscal periods, UDFs, copy-from/copy-to, document lines, currency, tax, and warehouse validation.
- Numbering series must follow SAP B1 context: object code, posting date/fiscal period, locked status, default series, branch assignment, document subtype, and number range. Avoid showing old or unrelated company series just because they exist in `NNM1`.
- Keep logic tolerant of schema differences between SAP B1 companies. Use metadata checks before referencing optional columns such as `BPLId`, `DocSubType`, `BeginStr`, `EndStr`, `LastNum`, `DfltSeries`, or `DfltSerie`.
- If one page is fixed, search for the same issue elsewhere and update shared code or sibling pages where appropriate.

Act as a senior full-stack engineer with SAP B1 functional knowledge: verify existing patterns first, make scoped reliable changes, and test the behavior that was fixed.
