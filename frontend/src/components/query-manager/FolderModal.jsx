import React, { useEffect, useState } from 'react';

const FolderModal = ({ mode = 'create', initialName = '', initialParentId = null, folderOptions, excludeFolderId = null, onSubmit, onClose }) => {
  const [folderName, setFolderName] = useState(initialName);
  const [parentId, setParentId] = useState(initialParentId ?? '');
  const [error, setError] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setFolderName(initialName);
    setParentId(initialParentId ?? '');
  }, [initialName, initialParentId]);

  const availableOptions = folderOptions.filter((option) => option.folderId !== excludeFolderId);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!folderName.trim()) {
      setError('Folder name is required.');
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      await onSubmit({
        folderName: folderName.trim(),
        parentId: parentId === '' ? null : Number(parentId),
      });
      onClose();
    } catch (submitError) {
      setError(submitError?.response?.data?.message || submitError?.message || 'Failed to save folder.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="query-manager-modal-overlay" onClick={onClose}>
      <div className="query-manager-modal" onClick={(event) => event.stopPropagation()}>
        <h3>{mode === 'create' ? 'New Folder' : 'Rename / Move Folder'}</h3>
        <form onSubmit={handleSubmit}>
          <label className="query-generator-field">
            <span>Folder Name</span>
            <input
              autoFocus
              value={folderName}
              onChange={(event) => setFolderName(event.target.value)}
              placeholder="e.g. Sales Order"
            />
          </label>

          <label className="query-generator-field">
            <span>Parent Folder</span>
            <select value={parentId} onChange={(event) => setParentId(event.target.value)}>
              <option value="">(Root)</option>
              {availableOptions.map((option) => (
                <option key={option.folderId} value={option.folderId}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          {error && <div className="query-manager-grid-status query-manager-grid-error">{error}</div>}

          <div className="query-generator-actions">
            <button type="submit" disabled={isSaving}>
              {isSaving ? 'Saving…' : mode === 'create' ? 'Create' : 'Save'}
            </button>
            <button type="button" onClick={onClose}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default FolderModal;
