import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import MedicalItemCard from './MedicalItemCard';

const base = { title: 'Entry EKG', artifactRef: 'Artifact #1027' };

describe('MedicalItemCard', () => {
  it('renders the missing state with a hint and Request from client / Upload file actions', () => {
    const onRequestFromClient = jest.fn();
    const onUploadFile = jest.fn();
    render(<MedicalItemCard {...base} state="missing" onRequestFromClient={onRequestFromClient} onUploadFile={onUploadFile} />);
    expect(screen.getAllByText('Not received').length).toBeGreaterThan(0);
    expect(screen.getByText(/Nothing uploaded yet/)).toBeInTheDocument();
    expect(screen.getByText('Required before arrival')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Request from client'));
    expect(onRequestFromClient).toHaveBeenCalled();
    fireEvent.click(screen.getByText('Upload file'));
    expect(onUploadFile).toHaveBeenCalled();
    expect(screen.queryByText('Open file')).not.toBeInTheDocument();
  });

  it('renders the received state with Open file / Create MRR and no hint when decided-style props are absent', () => {
    const onOpenFile = jest.fn();
    const onCreateMrr = jest.fn();
    render(<MedicalItemCard {...base} state="received" receivedAt="Aug 17" onOpenFile={onOpenFile} onCreateMrr={onCreateMrr} />);
    expect(screen.getByText('Received · no MRR')).toBeInTheDocument();
    expect(screen.getByText(/File is in/)).toBeInTheDocument();
    fireEvent.click(screen.getByText('Open file'));
    expect(onOpenFile).toHaveBeenCalled();
    fireEvent.click(screen.getByText('Create MRR'));
    expect(onCreateMrr).toHaveBeenCalled();
  });

  it('renders the pending state with a waiting decision step and MRR link, no reviewer note', () => {
    render(<MedicalItemCard {...base} state="pending" mrr="MRR #1119" sentAt="Aug 18" onOpenMrr={jest.fn()} note="should not show" />);
    expect(screen.getByText('MRR pending')).toBeInTheDocument();
    expect(screen.getByText('Waiting…')).toBeInTheDocument();
    expect(screen.getByText('MRR #1119')).toBeInTheDocument();
    expect(screen.queryByText('should not show')).not.toBeInTheDocument();
  });

  it('renders decided states (ok/caution/declined) with a reviewer note and the right action set', () => {
    const { rerender } = render(<MedicalItemCard {...base} state="ok" mrr="MRR #1194" reviewedAt="Sep 15" note="Looks fine" channel="WhatsApp" onOpenFile={jest.fn()} onOpenMrr={jest.fn()} />);
    expect(screen.getAllByText('Approved').length).toBeGreaterThan(0);
    expect(screen.getByText('Reviewer note · WhatsApp')).toBeInTheDocument();
    expect(screen.getByText('Looks fine')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Upload another' })).not.toBeInTheDocument();

    rerender(<MedicalItemCard {...base} state="declined" mrr="MRR #1306" onOpenFile={jest.fn()} onOpenMrr={jest.fn()} onUploadFile={jest.fn()} />);
    expect(screen.getAllByText('Declined').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Upload another' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'MRR #1306' })).toBeInTheDocument();
  });

  it('only renders action buttons whose callback prop was actually passed', () => {
    render(<MedicalItemCard {...base} state="ok" mrr="MRR #1" />);
    expect(screen.queryByRole('button', { name: 'Open file' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'MRR #1' })).not.toBeInTheDocument();
  });
});
