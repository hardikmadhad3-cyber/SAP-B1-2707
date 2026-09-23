import SapLookupModal from './SapLookupModal';

/**
 * G/L Account picker — same popup/Select pattern as BusinessPartnerModal
 * (backed by the same generic SapLookupModal engine), just for OACT accounts
 * instead of business partners. `accounts` is the already-fetched list
 * (shape `{ code, name, postable }`, see itemDbService.getGLAccounts).
 */
export default function AccountLookupModal({
  isOpen,
  onClose,
  onSelect,
  accounts = [],
  title = 'List of Accounts',
}) {
  return (
    <SapLookupModal
      open={isOpen}
      title={title}
      columns={[
        { key: 'code', label: 'Account Code', width: 140 },
        { key: 'name', label: 'Account Name' },
        { key: 'postable', label: 'Postable', width: 90 },
      ]}
      rows={accounts}
      onClose={onClose}
      onSelect={onSelect}
      getRowKey={(row, index) => `${row.code || 'account'}-${index}`}
      emptyMessage="No accounts found"
      footerNote={`${accounts.length} accounts`}
    />
  );
}
