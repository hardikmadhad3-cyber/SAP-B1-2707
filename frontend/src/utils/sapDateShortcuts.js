const DATE_INPUT_SELECTOR = 'input[type=date], input[data-sap-date-input=true]';
const entryBuffers = new WeakMap();
let removeInstalledListeners = null;

const pad2 = (value) => String(value).padStart(2, '0');

const isRealDate = (year, month, day) => {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return false;
  if (year < 1 || year > 9999 || month < 1 || month > 12 || day < 1 || day > 31) return false;

  const candidate = new Date(0);
  candidate.setFullYear(year, month - 1, day);
  candidate.setHours(0, 0, 0, 0);
  return candidate.getFullYear() === year && candidate.getMonth() === month - 1 && candidate.getDate() === day;
};

const toIsoDate = (year, month, day) =>
  isRealDate(year, month, day) ? `${String(year).padStart(4, '0')}-${pad2(month)}-${pad2(day)}` : '';

const getReferenceParts = (referenceDate) => {
  const reference = referenceDate instanceof Date && !Number.isNaN(referenceDate.getTime())
    ? referenceDate
    : new Date();
  return {
    year: reference.getFullYear(),
    month: reference.getMonth() + 1,
    day: reference.getDate(),
  };
};

const expandTwoDigitYear = (year) => (year < 50 ? 2000 + year : 1900 + year);

/** Resolves the compact date entry shortcuts documented for SAP Business One. */
export const resolveSapDateShortcut = (rawValue, referenceDate = new Date()) => {
  const raw = String(rawValue ?? '').trim();
  if (!raw) return { value: '', error: 'Enter a date.' };

  const reference = getReferenceParts(referenceDate);

  // SAP B1: any non-numeric character followed by Tab enters today's date.
  if (!/\d/.test(raw)) {
    return { value: toIsoDate(reference.year, reference.month, reference.day), error: '' };
  }

  // Also accept dates pasted in the displayed DD-MM-YYYY format or ISO format.
  const isoMatch = raw.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (isoMatch) {
    const value = toIsoDate(Number(isoMatch[1]), Number(isoMatch[2]), Number(isoMatch[3]));
    return value ? { value, error: '' } : { value: '', error: 'Enter a valid calendar date.' };
  }

  const displayMatch = raw.match(/^(\d{1,2})[-/.](\d{1,2})(?:[-/.](\d{2}|\d{4}))?$/);
  if (displayMatch) {
    const suppliedYear = displayMatch[3] ? Number(displayMatch[3]) : reference.year;
    const year = displayMatch[3]?.length === 2 ? expandTwoDigitYear(suppliedYear) : suppliedYear;
    const value = toIsoDate(year, Number(displayMatch[2]), Number(displayMatch[1]));
    return value ? { value, error: '' } : { value: '', error: 'Enter a valid calendar date.' };
  }

  if (!/^\d+$/.test(raw)) return { value: '', error: 'Use numbers only, or a letter for today.' };

  let day;
  let month = reference.month;
  let year = reference.year;

  if (raw.length <= 2) {
    day = Number(raw);
  } else if (raw.length === 3) {
    // Prefer DMM (106 = 1 June); fall back to DDM (191 = 19 January).
    const dmm = { day: Number(raw.slice(0, 1)), month: Number(raw.slice(1)) };
    const ddm = { day: Number(raw.slice(0, 2)), month: Number(raw.slice(2)) };
    ({ day, month } = isRealDate(year, dmm.month, dmm.day) ? dmm : ddm);
  } else if (raw.length === 4) {
    day = Number(raw.slice(0, 2));
    month = Number(raw.slice(2, 4));
  } else if (raw.length === 6) {
    day = Number(raw.slice(0, 2));
    month = Number(raw.slice(2, 4));
    year = expandTwoDigitYear(Number(raw.slice(4, 6)));
  } else if (raw.length === 8) {
    day = Number(raw.slice(0, 2));
    month = Number(raw.slice(2, 4));
    year = Number(raw.slice(4, 8));
  } else {
    return { value: '', error: 'Use DD, DDMM, DDMMYY, or DDMMYYYY.' };
  }

  const value = toIsoDate(year, month, day);
  return value ? { value, error: '' } : { value: '', error: 'Enter a valid calendar date.' };
};

const isEditableDateInput = (element) =>
  element instanceof HTMLInputElement &&
  element.matches(DATE_INPUT_SELECTOR) &&
  !element.disabled &&
  !element.readOnly;

