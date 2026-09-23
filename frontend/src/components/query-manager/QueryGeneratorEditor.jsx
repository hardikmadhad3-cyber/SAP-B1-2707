import React, { useEffect, useState } from 'react';
import ResultsGrid from './ResultsGrid';

const normalizeError = (error, fallback) =>
  error?.response?.data?.message || error?.message || fallback;

const QueryGeneratorEditor = ({ initialQuery, defaultFolderId, folderOptions, onPreview, onSave, onCancel }) => {
  const [queryName, setQueryName] = useState(initialQuery?.queryName || '');
  const [folderId, setFolderId] = useState(initialQuery?.folderId || defaultFolderId || '');
  const [sqlText, setSqlText] = useState(initialQuery?.sqlText || '');
  const [rowLimit, setRowLimit] = useState(initialQuery?.rowLimit || 500);
  const [description, setDescription] = useState(initialQuery?.description || '');
  const [previewResult, setPreviewResult] = useState(null);
  const [previewError, setPreviewError] = useState(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  useEffect(() => {
    setQueryName(initialQuery?.queryName || '');
    setFolderId(initialQuery?.folderId || defaultFolderId || '');
    setSqlText(initialQuery?.sqlText || '');
    setRowLimit(initialQuery?.rowLimit || 500);
    setDescription(initialQuery?.description || '');
    setPreviewResult(null);
    setPreviewError(null);
  }, [initialQuery, defaultFolderId]);

  const handlePreview = async () => {
    setIsPreviewing(true);
    setPreviewError(null);
    try {
      const result = await onPreview({ sqlText, rowLimit });
      setPreviewResult(result);
    } catch (error) {
      setPreviewError(normalizeError(error, 'Preview failed.'));
      setPreviewResult(null);
    } finally {
      setIsPreviewing(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveError(null);
    try {
      await onSave({
        queryName,
        folderId: folderId || null,
        sqlText,
        rowLimit,
        description,
      });
    } catch (error) {
      setSaveError(normalizeError(error, 'Failed to save query.'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="query-generator-editor">
      <h3>{initialQuery ? 'Edit Query' : 'New Query'}</h3>

      <label className="query-generator-field">
        <span>Query Name</span>
        <input value={queryName} onChange={(event) => setQueryName(event.target.value)} placeholder="e.g. Item Snapshot" />
      </label>

      <label className="query-generator-field">
        <span>Folder</span>
        <select value={folderId || ''} onChange={(event) => setFolderId(event.target.value)}>
          <option value="">(Root)</option>
          {folderOptions.map((folder) => (
            <option key={folder.folderId} value={folder.folderId}>
              {folder.label}
            </option>
          ))}
        </select>
      </label>

      <label className="query-generator-field">
        <span>SQL (SELECT only)</span>
        <textarea
          value={sqlText}
          onChange={(event) => setSqlText(event.target.value)}
          rows={10}
          placeholder="SELECT ItemCode, ItemName, OnHand FROM OITM"
          spellCheck={false}
        />
      </label>

      <label className="query-generator-field query-generator-field-inline">
        <span>Row Limit</span>
        <input
          type="number"
          min={1}
          max={5000}
          value={rowLimit}
          onChange={(event) => setRowLimit(Number(event.target.value) || 500)}
        />
      </label>

      <label className="query-generator-field">
        <span>Description</span>
        <input value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Optional notes" />
      </label>

      <div className="query-generator-actions">
        <button type="button" onClick={handlePreview} disabled={isPreviewing || !sqlText.trim()}>
          {isPreviewing ? 'Running…' : 'Preview'}
        </button>
        <button type="button" onClick={handleSave} disabled={isSaving || !queryName.trim() || !sqlText.trim()}>
          {isSaving ? 'Saving…' : 'Save'}
        </button>
        <button type="button" onClick={onCancel}>Cancel</button>
      </div>

      {saveError && <div className="query-manager-grid-status query-manager-grid-error">{saveError}</div>}

      <div className="query-generator-preview">
        <ResultsGrid
          columns={previewResult?.columns || []}
          rows={previewResult?.rows || []}
          isLoading={isPreviewing}
          error={previewError}
          emptyMessage="Run Preview to see results."
          title={queryName || 'query-preview'}
        />
      </div>
    </div>
  );
};

export default QueryGeneratorEditor;
