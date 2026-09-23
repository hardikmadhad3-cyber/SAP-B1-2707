import React, { useState } from 'react';

const QueryLeaf = ({ leaf, depth, onSelectQuery, onEditQuery, onDeleteQuery }) => {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div
      className="query-manager-tree-row query-manager-tree-leaf"
      style={{ paddingLeft: depth * 14 }}
      onClick={() => onSelectQuery(leaf.queryId)}
    >
      <span className="query-manager-tree-icon">🔍</span>
      <span className="query-manager-tree-label">{leaf.queryName}</span>
      <button
        type="button"
        className="query-manager-tree-menu-btn"
        onClick={(event) => { event.stopPropagation(); setMenuOpen((value) => !value); }}
      >
        ⋮
      </button>
      {menuOpen && (
        <div className="query-manager-tree-menu" onClick={(event) => event.stopPropagation()}>
          <button type="button" onClick={() => { onEditQuery(leaf.queryId); setMenuOpen(false); }}>
            Edit SQL
          </button>
          <button type="button" onClick={() => { onDeleteQuery(leaf); setMenuOpen(false); }}>
            Delete
          </button>
        </div>
      )}
    </div>
  );
};

const FolderNode =({ node, depth, onSelectQuery, onAddFolder, onRename, onMove, onDelete, onEditQuery, onDeleteQuery, allFolders }) => {
  const [expanded, setExpanded] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="query-manager-tree-node" style={{ paddingLeft: depth * 14 }}>
      <div className="query-manager-tree-row">
        <button
          type="button"
          className="query-manager-tree-toggle"
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? '▾' : '▸'}
        </button>
        <span className="query-manager-tree-icon">📁</span>
        <span className="query-manager-tree-label">{node.folderName}</span>
        <button type="button" className="query-manager-tree-menu-btn" onClick={() => setMenuOpen((value) => !value)}>
          ⋮
        </button>
        {menuOpen && (
          <div className="query-manager-tree-menu">
            <button type="button" onClick={() => { onAddFolder(node.folderId); setMenuOpen(false); }}>
              New Subfolder
            </button>
            <button type="button" onClick={() => { onRename(node); setMenuOpen(false); }}>
              Rename
            </button>
            <button type="button" onClick={() => { onMove(node); setMenuOpen(false); }}>
              Move
            </button>
            <button type="button" onClick={() => { onDelete(node); setMenuOpen(false); }}>
              Delete
            </button>
          </div>
        )}
      </div>
      {expanded && (
        <div className="query-manager-tree-children">
          {(node.children || []).map((child) => (
            <FolderNode
              key={`folder-${child.folderId}`}
              node={child}
              depth={depth + 1}
              onSelectQuery={onSelectQuery}
              onAddFolder={onAddFolder}
              onRename={onRename}
              onMove={onMove}
              onDelete={onDelete}
              onEditQuery={onEditQuery}
              onDeleteQuery={onDeleteQuery}
              allFolders={allFolders}
            />
          ))}
          {(node.queries || []).map((leaf) => (
            <QueryLeaf
              key={`query-${leaf.queryId}`}
              leaf={leaf}
              depth={depth + 1}
              onSelectQuery={onSelectQuery}
              onEditQuery={onEditQuery}
              onDeleteQuery={onDeleteQuery}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const flattenFolders = (nodes, acc = []) => {
  for (const node of nodes) {
    if (node.folderId) {
      acc.push(node);
      flattenFolders(node.children || [], acc);
    }
  }
  return acc;
};

const QueryFolderTree = ({ tree, onSelectQuery, onAddFolder, onRename, onMove, onDelete, onNewQuery, onEditQuery, onDeleteQuery }) => {
  const allFolders = flattenFolders(tree);
  const rootQueries = tree.filter((node) => node.isRootQuery);
  const rootFolders = tree.filter((node) => !node.isRootQuery);

  return (
    <div className="query-manager-tree">
      <div className="query-manager-tree-toolbar">
        <button type="button" onClick={() => onAddFolder(null)}>+ Folder</button>
        <button type="button" onClick={() => onNewQuery(null)}>+ Query</button>
      </div>
      {rootFolders.map((node) => (
        <FolderNode
          key={`folder-${node.folderId}`}
          node={node}
          depth={0}
          onSelectQuery={onSelectQuery}
          onAddFolder={onAddFolder}
          onRename={onRename}
          onMove={onMove}
          onDelete={onDelete}
          onEditQuery={onEditQuery}
          onDeleteQuery={onDeleteQuery}
          allFolders={allFolders}
        />
      ))}
      {rootQueries.map((leaf) => (
        <QueryLeaf
          key={`query-${leaf.queryId}`}
          leaf={leaf}
          depth={0}
          onSelectQuery={onSelectQuery}
          onEditQuery={onEditQuery}
          onDeleteQuery={onDeleteQuery}
        />
      ))}
      {!tree.length && <div className="query-manager-tree-empty">No folders or queries yet.</div>}
    </div>
  );
};

export default QueryFolderTree;
