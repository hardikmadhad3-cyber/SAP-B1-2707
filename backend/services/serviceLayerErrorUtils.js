const { URL } = require('url');

const getSapErrorCode = (error) =>
  error?.response?.data?.error?.code ?? error?.sapCode ?? null;

const getSapErrorMessage = (error, fallback = 'SAP Service Layer request failed.') => {
  const message =
    error?.response?.data?.error?.message?.value ||
    error?.response?.data?.error?.message ||
    error?.response?.data?.message ||
    error?.message;

  return typeof message === 'string' && message.trim() ? message.trim() : fallback;
};

const getServiceLayerHost = (baseUrl) => {
  try {
    return new URL(String(baseUrl || '')).host;
  } catch {
    return '';
  }
};

const createServiceLayerLoginError = (error, { companyDb, baseUrl } = {}) => {
  const normalizedCompanyDb = String(companyDb || '').trim() || 'the selected company';
  const upstreamStatus = Number(error?.response?.status) || null;
  const sapCode = getSapErrorCode(error);
  const sapMessage = getSapErrorMessage(error, 'Login failed');
  const isCredentialFailure =
    [401, 403].includes(upstreamStatus) ||
    String(sapCode || '') === '100000027' ||
    /login failed|authentication failed|invalid (user|credential|password)/i.test(sapMessage);

  const message = isCredentialFailure
    ? `SAP Business One Service Layer login failed for company "${normalizedCompanyDb}". Verify the SAP username, password, and company access in Company Master.`
    : `Could not establish an SAP Business One Service Layer session for company "${normalizedCompanyDb}": ${sapMessage}`;

  const wrapped = new Error(message);
  wrapped.name = 'SapServiceLayerLoginError';
  wrapped.code = isCredentialFailure
    ? 'SAP_SERVICE_LAYER_LOGIN_FAILED'
    : 'SAP_SERVICE_LAYER_LOGIN_UNAVAILABLE';
  // Upstream SAP authentication must not invalidate the Web Client access token.
  wrapped.statusCode = 502;
  wrapped.upstreamStatus = upstreamStatus;
  wrapped.sapCode = sapCode;
  wrapped.serviceLayer = {
    companyDb: normalizedCompanyDb,
    host: getServiceLayerHost(baseUrl),
    path: '/Login',
  };
  wrapped.cause = error;
  return wrapped;
};

module.exports = {
  createServiceLayerLoginError,
  getSapErrorCode,
  getSapErrorMessage,
};
