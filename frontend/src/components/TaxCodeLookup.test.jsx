import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import TaxCodeLookup from './TaxCodeLookup';

test('renders selected tax code option with high contrast in the menu', () => {
  render(
    <TaxCodeLookup
      value="12-GST"
      taxCodes={[
        { Code: '0-GST', Name: 'SGST@0%+CGST@0%', Rate: 0 },
        { Code: '12-GST', Name: 'SGST@6% + CGST@6%', Rate: 12 },
      ]}
      onChange={jest.fn()}
      className="so-grid__input"
    />
  );

  fireEvent.focus(screen.getByPlaceholderText('Search tax code'));

  const selectedOption = screen.getByRole('button', { name: /12-GST/ });
  expect(selectedOption).toHaveAttribute('data-selected', 'true');
  expect(selectedOption).toHaveStyle({
    background: '#0b5cab',
    color: '#fff',
    fontWeight: '700',
  });
});