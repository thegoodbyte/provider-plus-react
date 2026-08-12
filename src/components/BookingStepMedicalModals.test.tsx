import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { BookingStepArtifactLinkModal, BookingStepReviewLinkModal, BookingStepReviewRequestModal } from './BookingStepMedicalModals';

const item: any = { _id: 'step-1', title: 'Medical step' };
const row: any = { key: 'medical', title: 'Medical review' };
const booking = { bookingNumber: 1240, clientId: { firstName: 'Mikolaj', lastName: 'Sadowski' } };

describe('BookingStepMedicalModals', () => {
  it('selects and links an existing review request', () => {
    const change = jest.fn(); const link = jest.fn(); const close = jest.fn();
    const state: any = { item, row, booking, selectedRequestId: '', candidates: [{ _id: 'request-123456', display_id: 42, requestType: 'ekg_review', status: 'in_review', assignedToEmail: 'doctor@test.com', requestedAt: '2026-08-01' }] };
    render(<BookingStepReviewLinkModal state={state} saving="" onChange={change} onClose={close} onLink={link} />);
    expect(screen.getByText(/Mikolaj Sadowski/)).toBeInTheDocument();
    expect(screen.getByText(/MRR #42/)).toBeInTheDocument();
    expect(screen.getByText('Link to step')).toBeDisabled();
    fireEvent.click(screen.getByLabelText('Select MRR 42'));
    expect(change).toHaveBeenCalledWith(expect.objectContaining({ selectedRequestId: 'request-123456' }));
    fireEvent.click(screen.getByLabelText('Close review request link'));
    expect(close).toHaveBeenCalled();
  });

  it('links the selected review and shows its saving state', () => {
    const link = jest.fn(); const state: any = { item, row, booking, selectedRequestId: 'r', candidates: [{ _id: 'r', status: 'pending' }] };
    const { rerender } = render(<BookingStepReviewLinkModal state={state} saving="" onChange={jest.fn()} onClose={jest.fn()} onLink={link} />);
    fireEvent.click(screen.getByText('Link to step')); expect(link).toHaveBeenCalled();
    rerender(<BookingStepReviewLinkModal state={state} saving="link-mrr:step-1" onChange={jest.fn()} onClose={jest.fn()} onLink={link} />);
    expect(screen.getByText('Linking...')).toBeDisabled();
  });

  it('selects, links and closes an artifact', () => {
    const change = jest.fn(); const link = jest.fn(); const close = jest.fn();
    const artifact: any = { _id: 'artifact-123456', display_id: 9, title: 'Entry EKG', documentStage: 'entry', documentType: 'EKG', receivedAt: '2026-08-02', files: [{ fileName: 'ekg.pdf' }] };
    const base: any = { item, row, booking, config: { label: 'Entry EKG' }, candidates: [artifact], selectedArtifactId: '' };
    const { rerender } = render(<BookingStepArtifactLinkModal state={base} saving="" onChange={change} onClose={close} onLink={link} />);
    expect(screen.getByText('#9 Entry EKG')).toBeInTheDocument(); expect(screen.getByText('1 file(s)')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Select artifact 9')); expect(change).toHaveBeenCalledWith(expect.objectContaining({ selectedArtifactId: 'artifact-123456' }));
    rerender(<BookingStepArtifactLinkModal state={{ ...base, selectedArtifactId: artifact._id }} saving="" onChange={change} onClose={close} onLink={link} />);
    fireEvent.click(screen.getByText('Link to step')); expect(link).toHaveBeenCalled();
    fireEvent.click(screen.getByLabelText('Close artifact link')); expect(close).toHaveBeenCalled();
  });

  it('chooses an advisor and creates a review request', () => {
    const change = jest.fn(); const create = jest.fn(); const state: any = { item, booking, artifactId: 'artifact-1', requestType: 'medications_review', label: 'Medication review', advisorId: '' };
    const advisors: any = [{ _id: 'advisor-1', firstName: 'Saeeda', lastName: 'Lakhani', email: 'saeeda@test.com' }];
    const { rerender } = render(<BookingStepReviewRequestModal state={state} advisors={advisors} saving="" onChange={change} onClose={jest.fn()} onCreate={create} />);
    expect(screen.getByText('Create MRR')).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/Medical Advisor/), { target: { value: 'advisor-1' } }); expect(change).toHaveBeenCalledWith(expect.objectContaining({ advisorId: 'advisor-1' }));
    rerender(<BookingStepReviewRequestModal state={{ ...state, advisorId: 'advisor-1' }} advisors={advisors} saving="" onChange={change} onClose={jest.fn()} onCreate={create} />);
    fireEvent.click(screen.getByText('Create MRR')); expect(create).toHaveBeenCalled();
  });

  it('handles missing advisors and creation in progress', () => {
    const close = jest.fn(); const state: any = { item, booking, artifactId: 'a', requestType: 'ekg_review', label: 'EKG', advisorId: 'advisor-1' };
    render(<BookingStepReviewRequestModal state={state} advisors={[]} saving="mrr:step-1" onChange={jest.fn()} onClose={close} onCreate={jest.fn()} />);
    expect(screen.getByText('No active medical advisors are available.')).toBeInTheDocument(); expect(screen.getByText('Creating...')).toBeDisabled();
    expect(screen.getByText('Cancel')).toBeDisabled(); fireEvent.click(screen.getByLabelText('Close medical review request')); expect(close).toHaveBeenCalled();
  });

  it('renders fallback identifiers and artifact details', () => {
    const requestState: any = { item, row, booking, selectedRequestId: '', candidates: [{ _id: 'request-abcdef', status: undefined, assignedTo: '', requestedAt: undefined }] };
    const { unmount } = render(<BookingStepReviewLinkModal state={requestState} saving="" onChange={jest.fn()} onClose={jest.fn()} onLink={jest.fn()} />);
    expect(screen.getByText(/MRR #abcdef/)).toBeInTheDocument(); expect(screen.getByText('pending')).toBeInTheDocument(); expect(screen.getByText('Unassigned')).toBeInTheDocument();
    unmount();
    const artifactState: any = { item, row, booking, config: { label: 'Liver' }, selectedArtifactId: '', candidates: [{ _id: 'artifact-abcdef', artifactType: 'liver_panel' }] };
    render(<BookingStepArtifactLinkModal state={artifactState} saving="link:step-1" onChange={jest.fn()} onClose={jest.fn()} onLink={jest.fn()} />);
    expect(screen.getByText(/#abcdef liver_panel/)).toBeInTheDocument(); expect(screen.getByText('0 file(s)')).toBeInTheDocument();
  });

  it('uses advisor email when no name is available', () => {
    const state: any = { item, booking, artifactId: 'a', requestType: 'ekg_review', label: 'EKG', advisorId: '' };
    render(<BookingStepReviewRequestModal state={state} advisors={[{ _id: 'a', email: 'advisor@test.com' }] as any} saving="" onChange={jest.fn()} onClose={jest.fn()} onCreate={jest.fn()} />);
    expect(screen.getByRole('option', { name: 'advisor@test.com (advisor@test.com)' })).toBeInTheDocument();
  });
});
