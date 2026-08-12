import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import SapModalShell from './SapModalShell';

describe('SapModalShell', () => {
  test('renders an accessible dialog with body and footer', () => {
    render(
      <SapModalShell open title="Tax Information" onClose={jest.fn()} footer={<button type="button">OK</button>}>
        <label>GSTIN<input /></label>
      </SapModalShell>,
    );

    expect(screen.getByRole('dialog', { name: 'Tax Information' })).toBeInTheDocument();
    expect(screen.getByText('GSTIN')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'OK' })).toBeInTheDocument();
  });

  test('supports backdrop and Escape closing', () => {
    const onClose = jest.fn();
    const { container } = render(<SapModalShell open title="Dialog" onClose={onClose}>Body</SapModalShell>);
    const overlay = document.querySelector('.sap-modal-shell__overlay') || container.querySelector('.sap-modal-shell__overlay');

    fireEvent.mouseDown(screen.getByRole('dialog'));
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.mouseDown(overlay);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  test('honors close controls and nested layering', () => {
    const onClose = jest.fn();
    render(
      <SapModalShell open nested title="Picker" onClose={onClose} closeOnBackdrop={false} closeOnEscape={false}>
        Body
      </SapModalShell>,
    );

    const overlay = document.querySelector('.sap-modal-shell__overlay');
    expect(overlay).toHaveClass('sap-modal-shell__overlay--nested');
    fireEvent.mouseDown(overlay);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Close Picker' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('uses an explicit portal target and exposes busy state', () => {
    const target = document.createElement('div');
    document.body.appendChild(target);
    render(<SapModalShell open loading title="Loading" onClose={jest.fn()} portalTarget={target}>Body</SapModalShell>);

    expect(target.querySelector('[role="dialog"]')).toHaveAttribute('aria-busy', 'true');
    target.remove();
  });

  test('Escape closes only the topmost nested dialog', () => {
    const closeParent = jest.fn();
    const closeChild = jest.fn();
    render(
      <>
        <SapModalShell open title="Parent" onClose={closeParent}>Parent body</SapModalShell>
        <SapModalShell open nested title="Child" onClose={closeChild}>Child body</SapModalShell>
      </>,
    );

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(closeChild).toHaveBeenCalledTimes(1);
    expect(closeParent).not.toHaveBeenCalled();
  });
});
