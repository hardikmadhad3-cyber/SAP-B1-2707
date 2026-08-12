import React from 'react';
import InventoryDocumentFindPage from '../components/InventoryDocumentFindPage';
import { searchJournalEntries } from '../api/journalEntryApi';

const columns = [
  { key: 'transId', label: 'Transaction No.' },
  { key: 'docNum', label: 'Number' },
  { key: 'postingDate', label: 'Posting Date', type: 'date' },
  { key: 'dueDate', label: 'Due Date', type: 'date' },
  { key: 'documentDate', label: 'Document Date', type: 'date' },
  { key: 'remarks', label: 'Remarks' },
  { key: 'reference1', label: 'Ref. 1' },
  { key: 'reference2', label: 'Ref. 2' },
  { key: 'totalDebit', label: 'Total Debit', align: 'end' },
  { key: 'totalCredit', label: 'Total Credit', align: 'end' },
];

const filterFields = [
  { name: 'transId', key: 'transId', label: 'Transaction No.', placeholder: 'Enter Transaction No.' },
  { name: 'docNum', key: 'docNum', label: 'Number', placeholder: 'Enter Number' },
  { name: 'remarks', key: 'remarks', label: 'Remarks', placeholder: 'Remarks' },
  { name: 'postingDateFrom', key: 'postingDate', label: 'Posting Date From', type: 'date', compare: 'from' },
  { name: 'postingDateTo', key: 'postingDate', label: 'Posting Date To', type: 'date', compare: 'to' },
];

const fetchDocuments = async () => {
  const rows = await searchJournalEntries('');
  return (rows || []).map((row) => ({
    ...row,
    docEntry: row.transId || row.docEntry,
    docNum: row.docNum || row.number || '',
  }));
};

export default function JournalEntryList() {
  return (
    <InventoryDocumentFindPage
      title="Journal Entries"
      subtitle="Filter by transaction, number, remarks, and posting date."
      backPath="/journal-entry"
      fetchDocuments={fetchDocuments}
      editPath="/journal-entry"
      editStateKey="journalEntryTransId"
      emptyLabel="journal entries"
      loadingLabel="Loading journal entries..."
      columns={columns}
      filterFields={filterFields}
      globalSearchPlaceholder="Search by transaction no, number, remarks, references, or date"
      searchFields={['transId', 'docNum', 'number', 'remarks', 'reference1', 'reference2', 'reference3', 'postingDate', 'dueDate', 'documentDate']}
    />
  );
}
