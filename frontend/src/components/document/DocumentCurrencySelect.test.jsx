import React from 'react';
import { render, screen } from '@testing-library/react';
import DocumentCurrencySelect from './DocumentCurrencySelect';

const currencies = [
  { CurrCode: 'INR', CurrName: 'Indian Rupee' },
  { CurrCode: 'USD', CurrName: 'US Dollar' },
  { CurrCode: 'EUR', CurrName: 'Euro' },
];

test('keeps a fixed-currency SAP business partner on its assigned currency', () => {
  render(
    <DocumentCurrencySelect
      header={{ vendor: 'C-USD', currencyMode: 'BP', currency: 'USD' }}
      businessPartners={[{ CardCode: 'C-USD', Currency: 'USD' }]}
      currencyOptions={currencies}
      localCurrency="INR"
      systemCurrency="EUR"
    />,
  );

  expect(screen.queryByTitle('Document Currency')).not.toBeInTheDocument();
  expect(screen.queryByLabelText('Exchange Rate')).not.toBeInTheDocument();
});

test('shows only included company currencies for an all-currencies SAP business partner', () => {
  render(
    <DocumentCurrencySelect
      header={{ vendor: 'C-ALL', currencyMode: 'BP', currency: 'USD', exchangeRate: '86' }}
      businessPartners={[{
        CardCode: 'C-ALL',
        Currency: '##',
        BPCurrencies: [
          { CurrencyCode: 'USD', Include: 'Y' },
          { CurrencyCode: 'EUR', Include: 'N' },
        ],
      }]}
      currencyOptions={currencies}
      localCurrency="INR"
      systemCurrency="EUR"
    />,
  );

  const selector = screen.getByTitle('Document Currency');
  expect([...selector.querySelectorAll('option')].map((option) => option.value)).toEqual(['USD']);
  expect(screen.getByLabelText('Exchange Rate')).toHaveValue('86');
});
