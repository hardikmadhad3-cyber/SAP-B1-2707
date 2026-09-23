import {
  downloadPdfBlob,
  PDF_SAVE_PICKER_ID,
} from './pdfUtils';

const originalShowSaveFilePicker = window.showSaveFilePicker;

afterEach(() => {
  Object.defineProperty(window, 'showSaveFilePicker', {
    configurable: true,
    value: originalShowSaveFilePicker,
  });
  jest.restoreAllMocks();
});

test('opens native Save As and writes the PDF to the selected file', async () => {
  const write = jest.fn().mockResolvedValue(undefined);
  const close = jest.fn().mockResolvedValue(undefined);
  const createWritable = jest.fn().mockResolvedValue({ write, close });
  const showSaveFilePicker = jest.fn().mockResolvedValue({
    name: 'Sales Order 44.pdf',
    createWritable,
  });
  Object.defineProperty(window, 'showSaveFilePicker', {
    configurable: true,
    value: showSaveFilePicker,
  });
  const blob = new Blob(['pdf'], { type: 'application/pdf' });

  await expect(downloadPdfBlob(blob, 'Sales Order 44.pdf')).resolves.toEqual(
    expect.objectContaining({ saved: true, cancelled: false, fileName: 'Sales Order 44.pdf' }),
  );
  expect(showSaveFilePicker).toHaveBeenCalledWith(expect.objectContaining({
    id: PDF_SAVE_PICKER_ID,
    suggestedName: 'Sales Order 44.pdf',
    types: [{
      description: 'PDF document',
      accept: { 'application/pdf': ['.pdf'] },
    }],
  }));
  expect(createWritable).toHaveBeenCalledTimes(1);
  expect(write).toHaveBeenCalledWith(blob);
  expect(close).toHaveBeenCalledTimes(1);
});

test('cancelling Save As does not start a browser download', async () => {
  const cancelled = new Error('cancelled');
  cancelled.name = 'AbortError';
  Object.defineProperty(window, 'showSaveFilePicker', {
    configurable: true,
    value: jest.fn().mockRejectedValue(cancelled),
  });
  const createElement = jest.spyOn(document, 'createElement');

  await expect(downloadPdfBlob(
    new Blob(['pdf'], { type: 'application/pdf' }),
    'document.pdf',
  )).resolves.toEqual(expect.objectContaining({ saved: false, cancelled: true }));
  expect(createElement).not.toHaveBeenCalledWith('a');
});
