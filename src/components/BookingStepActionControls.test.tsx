import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import BookingStepActionControls from './BookingStepActionControls';

const item: any = { _id: 'step-1', title: 'Contract', status: 'pending' };
const row: any = { key: 'contract', title: 'Contract' };
const actions: any[] = [{ key: 'email', label: 'Send', type: 'email' }, { key: 'upload', label: 'Upload', type: 'upload' }, { key: 'mrr', label: 'Link MRR', type: 'link_mrr' }];
const callbacks = () => ({ onRun: jest.fn(), onUpload: jest.fn(), onLinkMrr: jest.fn(), onReminder: jest.fn(), onAutomation: jest.fn(), onLinkArtifact: jest.fn(), onOpenDocuments: jest.fn() });
const props = (overrides: any = {}) => ({ item, row, actions, logs: [], isEditing: true, saving: '', canRemind: false, configuredDocumentType: '', linkableArtifactCount: 0, ...callbacks(), ...overrides });
const view = (overrides: any = {}) => render(<MemoryRouter><BookingStepActionControls {...props(overrides)} /></MemoryRouter>);

describe('BookingStepActionControls', () => {
  it('runs regular actions and links MRRs', () => { const cb = callbacks(); view(cb); fireEvent.click(screen.getByText('Send')); expect(cb.onRun).toHaveBeenCalledWith(actions[0]); fireEvent.click(screen.getByText('Link MRR')); expect(cb.onLinkMrr).toHaveBeenCalledWith(actions[2]); });
  it('uploads configured action files and shows repeat text', () => { const cb = callbacks(); view({ ...cb, logs: [{ actionKey: 'upload' }] }); const file = new File(['x'], 'x.pdf'); fireEvent.change(screen.getAllByLabelText('Upload files')[0], { target: { files: [file] } }); expect(cb.onUpload).toHaveBeenCalledWith(actions[1], expect.anything()); expect(screen.getByText('Upload again')).toBeInTheDocument(); });
  it('opens reminders and displays paused automation', () => { const cb = callbacks(); view({ ...cb, canRemind: true, item: { ...item, automationPaused: true } }); fireEvent.click(screen.getByText(/Remind:/)); expect(cb.onReminder).toHaveBeenCalled(); fireEvent.click(screen.getByText('Automation paused')); expect(cb.onAutomation).toHaveBeenCalled(); });
  it('renders fallback artifact and document uploads', () => { const cb = callbacks(); const { unmount } = view({ ...cb, actions: [], artifactConfig: { label: 'Medication form', artifactType: 'medications_form' }, configuredDocumentType: 'contract' }); expect(screen.getByText('Upload form')).toBeInTheDocument(); expect(screen.getByText('Upload Contract')).toBeInTheDocument(); unmount(); });
  it('renders and opens linked documents and artifacts', () => { const cb = callbacks(); view({ ...cb, actions: [], relatedDocument: { _id: 'd', display_id: 4 }, relatedArtifact: { _id: 'a', display_id: 7 }, relatedArtifactId: 'a' }); fireEvent.click(screen.getByText('Document #4')); expect(cb.onOpenDocuments).toHaveBeenCalled(); expect(screen.getByText('Artifact #7')).toHaveAttribute('href', '/admin/medical-artifacts/a'); });

  it('does not expose upload actions while the booking-step editor is locked', () => {
    view({ isEditing: false, actions: [{ key: 'upload', label: 'Upload contract', type: 'upload' }] });
    expect(screen.queryByText('Upload contract')).not.toBeInTheDocument();
  });
  it('links an available artifact and renders action history', () => { const cb = callbacks(); view({ ...cb, actions: [actions[0]], logs: [{ actionKey: 'email', performedAt: '2026-08-01' }], artifactConfig: { label: 'EKG' }, linkableArtifactCount: 1 }); fireEvent.click(screen.getByText('Link existing')); expect(cb.onLinkArtifact).toHaveBeenCalled(); expect(screen.getByText(/Send: 1x/)).toBeInTheDocument(); });
  it('disables actions while locked or saving', () => { view({ isEditing: false }); expect(screen.getByText('Send')).toBeDisabled(); expect(screen.getByText('Link MRR')).toBeDisabled(); const { unmount } = view({ saving: 'action:step-1:email' }); expect(screen.getByText('...')).toBeDisabled(); unmount(); });
});
