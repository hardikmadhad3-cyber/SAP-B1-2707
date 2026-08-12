import React from 'react';
import {
  DEFAULT_LOCAL_CURRENCY,
  normalizeCurrencyMode,
  resolveDocumentCurrency,
} from '../../utils/documentCurrency';

const CURRENCY_MODES = [
  { value: 'BP', label: 'BP Currency' },
  { value: 'LOCAL', label: 'Local Currency' },
  { value: 'SYSTEM', label: 'System Currency' },
];

const SAP_B1_COMMON_CURRENCIES = [
  { code: 'CAN', name: 'Canadian Dollar' },
  { code: 'EUR', name: 'Euro' },
  { code: 'GBP', name: 'British Pound' },
  { code: 'INR', name: 'Indian Rupee' },
  { code: 'USD', name: 'US Dollar' },
];

const emitHeaderChange = (onHeaderChange, name, value) => {
  if (typeof onHeaderChange !== 'function') return;
  onHeaderChange({
    target: {
      name,
      value,
      type: 'select-one',
      checked: false,
    },
  });
};

function DocumentCurrencySelect({
  classPrefix = 'so',
  header = {},
  onHeaderChange,
  businessPartners = [],
  currencyOptions = [],
  disabled = false,
  localCurrency = DEFAULT_LOCAL_CURRENCY,
  systemCurrency = '',
  hideLabel = false,
  includeSapB1CommonCurrencies = false,
}) {
  const currencyDropdownRef = React.useRef(null);
  const [currencyDropdownOpen, setCurrencyDropdownOpen] = React.useState(false);
  const mode = normalizeCurrencyMode(header.currencyMode);
  const currentCurrency = String(header.currency || '').trim();
  const displayCurrency = resolveDocumentCurrency({
    mode,
    cardCode: header.vendor,
    businessPartners,
    currentCurrency,
    localCurrency,
    systemCurrency,
  });
  const modeOptions = mode === 'CUSTOM'
    ? [...CURRENCY_MODES, { value: 'CUSTOM', label: 'Document Currency' }]
    : CURRENCY_MODES;
  const currencyOptionMap = new Map();
  const addCurrencyOption = (code, name = '') => {
    const normalizedCode = String(code || '').trim();
    if (!normalizedCode) return;
    const normalizedName = String(name || normalizedCode).trim();
    const existingCurrency = currencyOptionMap.get(normalizedCode);
    if (existingCurrency) {
      if (
        normalizedName
        && normalizedName !== normalizedCode
        && (!existingCurrency.name || existingCurrency.name === existingCurrency.code)
      ) {
        currencyOptionMap.set(normalizedCode, {
          ...existingCurrency,
          name: normalizedName,
        });
      }
      return;
    }
    currencyOptionMap.set(normalizedCode, {
      code: normalizedCode,
      name: normalizedName,
    });
  };

  (Array.isArray(currencyOptions) ? currencyOptions : []).forEach((currency) => {
    addCurrencyOption(
      currency.CurrCode || currency.Code || currency.code || currency.value,
      currency.CurrName || currency.Name || currency.name || currency.label,
    );
  });
  addCurrencyOption(currentCurrency || displayCurrency);
  addCurrencyOption(localCurrency);
  addCurrencyOption(systemCurrency);
  if (includeSapB1CommonCurrencies) {
    SAP_B1_COMMON_CURRENCIES.forEach((currency) => addCurrencyOption(currency.code, currency.name));
  }

  const documentCurrencyOptions = [...currencyOptionMap.values()]
    .sort((left, right) => left.code.localeCompare(right.code));
  const selectedDocumentCurrency = currentCurrency || displayCurrency;
  const selectedCurrencyOption = documentCurrencyOptions.find(
    (currency) => currency.code === selectedDocumentCurrency
  ) || { code: selectedDocumentCurrency, name: selectedDocumentCurrency };
  const showDocumentCurrencyField = mode === 'BP' || mode === 'CUSTOM';
  const hasExchangeRateField = Boolean(showDocumentCurrencyField && currentCurrency && currentCurrency !== String(localCurrency || '').trim());
  const useSapCurrencyDropdown = documentCurrencyOptions.length > 1;

  React.useEffect(() => {
    if (!currencyDropdownOpen) return undefined;
    const handlePointerDown = (event) => {
      if (!currencyDropdownRef.current?.contains(event.target)) {
        setCurrencyDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [currencyDropdownOpen]);

  const handleModeChange = (event) => {
    const nextMode = event.target.value;
    emitHeaderChange(onHeaderChange, 'currencyMode', nextMode);
  };

  const handleCurrencyChange = (event) => {
    emitHeaderChange(onHeaderChange, 'currency', event.target.value);
  };

  const chooseCurrency = (code) => {
    emitHeaderChange(onHeaderChange, 'currency', code);
    setCurrencyDropdownOpen(false);
  };

  return (
    <div className={`${classPrefix}-field${hideLabel ? ` ${classPrefix}-field--currency-compact` : ''}`} data-document-dirty-ignore="true">
      {hideLabel ? null : <label className={`${classPrefix}-field__label`}>BP Currency</label>}
      <div className={`sap-input-group sap-input-group--currency${showDocumentCurrencyField ? ' sap-input-group--currency-doc' : ' sap-input-group--currency-mode-only'}${hasExchangeRateField ? ' sap-input-group--currency-rate' : ''}`}>
        <select
          name="currencyMode"
          className={`${classPrefix}-field__select`}
          value={mode}
          onChange={handleModeChange}
          disabled={disabled}
          aria-label="Currency Source"
        >
          {modeOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {showDocumentCurrencyField && useSapCurrencyDropdown ? (
          <div
            ref={currencyDropdownRef}
            className={`${classPrefix}-currency-picker`}
          >
            <button
              type="button"
              className={`${classPrefix}-field__select ${classPrefix}-currency-picker__button`}
              onClick={() => !disabled && setCurrencyDropdownOpen((open) => !open)}
              disabled={disabled}
              title="Document Currency"
              aria-haspopup="listbox"
              aria-expanded={currencyDropdownOpen}
            >
              <span>{selectedCurrencyOption.code}</span>
              <span aria-hidden="true">v</span>
            </button>
            {currencyDropdownOpen ? (
              <div className={`${classPrefix}-currency-picker__menu`} role="listbox">
                {documentCurrencyOptions.map((currency) => (
                  <button
                    key={currency.code}
                    type="button"
                    className={`${classPrefix}-currency-picker__option${currency.code === selectedDocumentCurrency ? ` ${classPrefix}-currency-picker__option--active` : ''}`}
                    onClick={() => chooseCurrency(currency.code)}
                    role="option"
                    aria-selected={currency.code === selectedDocumentCurrency}
                  >
                    <span className={`${classPrefix}-currency-picker__code`}>{currency.code}</span>
                    <span aria-hidden="true">-</span>
                    <span>{currency.name || currency.code}</span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ) : showDocumentCurrencyField ? (
          <select
            name="currency"
            className={`${classPrefix}-field__select`}
            value={selectedDocumentCurrency}
            onChange={handleCurrencyChange}
            disabled={disabled}
            title="Document Currency"
          >
            {documentCurrencyOptions.map((currency) => (
              <option key={currency.code} value={currency.code}>
                {currency.code}
              </option>
            ))}
          </select>
        ) : null}
        {hasExchangeRateField ? (
          <input
            name="exchangeRate"
            className={`${classPrefix}-field__input`}
            value={header.exchangeRate || ''}
            onChange={(event) => emitHeaderChange(onHeaderChange, 'exchangeRate', event.target.value)}
            disabled={disabled}
            inputMode="decimal"
            aria-label="Exchange Rate"
            title="Exchange Rate"
          />
        ) : null}
      </div>
    </div>
  );
}

export default DocumentCurrencySelect;
