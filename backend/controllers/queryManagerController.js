const queryManagerService = require('../services/queryManagerService');

const getFolderTree = async (req, res, next) => {
  try {
    const data = await queryManagerService.getFolderTree(req.auth);
    res.json(data);
  } catch (error) {
    next(error);
  }
};

const createFolder = async (req, res, next) => {
  try {
    const data = await queryManagerService.createFolder(req.body || {}, req.auth);
    res.status(201).json(data);
  } catch (error) {
    next(error);
  }
};

const renameOrMoveFolder = async (req, res, next) => {
  try {
    const data = await queryManagerService.renameOrMoveFolder(req.params.folderId, req.body || {}, req.auth);
    res.json(data);
  } catch (error) {
    next(error);
  }
};

const deleteFolder = async (req, res, next) => {
  try {
    await queryManagerService.deleteFolder(req.params.folderId, req.auth);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
};

const getSavedQuery = async (req, res, next) => {
  try {
    const data = await queryManagerService.getSavedQuery(req.params.queryId, req.auth);
    res.json(data);
  } catch (error) {
    next(error);
  }
};

const createSavedQuery = async (req, res, next) => {
  try {
    const data = await queryManagerService.createSavedQuery(req.body || {}, req.auth);
    res.status(201).json(data);
  } catch (error) {
    next(error);
  }
};

const updateSavedQuery = async (req, res, next) => {
  try {
    const data = await queryManagerService.updateSavedQuery(req.params.queryId, req.body || {}, req.auth);
    res.json(data);
  } catch (error) {
    next(error);
  }
};

const deleteSavedQuery = async (req, res, next) => {
  try {
    await queryManagerService.deleteSavedQuery(req.params.queryId, req.auth);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
};

const previewQuery = async (req, res, next) => {
  try {
    const data = await queryManagerService.runAdhocQuery(req.body || {}, req.auth);
    res.json(data);
  } catch (error) {
    next(error);
  }
};

const runSavedQuery = async (req, res, next) => {
  try {
    const data = await queryManagerService.runSavedQuery(req.params.queryId, req.auth);
    res.json(data);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getFolderTree,
  createFolder,
  renameOrMoveFolder,
  deleteFolder,
  getSavedQuery,
  createSavedQuery,
  updateSavedQuery,
  deleteSavedQuery,
  previewQuery,
  runSavedQuery,
};
