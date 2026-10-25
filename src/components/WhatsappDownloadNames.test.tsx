import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import WhatsappDownloadNames from './WhatsappDownloadNames';
const names = { archiveName: 'MRR_1423_TEST.CLIENT_1333_RETREAT.zip', fileNames: ['MRR_1423_EKG_TEST.CLIENT_1333_RETREAT-1.pdf', 'MRR_1423_EKG_TEST.CLIENT_1333_RETREAT-2.jpg'] };
afterEach(() => jest.restoreAllMocks());
it('copies exact server filenames and all names without reconstructing them', async () => {
  const writeText = jest.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
  render(<WhatsappDownloadNames names={names} />);
  fireEvent.click(screen.getByRole('button', { name: 'Copy ' + names.fileNames[1] }));
  await waitFor(() => expect(writeText).toHaveBeenCalledWith(names.fileNames[1]));
  expect(await screen.findByRole('status')).toHaveTextContent('Filename copied');
  fireEvent.click(screen.getByRole('button', { name: 'Copy all filenames' }));
  await waitFor(() => expect(writeText).toHaveBeenLastCalledWith([names.archiveName, ...names.fileNames].join('\n')));
});
it('keeps filenames selectable and reports clipboard failure', async () => {
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: jest.fn().mockRejectedValue(new Error('denied')) } });
  render(<WhatsappDownloadNames names={names} />);
  fireEvent.click(screen.getByRole('button', { name: 'Copy ' + names.fileNames[0] }));
  expect(await screen.findByRole('status')).toHaveTextContent('copy it manually');
  expect(screen.getByText(names.fileNames[0])).toBeVisible();
});
it('does not invent an archive for empty or unavailable documents', () => {
  const { rerender } = render(<WhatsappDownloadNames names={{ archiveName: 'unused.zip', fileNames: [] }} />);
  expect(screen.getByText(/No downloadable original documents/)).toBeVisible();
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
  rerender(<WhatsappDownloadNames />);
  expect(screen.getByRole('status')).toHaveTextContent('unavailable');
});
