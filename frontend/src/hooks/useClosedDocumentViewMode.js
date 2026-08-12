import { useLayoutEffect } from 'react';

const CONTROL_SELECTOR = 'input, select, textarea, button';
const NAVIGATION_SELECTOR = [
  '.del-tab',
  '.po-tab',
  '.so-tab',
  '[role="tab"]',
  '[data-allow-closed-navigation="true"]',
].join(',');

const READONLY_INPUT_TYPES = new Set([
  'color',
  'date',
  'datetime-local',
  'email',
  'month',
  'number',
  'password',
  'search',
  'tel',
  'text',
  'time',
  'url',
  'week',
]);

const rememberState = (control) => {
  if (control.dataset.sapClosedModeApplied === 'true') return;
  control.dataset.sapClosedModeApplied = 'true';
  control.dataset.sapClosedPrevDisabled = control.disabled ? 'true' : 'false';
  control.dataset.sapClosedPrevReadOnly = control.readOnly ? 'true' : 'false';
};

const restoreState = (control) => {
  if (control.dataset.sapClosedModeApplied !== 'true') return;
  control.disabled = control.dataset.sapClosedPrevDisabled === 'true';
  control.readOnly = control.dataset.sapClosedPrevReadOnly === 'true';
  control.removeAttribute('aria-disabled');
  delete control.dataset.sapClosedModeApplied;
  delete control.dataset.sapClosedPrevDisabled;
  delete control.dataset.sapClosedPrevReadOnly;
};

const canUseReadOnly = (control) => {
  if (control.tagName === 'TEXTAREA') return true;
  if (control.tagName !== 'INPUT') return false;
  return READONLY_INPUT_TYPES.has(String(control.type || 'text').toLowerCase());
};

const applyClosedMode = (root) => {
  root.classList.add('sap-document-readonly-scope');
  root.querySelectorAll(CONTROL_SELECTOR).forEach((control) => {
    if (control.closest(NAVIGATION_SELECTOR)) {
      restoreState(control);
      return;
    }

    rememberState(control);
    if (canUseReadOnly(control)) {
      control.readOnly = true;
    } else {
      control.disabled = true;
    }
    control.setAttribute('aria-disabled', 'true');
  });
};

const restoreClosedMode = (root) => {
  root.classList.remove('sap-document-readonly-scope');
  root.querySelectorAll(CONTROL_SELECTOR).forEach(restoreState);
};

export default function useClosedDocumentViewMode(scopeRef, isReadOnly, dependencies = []) {
  useLayoutEffect(() => {
    const root = scopeRef.current;
    if (!root) return undefined;

    if (!isReadOnly) {
      restoreClosedMode(root);
      return undefined;
    }

    applyClosedMode(root);
    const observer = new MutationObserver(() => applyClosedMode(root));
    observer.observe(root, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeRef, isReadOnly, ...dependencies]);
}
