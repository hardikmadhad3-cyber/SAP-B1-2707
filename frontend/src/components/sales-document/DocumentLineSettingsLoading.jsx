import React from 'react';

export default function DocumentLineSettingsLoading({ message = 'Loading company line-field settings...' }) {
  return (
    <div
      className="sap-tab-panel"
      role="status"
      aria-live="polite"
      aria-busy="true"
      style={{ minHeight: 120, display: 'grid', placeItems: 'center' }}
    >
      <div className="small text-muted">{message}</div>
    </div>
  );
}
