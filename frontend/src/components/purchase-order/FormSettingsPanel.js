import React from 'react';

const getFieldIdentityTokens = (field = {}) => [
  field.key,
  field.valueKey,
  field.rendererKey,
  field.fieldName,
  field.sapField,
  field.aliasId,
]
  .map((value) => String(value || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, ''))
  .filter(Boolean);

export const filterDuplicateRowUdfFields = (matrixFields = [], rowUdfFields = []) => {
  const matrixTokens = new Set((matrixFields || []).flatMap(getFieldIdentityTokens));
  return (rowUdfFields || []).filter((field) => (
    !getFieldIdentityTokens(field).some((token) => matrixTokens.has(token))
  ));
};

function SettingsSection({
  title,
  fields,
  groupKey,
  formSettings,
  onSettingChange,
  readOnly = false,
  editableProperties = ['visible', 'active'],
  editableSapControlledProperties = ['visible', 'active'],
}) {
  if (!fields.length) {
    return null;
  }

  return (
    <div className="mb-4">
      <h6 className="border-bottom pb-1 mb-2">{title}</h6>

      {[...fields].sort((left, right) => {
        const leftOrder = Number(formSettings[groupKey]?.[left.key]?.order ?? left.order ?? Number.MAX_SAFE_INTEGER);
        const rightOrder = Number(formSettings[groupKey]?.[right.key]?.order ?? right.order ?? Number.MAX_SAFE_INTEGER);
        return leftOrder - rightOrder;
      }).map((field) => {
        const setting = formSettings[groupKey]?.[field.key] || {};
        const isSapControlled = Boolean(field.sapControlled || setting.sapControlled);
        const isPropertyLocked = (property) => (
          readOnly
          || !editableProperties.includes(property)
          || (isSapControlled && !editableSapControlledProperties.includes(property))
        );
        const visibleLocked = isPropertyLocked('visible');
        const activeLocked = isPropertyLocked('active');
        const isVisible = setting.visible !== undefined ? setting.visible !== false : field.visible !== false;
        const isActive = setting.active !== undefined ? setting.active !== false : field.active !== false;
        return (
        <div
          key={field.key}
          className="d-flex justify-content-between align-items-center mb-2"
          title={visibleLocked && activeLocked ? 'Controlled by SAP Form Settings' : undefined}
        >
          <span className="small">{field.label}</span>

          <div className="d-flex gap-2">
            <div className="form-check">
              <input
                type="checkbox"
                className="form-check-input"
                checked={isVisible}
                disabled={visibleLocked}
                onChange={(event) =>
                  onSettingChange(groupKey, field.key, 'visible', event.target.checked)
                }
              />
              <label className="form-check-label small">V</label>
            </div>

            <div className="form-check">
              <input
                type="checkbox"
                className="form-check-input"
                checked={isActive}
                disabled={activeLocked}
                onChange={(event) =>
                  onSettingChange(groupKey, field.key, 'active', event.target.checked)
                }
              />
              <label className="form-check-label small">A</label>
            </div>
          </div>
        </div>
      );})}
    </div>
  );
}

