import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  createFolder,
  createSavedQuery,
  deleteFolder,
  deleteSavedQuery,
  fetchQueryFolderTree,
  fetchSavedQuery,
  previewQuery,
  renameOrMoveFolder,
  runSavedQuery,
  updateSavedQuery,
} from '../api/queryManagerApi';
import FolderModal from '../components/query-manager/FolderModal';
import QueryFolderTree from '../components/query-manager/QueryFolderTree';
import QueryGeneratorEditor from '../components/query-manager/QueryGeneratorEditor';
import ResultsGrid from '../components/query-manager/ResultsGrid';
import '../styles/query-manager.css';

const normalizeError = (error, fallback) =>
  error?.response?.data?.message || error?.message || fallback;

const flattenFolderOptions = (nodes, depth = 0, acc = []) => {
  for (const node of nodes) {
    if (node.folderId) {
      acc.push({ folderId: node.folderId, label: `${'— '.repeat(depth)}${node.folderName}` });
      flattenFolderOptions(node.children || [], depth + 1, acc);
    }
  }
  return acc;
};

const QueryManagerPage = () => {
  const [tree, setTree] = useState([]);
  const [isLoadingTree, setIsLoadingTree] = useState(true);
  const [treeError, setTreeError] = useState(null);

  const [mode, setMode] = useState('empty'); // 'empty' | 'editor' | 'result'
  const [activeQuery, setActiveQuery] = useState(null);
  const [defaultFolderId, setDefaultFolderId] = useState(null);

  const [runResult, setRunResult] = useState(null);
  const [runError, setRunError] = useState(null);
  const [isRunning, setIsRunning] = useState(false);
  const [activeQueryName, setActiveQueryName] = useState('');

  const loadTree = useCallback(async () => {
    setIsLoadingTree(true);
    setTreeError(null);
    try {
      const data = await fetchQueryFolderTree();
      setTree(data.tree || []);
    } catch (error) {
      setTreeError(normalizeError(error, 'Failed to load Query Manager.'));
    } finally {
      setIsLoadingTree(false);
    }
  }, []);

  useEffect(() => {
    loadTree();
  }, [loadTree]);

  const folderOptions = useMemo(() => flattenFolderOptions(tree), [tree]);

  const [folderModalOpen, setFolderModalOpen] = useState(false);
  const [folderModalDefaultParentId, setFolderModalDefaultParentId] = useState(null);

  const handleAddFolder = (parentId) => {
    setFolderModalDefaultParentId(parentId || null);
    setFolderModalOpen(true);
  };

  const handleCreateFolderSubmit = async ({ folderName, parentId }) => {
    await createFolder({ folderName, parentId });
    await loadTree();
  };

  const handleRenameFolder = async (node) => {
    const folderName = window.prompt('Rename folder:', node.folderName);
    if (!folderName || folderName === node.folderName) return;
    try {
      await renameOrMoveFolder(node.folderId, { folderName });
      await loadTree();
    } catch (error) {
      window.alert(normalizeError(error, 'Failed to rename folder.'));
    }
  };

  const handleMoveFolder = async (node) => {
    const options = folderOptions.filter((option) => option.folderId !== node.folderId);
    const listText = ['(Root)', ...options.map((option) => `${option.folderId}: ${option.label}`)].join('\n');
    const answer = window.prompt(`Move "${node.folderName}" to which folder? Enter folder id or leave blank for Root:\n${listText}`);
    if (answer === null) return;
    const parentId = answer.trim() ? Number(answer.trim()) : null;
    try {
      await renameOrMoveFolder(node.folderId, { parentId });
      await loadTree();
    } catch (error) {
      window.alert(normalizeError(error, 'Failed to move folder.'));
    }
  };

  const handleDeleteFolder = async (node) => {
    if (!window.confirm(`Delete folder "${node.folderName}"? It must be empty.`)) return;
    try {
      await deleteFolder(node.folderId);
      await loadTree();
    } catch (error) {
      window.alert(normalizeError(error, 'Failed to delete folder.'));
    }
  };

  const handleNewQuery = (parentId) => {
    setActiveQuery(null);
    setDefaultFolderId(parentId);
    setMode('editor');
  };

  const handleSelectQuery = async (queryId) => {
    setMode('result');
    setRunResult(null);
    setRunError(null);
    setIsRunning(true);
    try {
      const detail = await fetchSavedQuery(queryId);
      setActiveQueryName(detail.queryName);
      const result = await runSavedQuery(queryId);
      setRunResult(result);
    } catch (error) {
      setRunError(normalizeError(error, 'Failed to run query.'));
    } finally {
      setIsRunning(false);
    }
  };

  const handleEditQuery = async (queryId) => {
    try {
      const detail = await fetchSavedQuery(queryId);
      setActiveQuery(detail);
      setDefaultFolderId(detail.folderId);
      setMode('editor');
    } catch (error) {
      window.alert(normalizeError(error, 'Failed to load query.'));
    }
  };

  const handleDeleteQuery = async (leaf) => {
    if (!window.confirm(`Delete query "${leaf.queryName}"?`)) return;
    try {
      await deleteSavedQuery(leaf.queryId);
      await loadTree();
      if (mode === 'result') setMode('empty');
    } catch (error) {
      window.alert(normalizeError(error, 'Failed to delete query.'));
    }
  };

  const handleSaveQuery = async (payload) => {
    if (activeQuery?.queryId) {
      await updateSavedQuery(activeQuery.queryId, payload);
    } else {
      await createSavedQuery(payload);
    }
    await loadTree();
    setMode('empty');
    setActiveQuery(null);
  };

  return (
    <div className="query-manager-page">
      <div className="query-manager-sidebar">
        <h2>Query Manager</h2>
        {isLoadingTree && <div className="query-manager-tree-empty">Loading…</div>}
        {treeError && <div className="query-manager-grid-status query-manager-grid-error">{treeError}</div>}
        {!isLoadingTree && !treeError && (
          <QueryFolderTree
            tree={tree}
            onSelectQuery={handleSelectQuery}
            onAddFolder={handleAddFolder}
            onRename={handleRenameFolder}
            onMove={handleMoveFolder}
            onDelete={handleDeleteFolder}
            onNewQuery={handleNewQuery}
            onEditQuery={handleEditQuery}
            onDeleteQuery={handleDeleteQuery}
          />
        )}
      </div>

      <div className="query-manager-main">
        {mode === 'empty' && (
          <div className="query-manager-grid-status">
            Select a query to run it, or create a new folder/query from the left panel.
          </div>
        )}

        {mode === 'editor' && (
          <QueryGeneratorEditor
            initialQuery={activeQuery}
            defaultFolderId={defaultFolderId}
            folderOptions={folderOptions}
            onPreview={previewQuery}
            onSave={handleSaveQuery}
            onCancel={() => setMode('empty')}
          />
        )}

        {mode === 'result' && (
          <div>
            <div className="query-manager-result-header">
              <h3>{activeQueryName}</h3>
            </div>
            <ResultsGrid
              columns={runResult?.columns || []}
              rows={runResult?.rows || []}
              isLoading={isRunning}
              error={runError}
              title={activeQueryName}
            />
            {runResult?.truncated && (
              <div className="query-manager-grid-status">Results were truncated to the row limit.</div>
            )}
          </div>
        )}
      </div>

      {folderModalOpen && (
        <FolderModal
          mode="create"
          initialParentId={folderModalDefaultParentId}
          folderOptions={folderOptions}
          onSubmit={handleCreateFolderSubmit}
          onClose={() => setFolderModalOpen(false)}
        />
      )}
    </div>
  );
};

export default QueryManagerPage;
