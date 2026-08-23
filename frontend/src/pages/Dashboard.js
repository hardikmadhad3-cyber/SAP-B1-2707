import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { flattenMenuTree, normalizePath } from '../auth/routeUtils';
import { fetchDashboardOverview } from '../api/dashboardApi';
import {
  HorizontalBarChart,
  KpiWidget,
  RecentUpdates,
  RevenueGrossProfitChart,
  SalesProcess,
} from '../components/dashboard/DashboardWidgets';
import { formatDashboardDate } from '../components/dashboard/dashboardUtils';
import {
  buildCompanyStorageScope,
  createCompanyScopedRouteState,
} from '../utils/companyStorageScope';
import '../styles/dashboard.css';

const DASHBOARD_LAYOUT_KEY = 'sap-b1-dashboard-layout-v3';
const DASHBOARD_EXPANDED_KEY = 'sap-b1-dashboard-expanded-v3';

const DEFAULT_WIDGETS = [
  { id: 'sales-amount', title: 'Total Sales Amount', size: 'compact' },
  { id: 'receivable-amount', title: 'Total Receivable Amount', size: 'compact' },
  { id: 'open-orders', title: 'Sales Orders Not Delivered', size: 'compact' },
  { id: 'sales-process', title: 'Sales Process', size: 'wide' },
  { id: 'top-items', title: 'Top 5 Best-Selling Items by Sales Amount', size: 'compact' },
  { id: 'revenue-profit', title: 'Revenue Versus Gross Profit', size: 'wide' },
  { id: 'recent-updates', title: 'Recent Updates', size: 'compact' },
  { id: 'top-customers', title: 'Top 5 Customers by Sales Amount', size: 'wide' },
  { id: 'quick-actions', title: 'Quick Actions', size: 'compact' },
];

const scopedStorageKey = (baseKey, company) => `${baseKey}::${buildCompanyStorageScope(company)}`;

const readStoredLayout = (company) => {
  if (typeof window === 'undefined') return DEFAULT_WIDGETS.map((widget) => widget.id);
  try {
    const parsed = JSON.parse(window.localStorage.getItem(scopedStorageKey(DASHBOARD_LAYOUT_KEY, company)) || '[]');
    const validIds = DEFAULT_WIDGETS.map((widget) => widget.id);
    const filtered = Array.isArray(parsed) ? parsed.filter((id) => validIds.includes(id)) : [];
    return [...filtered, ...validIds.filter((id) => !filtered.includes(id))];
  } catch (_error) {
    return DEFAULT_WIDGETS.map((widget) => widget.id);
  }
};

const readExpandedState = (company) => {
  const defaults = Object.fromEntries(DEFAULT_WIDGETS.map((widget) => [widget.id, true]));
  if (typeof window === 'undefined') return defaults;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(scopedStorageKey(DASHBOARD_EXPANDED_KEY, company)) || '{}');
    return Object.fromEntries(DEFAULT_WIDGETS.map((widget) => [widget.id, parsed[widget.id] !== false]));
  } catch (_error) {
    return defaults;
  }
};

const moveWidget = (layout, draggedId, targetId) => {
  if (!draggedId || !targetId || draggedId === targetId) return layout;
  const next = [...layout];
  const fromIndex = next.indexOf(draggedId);
  const toIndex = next.indexOf(targetId);
  if (fromIndex === -1 || toIndex === -1) return layout;
  next.splice(fromIndex, 1);
  next.splice(toIndex, 0, draggedId);
  return next;
};

const getDisplayMenuName = (menu) => {
  const menuPath = normalizePath(menu?.menuPath || '');
  const routeLabels = {
    '/services/ar-invoice': 'A/R Invoice Service',
    '/services/ap-invoice': 'A/P Invoice Service',
    '/services/ap-credit-memo': 'A/P Credit Memo Service',
    '/services/ar-credit-memo': 'A/R Credit Memo Service',
    '/ar-invoice': 'A/R Invoice Item',
    '/ap-invoice': 'A/P Invoice Item',
    '/ar-credit-memo': 'A/R Credit Memo Item',
    '/ap-credit-memo': 'A/P Credit Memo Item',
  };
  if (routeLabels[menuPath]) return routeLabels[menuPath];
  return String(menu?.menuName || '').trim().toLowerCase() === 'sales' ? 'Sales - A/R' : menu?.menuName;
};