function FormSettingsPanel({
  isOpen,
  onClose,
  matrixFields,
  headerUdfFields,
  rowUdfFields,
  formSettings,
  onSettingChange,
  readOnlyGroups = [],
  editablePropertiesByGroup,
  editableSapControlledGroups = ['matrixColumns', 'headerUdfs', 'rowUdfs'],
  editableSapControlledProperties,
  isRefreshing = false,
  settingsLoaded = true,
  isSaving = false,
  hasUnsavedChanges = false,
  saveError = '',
  onSave,
  settingsScopeLabel = '',
  variant = 'floating',
  className = '',
  style,
}) {
  if (!isOpen) {
    return null;
  }

  const isSidebar = variant === 'sidebar';
  const getEditableSapProperties = (groupKey) => {
    const configuredProperties = editableSapControlledProperties?.[groupKey];
    if (Array.isArray(configuredProperties)) return configuredProperties;
    return editableSapControlledGroups.includes(groupKey) ? ['visible', 'active'] : [];
  };
  const getEditableProperties = (groupKey) => {
    const configuredProperties = editablePropertiesByGroup?.[groupKey];
    return Array.isArray(configuredProperties) ? configuredProperties : ['visible', 'active'];
  };
  const loadingSettings = isRefreshing || !settingsLoaded;
  const uniqueRowUdfFields = filterDuplicateRowUdfFields(matrixFields, rowUdfFields);
  const wrapperClassName = [isSidebar ? 'sap-header-udf-panel' : 'po-form-settings-floating', className]
    .filter(Boolean)
    .join(' ');
  const wrapperStyle = isSidebar
    ? {
        alignSelf: 'stretch',
        display: 'flex',
        width: '100%',
        maxWidth: '100%',
        minWidth: 0,
        height: 'auto',
        minHeight: 0,
        maxHeight: 'none',
        overflow: 'hidden',
        boxSizing: 'border-box',
        ...(style || {}),
      }
    : {
        position: 'fixed',
        top: '172px',
        right: '12px',
        width: '380px',
        maxWidth: 'calc(100vw - 24px)',
        height: 'calc(100vh - 184px)',
        zIndex: 1050,
        overflowY: 'auto',
        paddingBottom: '12px',
        ...style,
      };
  const cardStyle = isSidebar
    ? {
        position: 'static',
        top: 'auto',
      display: 'flex',
      flexDirection: 'column',
      width: '100%',
      height: '100%',
      minHeight: 0,
        maxHeight: '100%',
        overflow: 'hidden',
        background: '#fff',
      }
    : {
        minHeight: '100%',
        borderRadius: '14px',
        border: '1px solid #d7e1ec',
        boxShadow: '0 16px 36px rgba(15, 23, 42, 0.12)',
        background: '#fff',
      };

  return (
    <div className={wrapperClassName} style={wrapperStyle}>
      <div
        className="card p-3 po-udf-sidebar-card"
        style={cardStyle}
      >
        <div className="po-udf-sidebar-header">
          <div>
            <h6 className="mb-1">Form Settings</h6>
            <small className="text-muted">
              {loadingSettings
                ? 'Loading company Form Settings...'
                : `Loaded for ${settingsScopeLabel || 'the selected user and company'}`}
            </small>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Form Settings"
            title="Close"
            className="po-udf-sidebar-close"
          />
        </div>

        <div
          className="po-udf-sidebar-body"
          aria-busy={loadingSettings}
          style={isSidebar ? { flex: '1 1 auto', minHeight: 0, overflowY: 'auto', overflowX: 'hidden' } : undefined}
        >
          {loadingSettings ? (
            <div className="small text-muted py-3">Loading saved visibility before document lines...</div>
          ) : (
            <>
          <SettingsSection
            title="Matrix Columns"
            fields={matrixFields}
            groupKey="matrixColumns"
            formSettings={formSettings}
            onSettingChange={onSettingChange}
            readOnly={readOnlyGroups.includes('matrixColumns')}
            editableProperties={getEditableProperties('matrixColumns')}
            editableSapControlledProperties={getEditableSapProperties('matrixColumns')}
          />
          <SettingsSection
            title="Header UDF Sidebar"
            fields={headerUdfFields}
            groupKey="headerUdfs"
            formSettings={formSettings}
            onSettingChange={onSettingChange}
            readOnly={readOnlyGroups.includes('headerUdfs')}
            editableProperties={getEditableProperties('headerUdfs')}
            editableSapControlledProperties={getEditableSapProperties('headerUdfs')}
          />
          <SettingsSection
            title="Row UDF Columns"
            fields={uniqueRowUdfFields}
            groupKey="rowUdfs"
            formSettings={formSettings}
            onSettingChange={onSettingChange}
            readOnly={readOnlyGroups.includes('rowUdfs')}
            editableProperties={getEditableProperties('rowUdfs')}
            editableSapControlledProperties={getEditableSapProperties('rowUdfs')}
          />
            </>
          )}
        </div>
        {typeof onSave === 'function' ? (
          <div className="border-top pt-3 mt-2">
            {saveError ? (
              <div className="small text-danger mb-2" role="alert">{saveError}</div>
            ) : (
              <div className="small text-muted mb-2" aria-live="polite">
                {isSaving
                  ? 'Saving for this user and company...'
                  : hasUnsavedChanges
                    ? 'Line-field visibility has unsaved changes.'
                    : 'Line-field visibility is saved.'}
              </div>
            )}
            <button
              type="button"
              className="btn btn-primary btn-sm w-100"
              onClick={onSave}
              disabled={loadingSettings || isSaving || !hasUnsavedChanges}
            >
              {isSaving ? 'Saving Fields...' : 'Save Line Fields'}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default FormSettingsPanel;
