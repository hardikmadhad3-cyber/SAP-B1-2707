import React from 'react';
import {
  formatAmount,
  formatCompactNumber,
  formatDashboardDate,
  formatPercent,
  getChartDomain,
  getTrendTone,
  toFiniteNumber,
} from './dashboardUtils';

export const DashboardLoading = () => (
  <div className="live-dashboard__loading" role="status" aria-label="Loading dashboard data">
    <span />
    <span />
    <span />
  </div>
);

export const KpiWidget = ({ value, currency, trend, subtitle, onOpen, loading }) => {
  if (loading) return <DashboardLoading />;
  const content = (
    <>
      <div className="dashboard-kpi__amount">{formatCompactNumber(value)}</div>
      <div className="dashboard-kpi__currency">{currency || ''}</div>
      <div className="dashboard-kpi__footer">
        <span>{subtitle}</span>
        {trend !== undefined ? (
          <strong className={`dashboard-kpi__trend dashboard-kpi__trend--${getTrendTone(trend)}`}>
            {formatPercent(trend)}
          </strong>
        ) : null}
      </div>
    </>
  );

  return onOpen ? (
    <button type="button" className="dashboard-kpi dashboard-kpi--button" onClick={onOpen}>
      {content}
    </button>
  ) : <div className="dashboard-kpi">{content}</div>;
};

export const HorizontalBarChart = ({ rows = [], currency = '', ariaLabel }) => {
  if (!rows.length) {
    return <div className="dashboard-empty-state">No sales were found for this fiscal period.</div>;
  }

  const width = 720;
  const labelWidth = 142;
  const valueWidth = 90;
  const plotWidth = width - labelWidth - valueWidth - 24;
  const rowHeight = 48;
  const height = rows.length * rowHeight + 18;
  const maxValue = Math.max(1, ...rows.map((row) => Math.abs(toFiniteNumber(row.value))));

  return (
    <div className="dashboard-chart-scroll">
      <svg
        className="dashboard-bar-chart"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={ariaLabel}
      >
        {rows.map((row, index) => {
          const y = index * rowHeight + 8;
          const barWidth = (Math.abs(toFiniteNumber(row.value)) / maxValue) * plotWidth;
          return (
            <g key={`${row.code}:${index}`}>
              <text x="0" y={y + 21} className="dashboard-chart__label">
                {String(row.code || row.name || '—').slice(0, 18)}
              </text>
              <rect x={labelWidth} y={y} width={plotWidth} height="30" rx="6" className="dashboard-chart__track" />
              <rect
                x={labelWidth}
                y={y}
                width={Math.max(barWidth, row.value ? 2 : 0)}
                height="30"
                rx="6"
                className={`dashboard-chart__bar${toFiniteNumber(row.value) < 0 ? ' dashboard-chart__bar--negative' : ''}`}
              >
                <title>{`${row.code} ${row.name || ''}: ${formatAmount(row.value, 2)} ${currency}`}</title>
              </rect>
              <text x={width - valueWidth + 8} y={y + 21} className="dashboard-chart__value">
                {formatCompactNumber(row.value, 1)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};

export const RevenueGrossProfitChart = ({ rows = [], currency = '' }) => {
  if (!rows.length) {
    return <div className="dashboard-empty-state">No monthly sales were found for this fiscal period.</div>;
  }

  const width = 760;
  const height = 270;
  const padding = { top: 24, right: 18, bottom: 42, left: 58 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const values = rows.flatMap((row) => [row.revenue, row.grossProfit]);
  const domain = getChartDomain(values);
  const range = domain.max - domain.min || 1;
  const yFor = (value) => padding.top + ((domain.max - toFiniteNumber(value)) / range) * plotHeight;
  const zeroY = yFor(0);
  const slotWidth = plotWidth / Math.max(rows.length, 1);
  const barWidth = Math.min(36, slotWidth * 0.54);
  const points = rows.map((row, index) => (
    `${padding.left + slotWidth * index + slotWidth / 2},${yFor(row.grossProfit)}`
  )).join(' ');

  return (
    <div className="dashboard-chart-scroll">
      <div className="dashboard-chart__legend" aria-hidden="true">
        <span><i className="is-revenue" />Revenue</span>
        <span><i className="is-profit" />Gross profit</span>
        <small>{currency}</small>
      </div>
      <svg className="dashboard-combo-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Monthly revenue versus gross profit">
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
          const y = padding.top + plotHeight * ratio;
          const value = domain.max - range * ratio;
          return (
            <g key={ratio}>
              <line x1={padding.left} x2={width - padding.right} y1={y} y2={y} className="dashboard-chart__grid" />
              <text x={padding.left - 8} y={y + 4} textAnchor="end" className="dashboard-chart__axis-value">
                {formatCompactNumber(value, 1)}
              </text>
            </g>
          );
        })}
        <line x1={padding.left} x2={width - padding.right} y1={zeroY} y2={zeroY} className="dashboard-chart__zero" />
        {rows.map((row, index) => {
          const centerX = padding.left + slotWidth * index + slotWidth / 2;
          const revenueY = yFor(row.revenue);
          return (
            <g key={row.key}>
              <rect
                x={centerX - barWidth / 2}
                y={Math.min(revenueY, zeroY)}
                width={barWidth}
                height={Math.max(1, Math.abs(zeroY - revenueY))}
                rx="4"
                className="dashboard-chart__revenue"
              >
                <title>{`${row.label} revenue: ${formatAmount(row.revenue, 2)} ${currency}`}</title>
              </rect>
              <text x={centerX} y={height - 17} textAnchor="middle" className="dashboard-chart__month">{row.label}</text>
            </g>
          );
        })}
        <polyline points={points} className="dashboard-chart__profit-line" />
        {rows.map((row, index) => {
          const x = padding.left + slotWidth * index + slotWidth / 2;
          const y = yFor(row.grossProfit);
          return (
            <circle key={row.key} cx={x} cy={y} r="5" className="dashboard-chart__profit-dot">
              <title>{`${row.label} gross profit: ${formatAmount(row.grossProfit, 2)} ${currency}`}</title>
            </circle>
          );
        })}
      </svg>
    </div>
  );
};

export const SalesProcess = ({ steps = [], onOpen }) => (
  <div className="dashboard-sales-process">
    {steps.map((step, index) => (
      <React.Fragment key={step.path}>
        <button type="button" className="dashboard-process-step" onClick={() => onOpen(step.path)}>
          <span className="dashboard-process-step__icon" aria-hidden="true">{step.symbol}</span>
          <strong>{step.label}</strong>
        </button>
        {index < steps.length - 1 ? <span className="dashboard-process-arrow" aria-hidden="true">→</span> : null}
      </React.Fragment>
    ))}
    {!steps.length ? <div className="dashboard-empty-state">No sales-process actions are available for this role.</div> : null}
  </div>
);

export const RecentUpdates = ({ rows = [], onOpen }) => (
  <div className="dashboard-recent-list">
    {rows.length ? rows.map((row) => (
      <button key={row.id} type="button" className="dashboard-recent-item" onClick={() => onOpen(row)} disabled={!row.route}>
        <span className="dashboard-recent-item__title">{row.label} {row.docNum || ''}</span>
        <span>{row.cardName || row.cardCode || 'No business partner'}</span>
        <small>{formatDashboardDate(row.updatedAt || row.documentDate)}</small>
      </button>
    )) : <div className="dashboard-empty-state">No recent authorized documents were found.</div>}
  </div>
);
