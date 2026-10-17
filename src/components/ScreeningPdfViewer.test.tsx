import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ScreeningPdfViewer from './ScreeningPdfViewer';
import { clientsApi } from '../services/api';
jest.mock('../services/api', () => ({ clientsApi: { viewScreeningPdf: jest.fn(), regenerateScreeningPdf: jest.fn() } }));
const pdf = () => ({ data: new Blob(['%PDF-1.4'], { type: 'application/pdf' }) });
beforeEach(() => {
  let next = 0; URL.createObjectURL = jest.fn(() => `blob:pdf-${++next}`); URL.revokeObjectURL = jest.fn();
  (clientsApi.viewScreeningPdf as jest.Mock).mockResolvedValue(pdf()); (clientsApi.regenerateScreeningPdf as jest.Mock).mockResolvedValue(pdf());
});
it('opens the saved/generated PDF in the viewer and provides a download', async () => {
  render(<ScreeningPdfViewer clientId="client-1" onClose={jest.fn()} />);
  expect(await screen.findByTitle('Screening PDF document')).toHaveAttribute('src', 'blob:pdf-1');
  expect(clientsApi.viewScreeningPdf).toHaveBeenCalledWith('client-1'); expect(clientsApi.regenerateScreeningPdf).not.toHaveBeenCalled();
  expect(screen.getByRole('link', { name: 'Download PDF' })).toHaveAttribute('href', 'blob:pdf-1');
});
it('regenerates and replaces the preview, revoking the previous blob', async () => {
  render(<ScreeningPdfViewer clientId="client-1" onClose={jest.fn()} />); await screen.findByTitle('Screening PDF document');
  fireEvent.click(screen.getByRole('button', { name: 'Regenerate' }));
  await waitFor(() => expect(screen.getByTitle('Screening PDF document')).toHaveAttribute('src', 'blob:pdf-2'));
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:pdf-1');
});
it('retains the previous PDF on regeneration failure and retries regeneration', async () => {
  (clientsApi.regenerateScreeningPdf as jest.Mock).mockRejectedValueOnce(new Error('offline')).mockResolvedValue(pdf());
  render(<ScreeningPdfViewer clientId="client-1" onClose={jest.fn()} />); await screen.findByTitle('Screening PDF document');
  fireEvent.click(screen.getByRole('button', { name: 'Regenerate' })); await screen.findByRole('alert');
  expect(screen.getByTitle('Screening PDF document')).toHaveAttribute('src', 'blob:pdf-1');
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
  await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument()); expect(clientsApi.regenerateScreeningPdf).toHaveBeenCalledTimes(2);
});
it('rejects empty/non-PDF responses and allows an initial-load retry', async () => {
  (clientsApi.viewScreeningPdf as jest.Mock).mockResolvedValueOnce({ data: new Blob([], { type: 'application/pdf' }) });
  render(<ScreeningPdfViewer clientId="client-1" onClose={jest.fn()} />); await screen.findByRole('alert');
  expect(URL.createObjectURL).not.toHaveBeenCalled(); fireEvent.click(screen.getByRole('button', { name: 'Retry' })); await screen.findByTitle('Screening PDF document');
});
it('releases URLs and ignores results arriving after close', async () => {
  let resolve!: (v: any) => void; (clientsApi.viewScreeningPdf as jest.Mock).mockReturnValue(new Promise(r => { resolve = r; }));
  const { unmount } = render(<ScreeningPdfViewer clientId="client-1" onClose={jest.fn()} />); unmount(); resolve(pdf());
  await waitFor(() => expect(URL.createObjectURL).not.toHaveBeenCalled());
});
it('closes with Escape and cleans up the displayed PDF on unmount', async () => {
  const close = jest.fn(); const { unmount } = render(<ScreeningPdfViewer clientId="client-1" onClose={close} />); await screen.findByTitle('Screening PDF document');
  fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' }); expect(close).toHaveBeenCalled(); unmount(); expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:pdf-1');
});

it('rejects an HTML error page returned with status 200', async () => {
  (clientsApi.viewScreeningPdf as jest.Mock).mockResolvedValue({ data: new Blob(['error page'], { type: 'text/html' }) });
  render(<ScreeningPdfViewer clientId="client-1" onClose={jest.fn()} />); await screen.findByRole('alert');
  expect(URL.createObjectURL).not.toHaveBeenCalled();
});