const prioritizeMenus = (items = [], preferredNames = []) => {
  const preferred = preferredNames.map((name) => String(name || '').trim().toLowerCase());
  return [...items].sort((left, right) => {
    const leftIndex = preferred.indexOf(String(left.menuName || '').trim().toLowerCase());
    const rightIndex = preferred.indexOf(String(right.menuName || '').trim().toLowerCase());
    const leftPriority = leftIndex === -1 ? 999 : leftIndex;
    const rightPriority = rightIndex === -1 ? 999 : rightIndex;
    return leftPriority !== rightPriority
      ? leftPriority - rightPriority
      : Number(left.sortOrder || 0) - Number(right.sortOrder || 0);
  });
};

const ActionGrid = ({ items, navigate }) => (
  <div className="dashboard-quick-grid">
    {items.length ? items.map((menu) => (
      <button key={menu.menuId} type="button" className="dashboard-quick-card" onClick={() => navigate(menu.menuPath)}>
        <span className="dashboard-quick-card__name">{menu.menuName}</span>
      </button>
    )) : <div className="dashboard-empty-state">No shortcuts are available for this role.</div>}
  </div>
);

const SALES_PROCESS_DEFINITIONS = [
  { path: '/sales-quotation', label: 'Sales Quotation', symbol: 'Q' },
  { path: '/sales-order', label: 'Sales Order', symbol: 'SO' },
  { path: '/delivery', label: 'Delivery', symbol: 'D' },
  { path: '/ar-invoice', label: 'A/R Invoice', symbol: 'AR' },
  { path: '/incoming-payments', label: 'Incoming Payment', symbol: '₹' },
];

