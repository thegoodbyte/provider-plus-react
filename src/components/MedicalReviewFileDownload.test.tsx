import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import MedicalReviewFileDownload, { MedicalReviewDownloadContext } from './MedicalReviewFileDownload';
import { medicalReviewRequestsApi } from '../services/api';
jest.mock('../services/api', () => ({ medicalReviewRequestsApi: { downloadArtifact: jest.fn() } }));
const view = () => render(<MedicalReviewDownloadContext.Provider value="mrr-1"><MedicalReviewFileDownload artifactId="artifact-1" fileKey="medical/original.pdf"/></MedicalReviewDownloadContext.Provider>);
it('downloads using the complete server filename and the exact MRR/file association', async () => {
  const fileName='MRR_1325_LIVER_PATRYK.KORYTEK_1057_JNO-11-17-26.pdf';
  (medicalReviewRequestsApi.downloadArtifact as jest.Mock).mockResolvedValue({data:{url:'https://example.com/signed',fileName}});
  const click=jest.spyOn(HTMLAnchorElement.prototype,'click').mockImplementation(function(this: HTMLAnchorElement) { expect(this.download).toBe(fileName); expect(this.href).toBe('https://example.com/signed'); });
  view();fireEvent.click(screen.getByRole('button',{name:'Download'}));
  await waitFor(()=>expect(click).toHaveBeenCalled());
  expect(medicalReviewRequestsApi.downloadArtifact).toHaveBeenCalledWith('mrr-1','artifact-1','medical/original.pdf');
  click.mockRestore();
});
it('shows failure and permits retry', async () => {
  (medicalReviewRequestsApi.downloadArtifact as jest.Mock).mockRejectedValue(new Error('offline'));
  view();fireEvent.click(screen.getByRole('button',{name:'Download'}));
  expect(await screen.findByRole('alert')).toHaveTextContent('Unable to download document');
  expect(screen.getByRole('button',{name:'Download'})).toBeEnabled();
});
