const DUMMY_SAVE_FLAG = 'NEW_SALES_ORDER_USE_DUMMY_SAVE';
const SAP_WRITE_FLAG = 'NEW_SALES_ORDER_ALLOW_SAP_WRITES';

const protectionError = (statusCode, code, message) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
};

const isLiteralTrue = (value) => value === 'true';

const assertDummySaveEnabled = (environment = process.env) => {
  if (!isLiteralTrue(environment?.[DUMMY_SAVE_FLAG])) {
    throw protectionError(
      503,
      'NEW_SALES_ORDER_DUMMY_SAVE_DISABLED',
      'New Sales Order dummy saving is disabled.',
    );
  }
  return true;
};

const assertSapWriteUnavailable = (environment = process.env) => {
  if (!isLiteralTrue(environment?.[SAP_WRITE_FLAG])) {
    throw protectionError(
      403,
      'NEW_SALES_ORDER_SAP_WRITES_DISABLED',
      'SAP writes are disabled for New Sales Order test mode.',
    );
  }

  throw protectionError(
    501,
    'NEW_SALES_ORDER_SAP_WRITES_NOT_IMPLEMENTED',
    'SAP writes are not implemented for New Sales Order test mode.',
  );
};

const requireDummySaveEnabled = (environment = process.env) => (_req, _res, next) => {
  try {
    assertDummySaveEnabled(environment);
    next();
  } catch (error) {
    next(error);
  }
};

const blockSapWrites = (environment = process.env) => (_req, _res, next) => {
  try {
    assertSapWriteUnavailable(environment);
    next();
  } catch (error) {
    next(error);
  }
};

module.exports = {
  DUMMY_SAVE_FLAG,
  SAP_WRITE_FLAG,
  assertDummySaveEnabled,
  assertSapWriteUnavailable,
  blockSapWrites,
  isLiteralTrue,
  requireDummySaveEnabled,
};
