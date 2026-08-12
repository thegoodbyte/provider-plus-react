import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import BookingStepMatrixCell from './BookingStepMatrixCell';

jest.mock('./BookingStepCellEditor', () => ({ children, onToggle, onStatusChange, onNoteChange }: any) => <div data-testid="editor"><button onClick={onToggle}>toggle</button><button onClick={() => onStatusChange('approved')}>status</button><button onClick={() => onNoteChange('note')}>note</button>{children}</div>);
jest.mock('./BookingStepMedicalControls', () => ({ onCreate, onLink }: any) => <div data-testid="medical"><button onClick={onCreate}>create mrr</button><button onClick={onLink}>link mrr</button></div>);
jest.mock('./BookingStepActionControls', () => ({ onRun, onReminder, onOpenDocuments }: any) => <div data-testid="actions"><button onClick={() => onRun({ key: 'email', label: 'Email', type: 'email' })}>run</button><button onClick={onReminder}>remind</button><button onClick={onOpenDocuments}>documents</button></div>);

const row: any = { key: 'medical', title: 'Medical' };
const item: any = { _id: 'i1', key: 'medical', title: 'Medical', status: 'pending', metadata: {} };
const model: any = { confirmedDateInputValue: '', hasPendingDateInput: false, isPaymentReceivedStep: false, bookingPayments: [], selectedPaymentId: '', existingReviewRequestId: '', existingReviewRequestDisplay: '', resolvedReviewNotes: '', configuredBookingDocumentType: '', linkableArtifacts: [] };
const callbacks = { onToggle: jest.fn(), onStatusChange: jest.fn(), onDateDraftChange: jest.fn(), onDateCancel: jest.fn(), onDateSave: jest.fn(), onPaymentChange: jest.fn(), onNoteChange: jest.fn(), onCreateMrr: jest.fn(), onLinkMrr: jest.fn(), onRunAction: jest.fn(), onUpload: jest.fn(), onReminder: jest.fn(), onAutomation: jest.fn(), onLinkArtifact: jest.fn(), onOpenDocuments: jest.fn() };
const renderCell = (props: any) => render(<table><tbody><tr><BookingStepMatrixCell row={row} model={model} actions={[]} logs={[]} isEditing saving="" note="" canRemind={false} {...callbacks} {...props} /></tr></tbody></table>);

describe('BookingStepMatrixCell', () => {
  beforeEach(() => jest.clearAllMocks());
  it.each([['pending', 'pending'], ['sent_for_review', 'sent for review'], ['approved', 'approved'], ['rejected', 'rejected']])('renders the %s simple status', (status, label) => { renderCell({ item: { ...item, status }, viewMode: 'simple' }); expect(screen.getByTitle(`Medical: ${label}`)).toBeInTheDocument(); });
  it('renders a missing detail cell', () => { renderCell({ viewMode: 'detail' }); expect(screen.getByText('-').closest('td')).toHaveClass('bg-red-50'); expect(screen.queryByTestId('editor')).not.toBeInTheDocument(); });
  it('assembles the detailed editor and controls', () => { renderCell({ item, viewMode: 'detail' }); expect(screen.getByTestId('editor')).toBeInTheDocument(); expect(screen.getByTestId('medical')).toBeInTheDocument(); expect(screen.getByTestId('actions')).toBeInTheDocument(); });
  it('forwards editor, medical, and action callbacks', () => { renderCell({ item, viewMode: 'detail' }); fireEvent.click(screen.getByText('toggle')); fireEvent.click(screen.getByText('status')); fireEvent.click(screen.getByText('note')); fireEvent.click(screen.getByText('create mrr')); fireEvent.click(screen.getByText('link mrr')); fireEvent.click(screen.getByText('run')); fireEvent.click(screen.getByText('remind')); fireEvent.click(screen.getByText('documents')); expect(callbacks.onToggle).toHaveBeenCalled(); expect(callbacks.onStatusChange).toHaveBeenCalledWith('approved'); expect(callbacks.onNoteChange).toHaveBeenCalledWith('note'); expect(callbacks.onCreateMrr).toHaveBeenCalled(); expect(callbacks.onLinkMrr).toHaveBeenCalledWith(); expect(callbacks.onRunAction).toHaveBeenCalledWith(expect.objectContaining({ key: 'email' })); expect(callbacks.onReminder).toHaveBeenCalled(); expect(callbacks.onOpenDocuments).toHaveBeenCalled(); });
  it('uses the review decision tone when available', () => { renderCell({ item, viewMode: 'detail', model: { ...model, reviewStepConfig: {}, resolvedReviewDecision: 'OK' } }); expect(screen.getByTestId('editor').closest('td')?.className).toContain('green'); });
});
