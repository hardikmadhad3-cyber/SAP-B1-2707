import React, { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { installSapDateShortcuts, resolveSapDateShortcut } from './sapDateShortcuts';

describe('resolveSapDateShortcut', () => {
  const reference = new Date(2026, 5, 19);

  test.each([
    ['19', '2026-06-19'],
    ['1207', '2026-07-12'],
    ['121205', '2005-12-12'],
    ['12122025', '2025-12-12'],
    ['1/7/2026', '2026-07-01'],
    ['2026-07-01', '2026-07-01'],
    ['w', '2026-06-19'],
  ])('resolves %s to %s', (entry, expected) => {
    expect(resolveSapDateShortcut(entry, reference)).toEqual({ value: expected, error: '' });
  });

  test.each(['0', '31', '3102', '29022025', '12345', '121220256'])('rejects invalid entry %s', (entry) => {
    expect(resolveSapDateShortcut(entry, reference).value).toBe('');
  });
});

describe('installSapDateShortcuts', () => {
  let uninstall;

  afterEach(() => {
    uninstall?.();
    document.body.innerHTML = '';
    jest.useRealTimers();
  });

  test('commits a day in the current month before Tab moves focus', () => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 5, 19));
    document.body.innerHTML = '<input type=date name=postingDate><input name=next>';
    const input = document.querySelector('[name=postingDate]');
    const changed = jest.fn();
    input.addEventListener('change', changed);
    uninstall = installSapDateShortcuts();

    input.dispatchEvent(new KeyboardEvent('keydown', { key: '1', bubbles: true }));
    input.dispatchEvent(new KeyboardEvent('keydown', { key: '9', bubbles: true }));
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));

    expect(input.value).toBe('2026-06-19');
    expect(changed).toHaveBeenCalledTimes(1);
    expect(document.getElementById('sap-date-entry-hint')).not.toBeInTheDocument();
  });

  test('updates a React controlled date input through its existing onChange handler', () => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 5, 19));
    const ControlledDate = () => {
      const [value, setValue] = useState('2026-06-01');
      return React.createElement('input', {
        'aria-label': 'Posting Date',
        type: 'date',
        value,
        onChange: (event) => setValue(event.target.value),
      });
    };
    uninstall = installSapDateShortcuts();
    render(React.createElement(ControlledDate));
    const input = screen.getByLabelText('Posting Date');

    fireEvent.keyDown(input, { key: '1' });
    fireEvent.keyDown(input, { key: '9' });
    fireEvent.keyDown(input, { key: 'Tab' });

    expect(input).toHaveValue('2026-06-19');
  });

  test('supports the formatted text date controls used by banking headers', () => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 5, 19));
    const formatBankingDate = (value) => {
      const [year, month, day] = value.split('-');
      return `${day}/${month}/${year.slice(2)}`;
    };
    const BankingDate = () => {
      const [value, setValue] = useState('2026-06-01');
      return React.createElement('input', {
        'aria-label': 'Banking Posting Date',
        'data-sap-date-input': 'true',
        value: formatBankingDate(value),
        onChange: (event) => setValue(event.target.value),
      });
    };
    uninstall = installSapDateShortcuts();
    render(React.createElement(BankingDate));
    const input = screen.getByLabelText('Banking Posting Date');

    fireEvent.keyDown(input, { key: '1' });
    fireEvent.keyDown(input, { key: '9' });
    fireEvent.keyDown(input, { key: 'Tab' });

    expect(input).toHaveValue('19/06/26');
  });

  test('does not replace an existing value when the shortcut is an impossible date', () => {
    document.body.innerHTML = '<input type=date value=2026-06-19>';
    const input = document.querySelector('input');
    uninstall = installSapDateShortcuts();

    for (const key of ['3', '1', '0', '2']) {
      input.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
    }
    const tabEvent = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    input.dispatchEvent(tabEvent);

    expect(tabEvent.defaultPrevented).toBe(true);
    expect(input.value).toBe('2026-06-19');
    expect(input.validationMessage).toBe('Enter a valid calendar date.');
  });
});