const setNativeInputValue = (input, value) => {
  const ownSetter = Object.getOwnPropertyDescriptor(input, 'value')?.set;
  const prototypeSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  (prototypeSetter && ownSetter !== prototypeSetter ? prototypeSetter : ownSetter)?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
};

const removeEntryHint = () => document.getElementById('sap-date-entry-hint')?.remove();

const showEntryHint = (input, buffer) => {
  removeEntryHint();
  const hint = document.createElement('div');
  hint.id = 'sap-date-entry-hint';
  hint.setAttribute('role', 'status');
  hint.setAttribute('aria-live', 'polite');
  const result = resolveSapDateShortcut(buffer);
  const preview = result.value ? result.value.split('-').reverse().join('-') : result.error;
  hint.textContent = `${buffer} → ${preview} (Tab)`;

  const rect = input.getBoundingClientRect();
  Object.assign(hint.style, {
    position: 'fixed',
    zIndex: '100000',
    left: `${Math.max(4, rect.left)}px`,
    top: `${Math.min(window.innerHeight - 30, rect.bottom + 3)}px`,
    padding: '3px 7px',
    border: '1px solid #8ca9c4',
    borderRadius: '3px',
    background: '#f4f8fc',
    color: '#123b63',
    boxShadow: '0 2px 5px rgba(0, 0, 0, 0.16)',
    font: '12px/1.3 Arial, sans-serif',
    pointerEvents: 'none',
  });
  document.body.appendChild(hint);
};

const clearEntry = (input) => {
  entryBuffers.delete(input);
  delete input.dataset.sapDateEntry;
  removeEntryHint();
};

const commitEntry = (input, { reportError = true } = {}) => {
  const buffer = entryBuffers.get(input);
  if (!buffer) return true;

  const result = resolveSapDateShortcut(buffer);
  if (!result.value) {
    input.setCustomValidity(result.error);
    if (reportError) input.reportValidity();
    return false;
  }

  input.setCustomValidity('');
  setNativeInputValue(input, result.value);
  clearEntry(input);
  return true;
};

const handleKeyDown = (event) => {
  const input = event.target;
  if (!isEditableDateInput(input) || event.ctrlKey || event.metaKey || event.altKey) return;

  const current = entryBuffers.get(input) || '';

  if (/^\d$/.test(event.key)) {
    event.preventDefault();
    const maximumLength = /[-/.]/.test(current) ? 10 : 8;
    const next = current.length >= maximumLength ? event.key : `${current}${event.key}`;
    entryBuffers.set(input, next);
    input.dataset.sapDateEntry = next;
    input.setCustomValidity('');
    showEntryHint(input, next);
    return;
  }

  if (/^[-/.]$/.test(event.key) && current) {
    event.preventDefault();
    const next = /[-/.]$/.test(current) ? current : `${current}${event.key}`;
    entryBuffers.set(input, next);
    input.dataset.sapDateEntry = next;
    showEntryHint(input, next);
    return;
  }

  if (/^[a-z]$/i.test(event.key)) {
    event.preventDefault();
    entryBuffers.set(input, event.key);
    input.dataset.sapDateEntry = event.key;
    input.setCustomValidity('');
    showEntryHint(input, event.key);
    return;
  }

  if (event.key === 'Backspace' && current) {
    event.preventDefault();
    const next = current.slice(0, -1);
    if (next) {
      entryBuffers.set(input, next);
      input.dataset.sapDateEntry = next;
      showEntryHint(input, next);
    } else {
      clearEntry(input);
    }
    return;
  }

  if (event.key === 'Escape' && current) {
    event.preventDefault();
    clearEntry(input);
    return;
  }

  if ((event.key === 'Tab' || event.key === 'Enter') && current) {
    const committed = commitEntry(input);
    if (!committed) event.preventDefault();
  }
};

const handleFocusOut = (event) => {
  const input = event.target;
  if (!isEditableDateInput(input) || !entryBuffers.has(input)) return;
  commitEntry(input, { reportError: false });
  if (entryBuffers.has(input)) removeEntryHint();
};

/** Installs SAP B1 date shortcuts once for every native date field in the app. */
export const installSapDateShortcuts = () => {
  if (removeInstalledListeners || typeof document === 'undefined') return removeInstalledListeners || (() => {});

  document.addEventListener('keydown', handleKeyDown, true);
  document.addEventListener('focusout', handleFocusOut, true);
  removeInstalledListeners = () => {
    document.removeEventListener('keydown', handleKeyDown, true);
    document.removeEventListener('focusout', handleFocusOut, true);
    removeEntryHint();
    removeInstalledListeners = null;
  };
  return removeInstalledListeners;
};
