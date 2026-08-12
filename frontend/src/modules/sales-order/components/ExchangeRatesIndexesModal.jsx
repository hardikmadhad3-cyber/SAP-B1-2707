import React from 'react';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const formatSapDate = (value) => String(value || '').split('T')[0];

function ExchangeRatesIndexesModal({
  isOpen,
  currency = '',
  postingDate = '',
  initialRate = '',
  loading = false,
  error = '',
  data = null,
  onLoad,
  onSave,
  onClose,
}) {
  const parsedDate = postingDate ? new Date(`${formatSapDate(postingDate)}T00:00:00`) : new Date();
  const [activeTab, setActiveTab] = React.useState('rates');
  const [month, setMonth] = React.useState(parsedDate.getMonth() + 1);
  const [year, setYear] = React.useState(parsedDate.getFullYear());
  const [draftRates, setDraftRates] = React.useState({});
  const [dirtyRateKeys, setDirtyRateKeys] = React.useState([]);
  const selectedCellRef = React.useRef(null);
  const targetDay = parsedDate.getMonth() + 1 === month && parsedDate.getFullYear() === year
    ? parsedDate.getDate()
    : null;
  const selectedKey = targetDay && currency ? `${targetDay}:${currency}` : '';

  React.useEffect(() => {
    if (!isOpen) return;
    const nextDate = postingDate ? new Date(`${formatSapDate(postingDate)}T00:00:00`) : new Date();
    setMonth(nextDate.getMonth() + 1);
    setYear(nextDate.getFullYear());
    setActiveTab('rates');
    setDraftRates({});
    setDirtyRateKeys([]);
  }, [isOpen, postingDate]);

  React.useEffect(() => {
    if (!isOpen || typeof onLoad !== 'function') return;
    onLoad({ year, month });
  }, [isOpen, year, month, onLoad]);

  React.useEffect(() => {
    if (!isOpen || !targetDay || !currency || initialRate === '') return;
    setDraftRates((previous) => ({
      ...previous,
      [`${targetDay}:${currency}`]: String(initialRate),
    }));
  }, [currency, initialRate, isOpen, targetDay]);

  React.useEffect(() => {
    if (!isOpen || !selectedCellRef.current) return;
    selectedCellRef.current.scrollIntoView({ block: 'center', inline: 'center' });
  }, [data, isOpen, selectedKey]);

  if (!isOpen) return null;

  const currencies = Array.isArray(data?.currencies) ? data.currencies : [];
  const days = Array.isArray(data?.days) ? data.days : [];
  const selectedValue = selectedKey
    ? draftRates[selectedKey] ?? days.find((day) => day.day === targetDay)?.rates?.[currency] ?? ''
    : '';
  const visibleError = /request failed|status code|not found/i.test(String(error || ''))
    ? ''
    : error;

  const getCellValue = (day, code) => {
    const key = `${day}:${code}`;
    if (draftRates[key] !== undefined) return draftRates[key];
    const row = days.find((entry) => entry.day === day);
    const rate = row?.rates?.[code];
    return rate === undefined || rate === null ? '' : String(rate);
  };

  const updateCell = (day, code, value) => {
    const key = `${day}:${code}`;
    setDraftRates((previous) => ({ ...previous, [key]: value }));
    setDirtyRateKeys((previous) => previous.includes(key) ? previous : [...previous, key]);
  };

  const saveSelected = () => {
    if (typeof onSave !== 'function') return;

    const rates = dirtyRateKeys.map((key) => {
      const [day, code] = key.split(':');
      return {
        currency: code,
        postingDate: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
        rate: draftRates[key],
      };
    });

    if (!rates.length && selectedKey) {
      rates.push({ currency, postingDate, rate: selectedValue });
    }

    if (rates.length) onSave({ rates });
  };

  return (
    <div
      className="sap-lookup-modal__overlay so-exchange-rates-modal__overlay"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && onClose?.()}
    >
      <section
        className="sap-lookup-modal so-exchange-rates-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Exchange Rates and Indexes"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="sap-lookup-modal__header">
          <span>Exchange Rates and Indexes</span>
          <button type="button" className="sap-lookup-modal__close" aria-label="Close" onClick={onClose}>
            x
          </button>
        </header>

        <div className="so-exchange-rates-modal__body">
          <div className="so-exchange-rates-modal__tabs">
            <button
              type="button"
              className={`so-exchange-rates-modal__tab${activeTab === 'rates' ? ' is-active' : ''}`}
              onClick={() => setActiveTab('rates')}
            >
              Exchange Rates
            </button>
            <button
              type="button"
              className={`so-exchange-rates-modal__tab${activeTab === 'indexes' ? ' is-active' : ''}`}
              onClick={() => setActiveTab('indexes')}
            >
              Indexes
            </button>
          </div>

          <div className="so-exchange-rates-modal__panel">
            <div className="so-exchange-rates-modal__selectors">
              <select className="so-exchange-rates-modal__select" value={month} onChange={(event) => {
                setMonth(Number(event.target.value));
                setDraftRates({});
                setDirtyRateKeys([]);
              }}>
                {MONTHS.map((name, index) => <option key={name} value={index + 1}>{name}</option>)}
              </select>
              <select className="so-exchange-rates-modal__select" value={year} onChange={(event) => {
                setYear(Number(event.target.value));
                setDraftRates({});
                setDirtyRateKeys([]);
              }}>
                {Array.from({ length: 9 }, (_unused, index) => year - 4 + index).map((optionYear) => (
                  <option key={optionYear} value={optionYear}>{optionYear}</option>
                ))}
              </select>
            </div>

            {activeTab === 'indexes' ? (
              <div className="so-exchange-rates-modal__empty">
                Indexes use the same SAP window. Exchange-rate entry is active for this sales order.
              </div>
            ) : (
              <div className="so-exchange-rates-modal__grid-wrap">
                <table className="so-exchange-rates-modal__grid">
                  <thead>
                    <tr>
                      <th className="so-exchange-rates-modal__day-heading">{MONTHS[month - 1].slice(0, 4)}...</th>
                      {currencies.map((entry) => (
                        <th key={entry.code}>{entry.code}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan={Math.max(currencies.length + 1, 2)} className="so-exchange-rates-modal__loading">
                          Loading...
                        </td>
                      </tr>
                    ) : days.map((day) => (
                      <tr key={day.day}>
                        <td className={`so-exchange-rates-modal__day${day.day === targetDay ? ' is-active' : ''}`}>
                          {day.day}
                        </td>
                        {currencies.map((entry) => {
                          const active = day.day === targetDay && entry.code === currency;
                          return (
                            <td key={`${day.day}-${entry.code}`} className={active ? 'is-active' : undefined}>
                              <input
                                ref={active ? selectedCellRef : null}
                                value={getCellValue(day.day, entry.code)}
                                onChange={(event) => updateCell(day.day, entry.code, event.target.value)}
                                className={`so-exchange-rates-modal__rate-input${active ? ' is-selected-rate' : ''}`}
                                placeholder={active ? 'Enter rate' : ''}
                              />
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {visibleError ? <div className="so-exchange-rates-modal__error">{visibleError}</div> : null}
          </div>
        </div>

        <footer className="sap-lookup-modal__footer so-exchange-rates-modal__footer">
          <span>{dirtyRateKeys.length
            ? `${dirtyRateKeys.length} exchange rate${dirtyRateKeys.length === 1 ? '' : 's'} changed`
            : currency && postingDate ? `Selected: ${currency} on ${formatSapDate(postingDate)}` : ''}</span>
          <button
            type="button"
            className="sap-lookup-modal__btn sap-lookup-modal__btn--primary"
            onClick={saveSelected}
            disabled={loading || (!dirtyRateKeys.length && !selectedValue)}
          >
            OK
          </button>
          <button type="button" className="sap-lookup-modal__btn" onClick={onClose}>
            Cancel
          </button>
        </footer>
      </section>
    </div>
  );
}

export default ExchangeRatesIndexesModal;
