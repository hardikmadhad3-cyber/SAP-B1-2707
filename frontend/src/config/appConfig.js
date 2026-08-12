const trimTrailingSlash = (value) => String(value || '').trim().replace(/\/+$/, '');

const getEnvironmentApiBaseUrl = () => {
  const explicitBaseUrl = trimTrailingSlash(process.env.REACT_APP_API_BASE_URL);
  if (explicitBaseUrl) return explicitBaseUrl;

  const apiPath = `/${String(process.env.REACT_APP_API_PATH || 'api')
    .trim()
    .replace(/^\/+|\/+$/g, '')}`;
  const apiPort = String(process.env.REACT_APP_API_PORT || '').trim();
  if (!apiPort) return apiPath;

  const browserLocation = typeof window !== 'undefined' ? window.location : null;
  const protocol = String(
    process.env.REACT_APP_API_PROTOCOL || browserLocation?.protocol || 'http:',
  ).replace(/:$/, '');
  const hostname = String(
    process.env.REACT_APP_API_HOST || browserLocation?.hostname || 'localhost',
  ).trim();

  return `${protocol}://${hostname}:${apiPort}${apiPath}`;
};

const API_BASE_URL = getEnvironmentApiBaseUrl();
const PURCHASE_ORDER_COMPANY_ID = process.env.REACT_APP_PURCHASE_ORDER_COMPANY_ID || '1';
const PURCHASE_REQUEST_COMPANY_ID = process.env.REACT_APP_PURCHASE_REQUEST_COMPANY_ID || '1';
const SALES_ORDER_COMPANY_ID = process.env.REACT_APP_SALES_ORDER_COMPANY_ID || '1';
const AR_INVOICE_COMPANY_ID = process.env.REACT_APP_AR_INVOICE_COMPANY_ID || '1';

export {
  API_BASE_URL,
  PURCHASE_ORDER_COMPANY_ID,
  PURCHASE_REQUEST_COMPANY_ID,
  SALES_ORDER_COMPANY_ID,
  AR_INVOICE_COMPANY_ID,
};
