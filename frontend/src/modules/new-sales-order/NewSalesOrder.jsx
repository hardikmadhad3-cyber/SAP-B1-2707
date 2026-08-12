import React, { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';
import { useAuth } from '../../auth/AuthContext';
import {
  fetchNewSalesOrderLookup,
  fetchNewSalesOrderSchema,
  saveNewSalesOrderDummyDraft,
  validateNewSalesOrder,
} from './newSalesOrderApi';
import {
  buildNewSalesOrderIdentity,
  buildNewSalesOrderIdentityKey,
  createNewSalesOrderInitialState,
  getNewSalesOrderFieldKey,
  newSalesOrderReducer,
  readNewSalesOrderFieldValue,
} from './newSalesOrderState';
import {
  buildNewSalesOrderDummyPayload,
  buildNewSalesOrderRequest,
} from './newSalesOrderDummyPayload';
import {
  normalizeNewSalesOrderServerErrors,
  validateNewSalesOrderForm,
} from './newSalesOrderValidation';
import {
  NEW_SALES_ORDER_OBJECT_TYPE,
  NEW_SALES_ORDER_SUBTITLE,
} from './newSalesOrderConstants';
import NewSalesOrderContentsTab from './components/NewSalesOrderContentsTab';
import NewSalesOrderHeader from './components/NewSalesOrderHeader';
import NewSalesOrderSummary from './components/NewSalesOrderSummary';
import NewSalesOrderTabs from './components/NewSalesOrderTabs';
import SchemaDebugPanel from './components/SchemaDebugPanel';
import TestModeBanner from './components/TestModeBanner';
import './NewSalesOrder.css';

const isCancelledRequest = (error) => (
  error?.name === 'AbortError' || error?.name === 'CanceledError' || error?.code === 'ERR_CANCELED'
);

const getErrorMessage = (error, fallback) => (
  error?.response?.data?.message
  || error?.response?.data?.detail
  || error?.message
  || fallback
);

const getLookupSource = (field = {}) => String(
  field.lookup?.source || field.lookupSource || (field.renderer === 'item-lookup' ? 'items' : ''),
).trim().toLowerCase();

const makeRequestId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

const findItemCode = (schema, record) => {
  const itemField = (schema?.lineFields || []).find((field) => (
    ['ITEMCODE', 'ITEMNO'].includes(String(field.sapField || field.databaseField || '').toUpperCase())
    || String(field.renderer || '').toLowerCase() === 'item-lookup'
  ));
  return itemField ? String(readNewSalesOrderFieldValue(record, itemField) || '').trim() : '';
};

const findItemDescriptionField = (schema) => (
  (schema?.lineFields || []).find((field) => (
    ['ITEMDESCRIPTION', 'DSCRIPTION'].includes(String(field.sapField || field.databaseField || '').toUpperCase())
  ))
);

const normalizeLookupItems = (response = {}) => (
  (response.items || response.options || []).map((option) => ({
    ...(typeof option === 'object' ? option : {}),
    value: String(typeof option === 'object' ? option?.value ?? '' : option ?? ''),
    label: String(typeof option === 'object' ? option?.label ?? option?.description ?? option?.value ?? '' : option ?? ''),
    description: String(typeof option === 'object' ? option?.description ?? '' : ''),
  }))
);

function NewSalesOrder() {
  const { company, user } = useAuth();
  const [state, dispatch] = useReducer(newSalesOrderReducer, undefined, createNewSalesOrderInitialState);
  const schemaControllerRef = useRef(null);
  const requestControllersRef = useRef(new Map());

  const identity = useMemo(
    () => buildNewSalesOrderIdentity(company, user),
    [company?.companyId, company?.dbName, user?.userId, user?.username],
  );
  const identityKey = useMemo(() => buildNewSalesOrderIdentityKey(identity), [identity]);
  const stateIsCurrent = state.identityKey === identityKey;
  const schemaReady = stateIsCurrent && state.schemaStatus === 'ready' && Boolean(state.schema);

  const abortFeatureRequests = useCallback(() => {
    schemaControllerRef.current?.abort();
    schemaControllerRef.current = null;
    requestControllersRef.current.forEach((controller) => controller.abort());
    requestControllersRef.current.clear();
  }, []);

  useEffect(() => {
    abortFeatureRequests();
    dispatch({ type: 'COMPANY_CHANGE_STARTED', identity, identityKey });
    if (!identity.companyId) return undefined;

    const controller = new AbortController();
    schemaControllerRef.current = controller;
    fetchNewSalesOrderSchema({ signal: controller.signal })
      .then((schema) => {
        dispatch({ type: 'SCHEMA_LOAD_SUCCEEDED', identityKey, schema });
      })
      .catch((error) => {
        if (!isCancelledRequest(error)) {
          dispatch({
            type: 'SCHEMA_LOAD_FAILED',
            identityKey,
            message: getErrorMessage(error, 'Unable to load the active company field schema.'),
          });
        }
      })
      .finally(() => {
        if (schemaControllerRef.current === controller) schemaControllerRef.current = null;
      });

    return () => controller.abort();
  }, [abortFeatureRequests, identity, identityKey]);

  useEffect(() => () => abortFeatureRequests(), [abortFeatureRequests]);

  const requestLookup = useCallback(async (field, record, q = '', page = 1, lineId = '') => {
    if (!schemaReady) return;
    const source = getLookupSource(field);
    const fieldKey = lineId ? `${lineId}:${field.id || getNewSalesOrderFieldKey(field)}` : (field.id || getNewSalesOrderFieldKey(field));
    const requestId = makeRequestId();
    const capturedIdentityKey = state.identityKey;

    requestControllersRef.current.get(fieldKey)?.abort();
    const controller = new AbortController();
    requestControllersRef.current.set(fieldKey, controller);
    dispatch({ type: 'LOOKUP_LOAD_STARTED', identityKey: capturedIdentityKey, fieldKey, requestId, query: q });

    try {
      const response = await fetchNewSalesOrderLookup(source, {
        q,
        page,
        fieldId: field.lookup?.fieldId || field.id,
        schemaVersion: state.schema.schemaVersion,
        itemCode: lineId ? findItemCode(state.schema, record) : '',
        signal: controller.signal,
      });
      if (response.companyId !== undefined && String(response.companyId) !== String(state.identity?.companyId)) {
        throw new Error('The lookup response belongs to a different company.');
      }
      dispatch({
        type: 'LOOKUP_LOAD_SUCCEEDED',
        identityKey: capturedIdentityKey,
        fieldKey,
        requestId,
        items: normalizeLookupItems(response),
        page: Number(response.page) || Number(page) || 1,
        limit: response.limit,
        hasMore: response.hasMore,
      });
    } catch (error) {
      if (!isCancelledRequest(error)) {
        dispatch({
          type: 'LOOKUP_LOAD_FAILED',
          identityKey: capturedIdentityKey,
          fieldKey,
          requestId,
          message: getErrorMessage(error, 'Unable to load lookup values.'),
        });
      }
    } finally {
      if (requestControllersRef.current.get(fieldKey) === controller) requestControllersRef.current.delete(fieldKey);
    }
  }, [schemaReady, state.identity?.companyId, state.identityKey, state.schema]);

  const localPayload = useMemo(
    () => (schemaReady ? buildNewSalesOrderDummyPayload(state.schema, state.formData) : null),
    [schemaReady, state.formData, state.schema],
  );

  const runLocalValidation = useCallback(() => {
    const result = validateNewSalesOrderForm({
      schema: state.schema,
      formData: state.formData,
      lookups: state.lookups,
    });
    dispatch({ type: 'SET_ERRORS', errors: result.errors });
    dispatch({ type: 'SET_PAYLOAD_PREVIEW', payload: localPayload });
    return result;
  }, [localPayload, state.formData, state.lookups, state.schema]);

  const handleValidate = async () => {
    if (!schemaReady) return;
    const local = runLocalValidation();
    if (!local.valid) {
      dispatch({ type: 'VALIDATION_FINISHED', valid: false, errors: local.errors, payload: localPayload, message: 'Correct the highlighted test fields.' });
      return;
    }

    const request = buildNewSalesOrderRequest(state.schema, state.formData);
    const controller = new AbortController();
    requestControllersRef.current.get('validate')?.abort();
    requestControllersRef.current.set('validate', controller);
    const capturedIdentityKey = state.identityKey;
    dispatch({ type: 'VALIDATION_STARTED' });
    try {
      const response = await validateNewSalesOrder(request, { signal: controller.signal });
      const errors = normalizeNewSalesOrderServerErrors(response.errors, request.formData);
      dispatch({
        type: 'VALIDATION_FINISHED',
        identityKey: capturedIdentityKey,
        valid: Boolean(response.valid),
        errors,
        payload: response.payload || localPayload,
        message: response.valid ? 'Frontend and backend validation passed.' : 'Backend validation found test-data errors.',
      });
    } catch (error) {
      if (!isCancelledRequest(error)) {
        const serverErrors = error?.response?.data?.details?.validationErrors;
        dispatch({
          type: 'VALIDATION_FINISHED',
          identityKey: capturedIdentityKey,
          valid: false,
          errors: normalizeNewSalesOrderServerErrors(serverErrors || [{ message: getErrorMessage(error, 'Validation failed.') }], request.formData),
          payload: localPayload,
          message: getErrorMessage(error, 'Validation failed.'),
        });
      }
    } finally {
      if (requestControllersRef.current.get('validate') === controller) requestControllersRef.current.delete('validate');
    }
  };

  const handleSaveDummy = async () => {
    if (!schemaReady) return;
    const local = runLocalValidation();
    if (!local.valid) {
      dispatch({ type: 'DUMMY_SAVE_FAILED', identityKey: state.identityKey, errors: local.errors, message: 'Correct the highlighted test fields before saving.' });
      return;
    }

    const request = buildNewSalesOrderRequest(state.schema, state.formData);
    const controller = new AbortController();
    requestControllersRef.current.get('dummy-save')?.abort();
    requestControllersRef.current.set('dummy-save', controller);
    const capturedIdentityKey = state.identityKey;
    dispatch({ type: 'DUMMY_SAVE_STARTED' });
    try {
      const response = await saveNewSalesOrderDummyDraft(request, { signal: controller.signal });
      const number = response.draft?.dummyDocumentNumber;
      dispatch({
        type: 'DUMMY_SAVE_SUCCEEDED',
        identityKey: capturedIdentityKey,
        draft: response.draft,
        payload: response.payload || response.draft?.generatedPayload || localPayload,
        message: number ? `Local dummy draft ${number} saved. No SAP document was created.` : 'Local dummy draft saved. No SAP document was created.',
      });
    } catch (error) {
      if (!isCancelledRequest(error)) {
        const serverErrors = error?.response?.data?.details?.validationErrors;
        dispatch({
          type: 'DUMMY_SAVE_FAILED',
          identityKey: capturedIdentityKey,
          errors: normalizeNewSalesOrderServerErrors(serverErrors, request.formData),
          message: getErrorMessage(error, 'Unable to save the local dummy draft.'),
        });
      }
    } finally {
      if (requestControllersRef.current.get('dummy-save') === controller) requestControllersRef.current.delete('dummy-save');
    }
  };

  const handleReset = () => {
    requestControllersRef.current.forEach((controller, key) => {
      if (key !== 'schema') controller.abort();
    });
    requestControllersRef.current.clear();
    dispatch({ type: 'RESET_TEST_DATA' });
  };

  const handleItemLookupSelect = (lineId, field, option) => {
    if (getLookupSource(field) !== 'items') return;
    const descriptionField = findItemDescriptionField(state.schema);
    const description = option?.description || option?.itemName || option?.label || '';
    if (descriptionField && description) {
      dispatch({ type: 'SET_LINE_FIELD', lineId, field: descriptionField, value: description });
    }
  };

  const busy = state.schemaStatus === 'loading' || state.validation.status === 'loading' || state.dummySave.status === 'loading';
  const status = state.dummySave.status !== 'idle' ? state.dummySave : state.validation;

  return (
    <main className="new-sales-order-page sap-document-page" data-testid="new-sales-order-page">
      <header className="new-sales-order-page__titlebar">
        <div>
          <h1>New Sales Order</h1>
          <p>{NEW_SALES_ORDER_SUBTITLE}</p>
        </div>
        <div className="new-sales-order-page__identity" aria-label="Active company context">
          <span>Company</span>
          <strong>{company?.companyName || company?.dbName || 'Not selected'}</strong>
          <small>Object Type {NEW_SALES_ORDER_OBJECT_TYPE}</small>
        </div>
      </header>

      <TestModeBanner />

      {!identity.companyId ? (
        <div className="new-sales-order-page__alert is-error" role="alert">Select an authenticated company before opening this test page.</div>
      ) : null}
      {!stateIsCurrent || state.schemaStatus === 'loading' ? (
        <div className="new-sales-order-page__loading" role="status">Loading the active company schema{'\u2026'}</div>
      ) : null}
      {stateIsCurrent && state.schemaError ? (
        <div className="new-sales-order-page__alert is-error" role="alert">{state.schemaError}</div>
      ) : null}

      {schemaReady ? (
        <>
          <NewSalesOrderHeader
            fields={state.schema.headerFields}
            record={state.formData.header}
            errors={state.errors.header}
            lookups={state.lookups}
            onChange={(field, value) => dispatch({ type: 'SET_HEADER_FIELD', field, value })}
            onRequestLookup={requestLookup}
          />

          <section className="new-sales-order-page__document-card">
            <NewSalesOrderTabs activeTab={state.activeTab} onChange={(tab) => dispatch({ type: 'SET_ACTIVE_TAB', tab })} />
            {state.activeTab === 'Contents' ? (
              <NewSalesOrderContentsTab
                fields={state.schema.lineFields}
                lines={state.formData.lines}
                errors={state.errors.lines}
                lookups={state.lookups}
                onAddLine={() => dispatch({ type: 'ADD_LINE' })}
                onRemove={(lineId) => dispatch({ type: 'REMOVE_LINE', lineId })}
                onChange={(lineId, field, value) => dispatch({ type: 'SET_LINE_FIELD', lineId, field, value })}
                onRequestLookup={requestLookup}
                onLookupSelect={handleItemLookupSelect}
              />
            ) : (
              <section className="new-sales-order-page__tab-panel new-sales-order-page__placeholder" role="tabpanel" aria-label={state.activeTab}>
                <h2>{state.activeTab}</h2>
                <p>This safe test placeholder does not call any SAP write API.</p>
              </section>
            )}
          </section>

          <div className="new-sales-order-page__footer-grid">
            <div>
              {state.errors.form?.length ? (
                <div className="new-sales-order-page__alert is-error" role="alert">
                  {state.errors.form.map((message) => <div key={message}>{message}</div>)}
                </div>
              ) : null}
              {status.status !== 'idle' && status.message ? (
                <div className={`new-sales-order-page__alert is-${status.status}`} role="status">{status.message}</div>
              ) : null}
              <div className="new-sales-order-page__actions">
                <button type="button" className="new-sales-order-page__button" disabled={busy} onClick={handleValidate}>Validate</button>
                <button type="button" className="new-sales-order-page__button is-primary" disabled={busy} onClick={handleSaveDummy}>Save Dummy Draft</button>
                <button type="button" className="new-sales-order-page__button" disabled={busy} onClick={handleReset}>Reset Test Data</button>
              </div>
              <SchemaDebugPanel
                open={state.debugOpen}
                onToggle={() => dispatch({ type: 'TOGGLE_DEBUG' })}
                schema={state.schema}
                identity={state.identity}
                payload={state.payloadPreview || localPayload}
              />
            </div>
            <NewSalesOrderSummary schema={state.schema} formData={state.formData} />
          </div>
        </>
      ) : null}
    </main>
  );
}

export default NewSalesOrder;
