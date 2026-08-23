import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import FormSettingsPanel, { filterDuplicateRowUdfFields } from './FormSettingsPanel';

const lineOnlyProperties = {
  matrixColumns: ['visible'],
  rowUdfs: ['visible'],
};

const sapVisibilityProperties = {
  matrixColumns: ['visible'],
  headerUdfs: [],
  rowUdfs: ['visible'],
};

test('keeps a matrix UDF canonical instead of showing a duplicate row-UDF toggle', () => {
  expect(filterDuplicateRowUdfFields(
    [{ key: 'U_PackingType', fieldName: 'U_PackingType' }],
    [
      { key: 'U_PackingType', label: 'Packing Type' },
      { key: 'U_ContainerType', label: 'Container Type' },
    ],
  )).toEqual([{ key: 'U_ContainerType', label: 'Container Type' }]);
});

test('allows only line visibility edits and provides an explicit company-scoped Save action', () => {
  const onSettingChange = jest.fn();
  const onSave = jest.fn();
  const { container } = render(
    <FormSettingsPanel
      isOpen
      onClose={jest.fn()}
      matrixFields={[
        { key: 'ItemCode', label: 'Item No.', active: true },
        { key: 'U_PackingType', label: 'Packing Type', active: true, sapControlled: true },
      ]}
      headerUdfFields={[]}
      rowUdfFields={[
        { key: 'U_PackingType', label: 'Packing Type', active: true, sapControlled: true },
        { key: 'U_ContainerType', label: 'Container Type', active: true, sapControlled: true },
      ]}
      formSettings={{
        matrixColumns: {
          ItemCode: { visible: true, active: true },
          U_PackingType: { visible: true, active: true, sapControlled: true },
        },
        headerUdfs: {},
        rowUdfs: {
          U_PackingType: { visible: true, active: true, sapControlled: true },
          U_ContainerType: { visible: true, active: true, sapControlled: true },
        },
      }}
      onSettingChange={onSettingChange}
      settingsLoaded
      settingsScopeLabel="manager / COMPANY_A"
      editablePropertiesByGroup={lineOnlyProperties}
      editableSapControlledProperties={sapVisibilityProperties}
      hasUnsavedChanges
      onSave={onSave}
    />,
  );

  expect(screen.getByText('Loaded for manager / COMPANY_A')).toBeInTheDocument();
  expect(screen.getAllByText('Packing Type')).toHaveLength(1);
  expect(screen.getByText('Container Type')).toBeInTheDocument();

  const itemRow = screen.getByText('Item No.').closest('.d-flex.justify-content-between');
  const [visibleCheckbox, activeCheckbox] = itemRow.querySelectorAll('input[type="checkbox"]');
  expect(visibleCheckbox).toBeEnabled();
  expect(activeCheckbox).toBeDisabled();
  fireEvent.click(visibleCheckbox);
  expect(onSettingChange).toHaveBeenCalledWith('matrixColumns', 'ItemCode', 'visible', false);

  fireEvent.click(screen.getByRole('button', { name: 'Save Line Fields' }));
  expect(onSave).toHaveBeenCalledTimes(1);
  expect(container).toHaveTextContent('Line-field visibility has unsaved changes.');
});

test('does not expose fields or Save while company settings are still loading', () => {
  render(
    <FormSettingsPanel
      isOpen
      onClose={jest.fn()}
      matrixFields={[{ key: 'ItemCode', label: 'Item No.' }]}
      headerUdfFields={[]}
      rowUdfFields={[]}
      formSettings={{ matrixColumns: {}, headerUdfs: {}, rowUdfs: {} }}
      onSettingChange={jest.fn()}
      settingsLoaded={false}
      hasUnsavedChanges
      onSave={jest.fn()}
    />,
  );

  expect(screen.getByText('Loading saved visibility before document lines...')).toBeInTheDocument();
  expect(screen.queryByText('Item No.')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Save Line Fields' })).toBeDisabled();
});
