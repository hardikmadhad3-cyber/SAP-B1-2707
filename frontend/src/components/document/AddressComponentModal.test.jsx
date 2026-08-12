import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import AddressComponentModal from './AddressComponentModal';

test('uses the shared SAP popup shell without changing address actions', () => {
  const onClose = jest.fn();
  const onSave = jest.fn();
  const onFormChange = jest.fn();

  render(
    <AddressComponentModal
      isOpen
      onClose={onClose}
      onSave={onSave}
      addressForm={{ city: 'Chennai', state: 'TN' }}
      onFormChange={onFormChange}
      states={[{ Code: 'TN', Name: 'Tamil Nadu' }]}
    />,
  );

  expect(screen.getByRole('dialog', { name: 'Address Component' })).toHaveClass('sap-modal-shell');
  fireEvent.change(screen.getByDisplayValue('Chennai'), { target: { value: 'Coimbatore' } });
  expect(onFormChange).toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'OK' }));
  expect(onSave).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(onClose).toHaveBeenCalledTimes(1);
});
