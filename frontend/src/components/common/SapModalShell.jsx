import React, { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';

const openModalStack = [];

const resolvePortalTarget = (portalTarget) => {
  if (typeof document === 'undefined') return null;
  if (typeof portalTarget === 'function') return portalTarget();
  return portalTarget || document.querySelector('.app-shell__content') || document.body;
};

export default function SapModalShell({
  open,
  title,
  onClose,
  children,
  footer,
  size = 'standard',
  width,
  className = '',
  overlayClassName = '',
  bodyClassName = '',
  footerClassName = '',
  closeOnBackdrop = true,
  closeOnEscape = true,
  portalTarget,
  ariaLabel,
  ariaLabelledBy,
  loading = false,
  disabled = false,
  nested = false,
  hideClose = false,
  style,
  overlayStyle,
  ...dialogProps
}) {
  const generatedTitleId = useId();
  const titleId = ariaLabelledBy || generatedTitleId;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return undefined;
    openModalStack.push(generatedTitleId);
    const handleKeyDown = (event) => {
      if (
        event.key === 'Escape' &&
        closeOnEscape &&
        !disabled &&
        openModalStack[openModalStack.length - 1] === generatedTitleId
      ) {
        onCloseRef.current?.();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      const stackIndex = openModalStack.lastIndexOf(generatedTitleId);
      if (stackIndex >= 0) openModalStack.splice(stackIndex, 1);
    };
  }, [closeOnEscape, disabled, generatedTitleId, open]);

  if (!open) return null;

  const target = resolvePortalTarget(portalTarget);
  const overlayClasses = [
    'sap-modal-shell__overlay',
    nested ? 'sap-modal-shell__overlay--nested' : '',
    overlayClassName,
  ].filter(Boolean).join(' ');
  const dialogClasses = [
    'sap-modal-shell',
    `sap-modal-shell--${size}`,
    loading ? 'is-loading' : '',
    disabled ? 'is-disabled' : '',
    className,
  ].filter(Boolean).join(' ');

  const modal = (
    <div
      className={overlayClasses}
      role="presentation"
      style={overlayStyle}
      onMouseDown={(event) => {
        if (closeOnBackdrop && !disabled && event.target === event.currentTarget) onClose?.();
      }}
    >
      <section
        {...dialogProps}
        className={dialogClasses}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        aria-labelledby={ariaLabel ? undefined : titleId}
        aria-busy={loading || undefined}
        data-disabled={disabled || undefined}
        style={{ ...style, ...(width ? { width } : {}) }}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="sap-modal-shell__header">
          <span id={titleId}>{title}</span>
          {!hideClose && (
            <button
              type="button"
              className="sap-modal-shell__close"
              aria-label={`Close ${title || 'dialog'}`}
              onClick={onClose}
              disabled={disabled}
            >
              x
            </button>
          )}
        </header>
        <div className={`sap-modal-shell__body ${bodyClassName}`.trim()}>{children}</div>
        {footer !== undefined && footer !== null && (
          <footer className={`sap-modal-shell__footer ${footerClassName}`.trim()}>{footer}</footer>
        )}
      </section>
    </div>
  );

  return target ? createPortal(modal, target) : modal;
}
