import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import MedicalArtifactDetailPage from './MedicalArtifactDetailPage';
import { medicalArtifactsApi, medicalReviewRequestsApi } from '../services/api';
jest.mock('../services/api', () => ({
  medicalArtifactsApi: { getOne: jest.fn(), generateEnglishTranslation: jest.fn() },
  medicalReviewRequestsApi: { getByArtifact: jest.fn().mockResolvedValue({ data: [] }) },
  bookingsApi: { getByClient: jest.fn().mockResolvedValue({ data: [] }) },
}));
jest.mock('../services/usersApi', () => ({ usersApi: {} }));
const artifact: any = { _id: 'artifact-1345', display_id: 1345, artifactType: 'medications_form', originalLanguage: 'pl', title: 'Medications', files: [], translation: { status: 'ready', sourceLanguage: 'pl' } };
it('exposes desktop regeneration and forces a fresh translation using the selected language', async () => {
  (medicalReviewRequestsApi.getByArtifact as jest.Mock).mockResolvedValue({ data: [] });
  (medicalArtifactsApi.getOne as jest.Mock).mockResolvedValue({ data: artifact });
  (medicalArtifactsApi.generateEnglishTranslation as jest.Mock).mockResolvedValue({ data: artifact });
  render(<MemoryRouter initialEntries={['/admin/medical-artifacts/artifact-1345']}><Routes><Route path="/admin/medical-artifacts/:id" element={<MedicalArtifactDetailPage />} /></Routes></MemoryRouter>);
  const button = await screen.findByRole('button', { name: 'Regenerate English translation' });
  expect(button.closest('.md\\:hidden')).toBeNull();
  expect(screen.getByRole('button', { name: 'Regenerate English', exact: true }).closest('.md\\:hidden')).toBeNull();
  fireEvent.change(screen.getByLabelText('Original language'), { target: { value: 'cs' } });
  fireEvent.click(button);
  await waitFor(() => expect(medicalArtifactsApi.generateEnglishTranslation).toHaveBeenCalledWith('artifact-1345', 'cs', true));
});
