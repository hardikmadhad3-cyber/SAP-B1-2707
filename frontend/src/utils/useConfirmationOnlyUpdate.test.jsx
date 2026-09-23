import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import useConfirmationOnlyUpdate from './useConfirmationOnlyUpdate';

function Harness({ state, dirty = false, docEntry = 30, send }) {
  const narrow = useConfirmationOnlyUpdate({ docEntry, isDirty: dirty, state });
  return <button onClick={() => send(narrow({ company_id: 1, header: state.header,
    lines: state.lines, freightCharges: state.freightCharges, header_udfs: state.headerUdfs }))}>Save</button>;
}
const saved = { company_id: 1, companyDb: 'TEST', header: { confirmed: false, roundingAmount: '-0.416', tax: '0' },
  lines: [{ quantity: 2 }], freightCharges: [{ amount: 10 }], headerUdfs: { U_Test: 'original' } };

test('confirmation-only save excludes all financial, line, freight and UDF fields', () => {
  const send = jest.fn();
  const { rerender } = render(<Harness state={saved} send={send} />);
  rerender(<Harness state={{ ...saved, header: { ...saved.header, confirmed: true } }} dirty send={send} />);
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  expect(send).toHaveBeenCalledWith({ company_id: 1, confirmation_only: true, header: { confirmed: true } });
});

test.each(['lines', 'freightCharges', 'headerUdfs', 'companyDb', 'company_id'])('does not discard concurrent changes to %s', (field) => {
  const send = jest.fn();
  const { rerender } = render(<Harness state={saved} send={send} />);
  const changed = { ...saved, header: { ...saved.header, confirmed: true }, [field]: field === 'company_id' ? 2 : 'changed' };
  rerender(<Harness state={changed} dirty send={send} />);
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  expect(send.mock.calls[0][0]).not.toHaveProperty('confirmation_only');
});

test('an edited amount or dirty restored draft keeps the full save path', () => {
  const send = jest.fn();
  const { rerender } = render(<Harness state={saved} send={send} />);
  rerender(<Harness state={{ ...saved, header: { ...saved.header, confirmed: true, tax: '25' } }} dirty send={send} />);
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  expect(send.mock.calls[0][0]).not.toHaveProperty('confirmation_only');
});

test('a dirty restored draft has no safe baseline and must not narrow its save', () => {
  const send = jest.fn();
  render(<Harness state={{ ...saved, header: { ...saved.header, confirmed: true } }} dirty send={send} />);
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  expect(send.mock.calls[0][0]).not.toHaveProperty('confirmation_only');
});
