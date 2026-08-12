import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import BookingStepMedicalControls from './BookingStepMedicalControls';

const item: any = { _id: 'step-1', title: 'EKG review' };
const config: any = { label: 'Entry EKG review' };
const view = (overrides: any = {}) => render(<MemoryRouter><BookingStepMedicalControls item={item} reviewConfig={config} configuredActions={[]} isEditing saving="" existingRequestId="" existingRequestDisplay="" notes="" onCreate={jest.fn()} onLink={jest.fn()} {...overrides} /></MemoryRouter>);

describe('BookingStepMedicalControls', () => {
  it('creates and links a medical review request', () => {
    const create = jest.fn(); const link = jest.fn(); view({ onCreate: create, onLink: link });
    fireEvent.click(screen.getByText('Create MRR')); expect(create).toHaveBeenCalled(); fireEvent.click(screen.getByText('Link existing MRR')); expect(link).toHaveBeenCalled();
  });
  it('renders a linked request and its display id', () => {
    view({ existingRequestId: 'request-1', existingRequestDisplay: 42 });
    expect(screen.getByText('MRR #42')).toHaveAttribute('href', '/admin/medical-review-requests/request-1');
  });
  it('renders decision, review date and notes', () => {
    view({ decision: 'caution', reviewedAt: '2026-08-01', notes: 'Monitor carefully' });
    expect(screen.getByText('Caution')).toBeInTheDocument(); expect(screen.getByText('Monitor carefully')).toBeInTheDocument(); expect(screen.getByText(/26,/)).toBeInTheDocument();
  });
  it('hides medical controls without a review config', () => {
    const { container } = view({ reviewConfig: undefined }); expect(container).toBeEmptyDOMElement();
  });
  it('disables creation while locked or saving and avoids duplicate link action', () => {
    const { rerender } = view({ isEditing: false }); expect(screen.getByText('Create MRR')).toBeDisabled(); expect(screen.queryByText('Link existing MRR')).not.toBeInTheDocument();
    rerender(<MemoryRouter><BookingStepMedicalControls item={item} reviewConfig={config} configuredActions={[{ key: 'link', type: 'link_mrr' }] as any} isEditing saving="mrr:step-1" existingRequestId="" existingRequestDisplay="" notes="" onCreate={jest.fn()} onLink={jest.fn()} /></MemoryRouter>); expect(screen.getByText('...')).toBeDisabled(); expect(screen.queryByText('Link existing MRR')).not.toBeInTheDocument();
  });
});
