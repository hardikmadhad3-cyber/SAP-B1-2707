import React from "react";
import useFloatingWindow from "./useFloatingWindow";

const MODE_OPTIONS = ["Ignore", "Include selected", "Exclude selected"];

export default function SalesAnalysisPropertiesModal({
  open,
  title,
  mode,
  properties,
  options,
  onModeChange,
  onToggleProperty,
  onClose,
  onApply,
}) {
  const windowFrame = useFloatingWindow({ isOpen: open, defaultTop: 60, bounds: "parent" });

  if (!open) return null;

  const isIgnoring = mode === "Ignore";

  return (
    <div className="sap-properties-modal__backdrop" onClick={onClose}>
      <div
        className="sap-properties-modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
        {...windowFrame.windowProps}
      >
        <div className="sap-properties-modal__titlebar" {...windowFrame.titleBarProps}>
          <div className="sap-properties-modal__title">{title}</div>
          <div className="sap-properties-modal__controls">
            <button
              type="button"
              aria-label={windowFrame.isMinimized ? "Restore" : "Minimize"}
              onClick={windowFrame.toggleMinimize}
            >
              {windowFrame.isMinimized ? "□" : "-"}
            </button>
            <button
              type="button"
              aria-label={windowFrame.isMaximized ? "Restore" : "Maximize"}
              title={windowFrame.isMaximized ? "Restore" : "Maximize"}
              onClick={windowFrame.toggleMaximize}
            >
              []
            </button>
            <button type="button" aria-label="Close" onClick={onClose}>x</button>
          </div>
        </div>

        <div className="sap-properties-modal__accent" />

        {!windowFrame.isMinimized ? (
          <div className="sap-properties-modal__body">
            <div className="sap-properties-modal__panel">
              <div className="sap-properties-modal__top-options">
                <div className="sap-properties-modal__link-row">
                  {MODE_OPTIONS.map((option) => (
                    <label className="sap-properties-modal__radio-line" key={option}>
                      <input
                        type="radio"
                        name="propertiesMode"
                        checked={mode === option}
                        onChange={() => onModeChange(option)}
                      />
                      <span>{option}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className={`sap-properties-modal__grid-wrap${isIgnoring ? " is-disabled" : ""}`}>
                <table className="sap-properties-modal__grid">
                  <thead>
                    <tr>
                      <th className="is-check">&nbsp;</th>
                      <th className="is-index">&nbsp;</th>
                      <th className="is-property">Property</th>
                    </tr>
                  </thead>
                  <tbody>
                    {options.map((option) => {
                      const isSelected = properties.includes(option.number);
                      return (
                        <tr
                          key={option.number}
                          className={isSelected ? "is-selected" : ""}
                          onClick={() => {
                            if (!isIgnoring) onToggleProperty(option.number);
                          }}
                        >
                          <td className="is-check">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              disabled={isIgnoring}
                              onChange={() => onToggleProperty(option.number)}
                              onClick={(event) => event.stopPropagation()}
                            />
                          </td>
                          <td className="is-index">{option.number}</td>
                          <td className="is-property">{option.name}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="sap-properties-modal__footer">
              <button type="button" className="sap-properties-modal__primary-btn sap-report-btn sap-report-btn--primary" onClick={onApply}>
                OK
              </button>
              <button type="button" className="sap-properties-modal__primary-btn sap-report-btn" onClick={onClose}>
                Cancel
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