const Dashboard = () => {
  const navigate = useNavigate();
  const { company, menus } = useAuth();
  const companyScope = buildCompanyStorageScope(company);
  const actionMenus = useMemo(() => flattenMenuTree(menus)
    .filter((menu) => menu.menuPath)
    .map((menu) => ({
      ...menu,
      menuPath: normalizePath(menu.menuPath),
      menuName: getDisplayMenuName(menu),
    })), [menus]);
  const allowedPaths = useMemo(() => new Set(actionMenus.map((menu) => menu.menuPath)), [actionMenus]);
  const shortcutMenus = useMemo(() => prioritizeMenus(actionMenus, [
    'Sales Order', 'Delivery', 'A/R Invoice Item', 'A/R Invoice Service',
    'A/P Invoice Service', 'A/P Invoice Item', 'Business Partner', 'Item Master',
  ]).slice(0, 12), [actionMenus]);
  const salesProcessSteps = useMemo(() => SALES_PROCESS_DEFINITIONS.filter((step) => allowedPaths.has(step.path)), [allowedPaths]);

  const [overview, setOverview] = useState(null);
  const [dashboardState, setDashboardState] = useState({ loading: true, refreshing: false, error: '' });
  const [widgetOrder, setWidgetOrder] = useState(() => readStoredLayout(company));
  const [expandedWidgets, setExpandedWidgets] = useState(() => readExpandedState(company));
  const [draggedWidgetId, setDraggedWidgetId] = useState('');
  const [dropTargetId, setDropTargetId] = useState('');
  const requestIdRef = useRef(0);

  useEffect(() => {
    setWidgetOrder(readStoredLayout(company));
    setExpandedWidgets(readExpandedState(company));
  }, [companyScope]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    window.localStorage.setItem(scopedStorageKey(DASHBOARD_LAYOUT_KEY, company), JSON.stringify(widgetOrder));
  }, [companyScope, widgetOrder]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    window.localStorage.setItem(scopedStorageKey(DASHBOARD_EXPANDED_KEY, company), JSON.stringify(expandedWidgets));
  }, [companyScope, expandedWidgets]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadOverview = useCallback(async ({ refresh = false, silent = false, initial = false } = {}) => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setDashboardState((current) => ({
      loading: initial ? true : (silent ? current.loading : !overview),
      refreshing: refresh || silent,
      error: '',
    }));
    try {
      const response = await fetchDashboardOverview({ refresh });
      if (requestId !== requestIdRef.current) return;
      setOverview(response);
      setDashboardState({ loading: false, refreshing: false, error: '' });
    } catch (error) {
      if (requestId !== requestIdRef.current) return;
      setDashboardState({
        loading: false,
        refreshing: false,
        error: error?.response?.data?.message || error?.message || 'Unable to load live dashboard data.',
      });
    }
  }, [overview]);

  useEffect(() => {
    setOverview(null);
    loadOverview({ initial: true });
    return () => {
      requestIdRef.current += 1;
    };
  }, [companyScope]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') loadOverview({ silent: true });
    }, 60000);
    return () => window.clearInterval(timer);
  }, [loadOverview]);

  const openRecentDocument = useCallback((documentRow) => {
    if (!documentRow?.route || !allowedPaths.has(documentRow.route)) return;
    navigate(documentRow.route, {
      state: createCompanyScopedRouteState({
        [documentRow.stateKey]: documentRow.docEntry,
        docEntry: documentRow.docEntry,
      }, company),
    });
  }, [allowedPaths, company, navigate]);

  const widgetsById = useMemo(() => {
    const loading = dashboardState.loading;
    const currency = overview?.currency?.local || '';
    const sales = overview?.kpis?.salesAmount || {};
    const receivable = overview?.kpis?.receivableAmount || {};
    const orders = overview?.kpis?.openSalesOrders || {};
    const orderScopeLabel = overview?.userScope?.mode === 'sales-employee'
      ? `${overview.userScope.label || 'My'} orders with remaining quantity`
      : 'Company-wide orders with remaining quantity';
    return {
      'sales-amount': (
        <KpiWidget
          value={sales.value}
          currency={currency}
          trend={sales.changePercent}
          subtitle="Fiscal year to date"
          loading={loading}
          onOpen={allowedPaths.has('/reports/sales/analysis') ? () => navigate('/reports/sales/analysis') : undefined}
        />
      ),
      'receivable-amount': (
        <KpiWidget
          value={receivable.value}
          currency={currency}
          subtitle={`Open balance as of ${formatDashboardDate(overview?.asOfDate)}`}
          loading={loading}
          onOpen={allowedPaths.has('/reports/financial/accounting/aging/customer-receivables')
            ? () => navigate('/reports/financial/accounting/aging/customer-receivables')
            : undefined}
        />
      ),
      'open-orders': (
        <KpiWidget
          value={orders.value}
          subtitle={orderScopeLabel}
          loading={loading}
          onOpen={allowedPaths.has('/sales-order') ? () => navigate('/sales-order/find') : undefined}
        />
      ),
      'sales-process': <SalesProcess steps={salesProcessSteps} onOpen={navigate} />,
      'top-items': loading ? <div className="dashboard-empty-state">Loading live item sales…</div> : (
        <HorizontalBarChart rows={overview?.topItems} currency={currency} ariaLabel="Top five items by sales amount" />
      ),
      'revenue-profit': loading ? <div className="dashboard-empty-state">Loading monthly sales…</div> : (
        <RevenueGrossProfitChart rows={overview?.revenueGrossProfit} currency={currency} />
      ),
      'recent-updates': loading ? <div className="dashboard-empty-state">Loading recent documents…</div> : (
        <RecentUpdates rows={(overview?.recentUpdates || []).filter((row) => allowedPaths.has(row.route))} onOpen={openRecentDocument} />
      ),
      'top-customers': loading ? <div className="dashboard-empty-state">Loading live customer sales…</div> : (
        <HorizontalBarChart rows={overview?.topCustomers} currency={currency} ariaLabel="Top five customers by sales amount" />
      ),
      'quick-actions': <ActionGrid items={shortcutMenus} navigate={navigate} />,
    };
  }, [allowedPaths, dashboardState.loading, navigate, openRecentDocument, overview, salesProcessSteps, shortcutMenus]);

  const handleDrop = (event, widgetId) => {
    event.preventDefault();
    setWidgetOrder((current) => moveWidget(current, draggedWidgetId, widgetId));
    setDraggedWidgetId('');
    setDropTargetId('');
  };

  const orderedWidgets = widgetOrder
    .map((widgetId) => DEFAULT_WIDGETS.find((widget) => widget.id === widgetId))
    .filter(Boolean);

  return (
    <div className="dashboard-page live-dashboard">
      <section className="dashboard-banner">
        <div className="dashboard-banner__copy">
          <div className="dashboard-banner__eyebrow">Live SAP Business One Dashboard</div>
          <h2>{company?.companyName || 'SAP Business One Web Client'}</h2>
          <p>
            {overview?.period?.from
              ? `Fiscal period ${formatDashboardDate(overview.period.from)} – ${formatDashboardDate(overview.asOfDate)}`
              : 'Loading the current company fiscal period…'}
          </p>
        </div>
        <div className="dashboard-banner__actions">
          <div className="dashboard-live-status">
            <span aria-hidden="true" />
            {overview?.generatedAt ? `Updated ${new Date(overview.generatedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}` : 'Connecting'}
          </div>
          <button
            type="button"
            className="dashboard-refresh"
            onClick={() => loadOverview({ refresh: true })}
            disabled={dashboardState.refreshing}
          >
            <span aria-hidden="true">↻</span>
            {dashboardState.refreshing ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </section>

      {dashboardState.error ? (
        <div className="dashboard-message dashboard-message--error" role="alert">
          <span>{dashboardState.error}</span>
          <button type="button" onClick={() => loadOverview({ refresh: true })}>Try again</button>
        </div>
      ) : null}
      {overview?.warnings?.length ? (
        <div className="dashboard-message dashboard-message--warning" role="status">
          Live data is partially available: {overview.warnings.join(' ')}
        </div>
      ) : null}

      <section className="dashboard-board" aria-label="Live dashboard widgets">
        {orderedWidgets.map((widget) => (
          <article
            key={widget.id}
            className={`dashboard-widget dashboard-widget--${widget.size}${dropTargetId === widget.id ? ' is-drop-target' : ''}${expandedWidgets[widget.id] ? '' : ' is-collapsed'}`}
            draggable
            onDragStart={(event) => {
              event.dataTransfer.effectAllowed = 'move';
              event.dataTransfer.setData('text/plain', widget.id);
              setDraggedWidgetId(widget.id);
              setDropTargetId(widget.id);
            }}
            onDragOver={(event) => {
              event.preventDefault();
              if (draggedWidgetId && draggedWidgetId !== widget.id) setDropTargetId(widget.id);
            }}
            onDrop={(event) => handleDrop(event, widget.id)}
            onDragEnd={() => { setDraggedWidgetId(''); setDropTargetId(''); }}
          >
            <div className="dashboard-widget__header">
              <h3>{widget.id === 'open-orders' && overview?.userScope?.mode === 'sales-employee' ? 'My Sales Orders Not Delivered' : widget.title}</h3>
              <button
                type="button"
                className="dashboard-widget__drag"
                onClick={() => setExpandedWidgets((current) => ({ ...current, [widget.id]: !current[widget.id] }))}
                aria-label={expandedWidgets[widget.id] ? `Collapse ${widget.title}` : `Expand ${widget.title}`}
                title="Collapse or expand card"
                draggable={false}
              >
                <span /><span /><span /><span /><span /><span />
              </button>
            </div>
            {expandedWidgets[widget.id] ? <div className="dashboard-widget__content">{widgetsById[widget.id]}</div> : null}
          </article>
        ))}
      </section>
    </div>
  );
};

export default Dashboard;
