import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ArtifactReviewStatus, { useArtifactReviews } from './ArtifactReviewStatus';
import { medicalReviewRequestsApi } from '../services/api';
jest.mock('../services/api', () => ({ medicalReviewRequestsApi: { getByArtifacts: jest.fn() } }));
const lookup = medicalReviewRequestsApi.getByArtifacts as jest.Mock;
function Card({ id = 'doc-1' }: { id?: string }) {
  const state = useArtifactReviews([id]);
  return <ArtifactReviewStatus artifactId={id} state={state} />;
}
beforeEach(() => lookup.mockReset());
test('shows the linked MRR number, workflow status and decision', async () => {
  lookup.mockResolvedValue({ data: [{ _id: 'review-1', display_id: 1042, artifactIds: ['doc-1'], status: 'in_review', reviewDecision: 'more_info_needed' }] });
  render(<MemoryRouter><Card /></MemoryRouter>);
  expect(await screen.findByText('MRR #1042')).toHaveAttribute('href', '/admin/medical-review-requests/review-1');
  expect(screen.getByLabelText('Medical review requests')).toHaveTextContent('in review · more info needed');
});
test('missing review links creation to the document in the current workspace', async () => {
  lookup.mockResolvedValue({ data: [] });
  render(<MemoryRouter initialEntries={['/staff/clients/one']}><Card /></MemoryRouter>);
  expect(await screen.findByText('Create MRR')).toHaveAttribute('href', '/staff/medical-review-requests/new?artifactId=doc-1');
});
test('failed lookup is not missing, and can be retried', async () => {
  lookup.mockRejectedValueOnce(new Error('offline')).mockResolvedValue({ data: [] });
  render(<MemoryRouter><Card /></MemoryRouter>);
  await screen.findByRole('alert');
  expect(screen.queryByText('MRR missing')).not.toBeInTheDocument();
  fireEvent.click(screen.getByText('Retry MRR lookup'));
  await screen.findByText('MRR missing');
  expect(lookup).toHaveBeenCalledTimes(2);
});
test('ignores a response for a previous document', async () => {
  let resolveOld: (result: any) => void = () => {};
  lookup.mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve; })).mockResolvedValue({ data: [] });
  const { rerender } = render(<MemoryRouter><Card /></MemoryRouter>);
  await waitFor(() => expect(lookup).toHaveBeenCalledTimes(1));
  rerender(<MemoryRouter><Card id="doc-2" /></MemoryRouter>);
  await screen.findByText('MRR missing');
  resolveOld({ data: [{ _id: 'old', artifactIds: ['doc-1'], display_id: 999, status: 'pending' }] });
  await waitFor(() => expect(screen.queryByText('MRR #999')).not.toBeInTheDocument());
});
