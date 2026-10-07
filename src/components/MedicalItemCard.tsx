import React from 'react';
import { MEDICAL_ITEM_ICON_PATHS, MEDICAL_ITEM_TONES, MedicalItemState } from './medicalItemStatus';
import './MedicalItemCard.css';

export interface MedicalItemCardProps {
  state: MedicalItemState;
  title: string;
  artifactRef?: string;
  mrr?: string;
  note?: string;
  channel?: 'Internal' | 'WhatsApp';
  receivedAt?: string;
  sentAt?: string;
  reviewedAt?: string;
  onOpenFile?: () => void;
  onOpenMrr?: () => void;
  onCreateMrr?: () => void;
  onUploadFile?: () => void;
  onRequestFromClient?: () => void;
}

const StateIcon: React.FC<{ state: MedicalItemState }> = ({ state }) => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={state === 'pending' || state === 'received' ? 3.5 : 4} strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: MEDICAL_ITEM_ICON_PATHS[state] }} />
);

type Step = { step: string; label: string; bar: string; color?: string };

const stepperSteps = (state: MedicalItemState, tone: (typeof MEDICAL_ITEM_TONES)[MedicalItemState], { receivedAt, sentAt, mrr }: { receivedAt?: string; sentAt?: string; mrr?: string }): Step[] => {
  const ink = 'oklch(0.27 0.02 280)';
  const mute = 'oklch(0.6 0.02 280)';
  const done = 'oklch(0.78 0.05 280)';
  const off = 'oklch(0.91 0.008 280)';
  if (state === 'missing') return [
    { step: 'File', label: 'Not received', bar: tone.dot, color: tone.ink },
    { step: 'Review', label: 'No MRR', bar: off, color: mute },
    { step: 'Decision', label: '—', bar: off, color: mute },
  ];
  if (state === 'received') return [
    { step: 'File', label: `Received ${receivedAt || ''}`.trim(), bar: done, color: ink },
    { step: 'Review', label: 'Not created', bar: off, color: ink },
    { step: 'Decision', label: '—', bar: off, color: mute },
  ];
  if (state === 'pending') return [
    { step: 'File', label: `Received ${receivedAt || ''}`.trim(), bar: done, color: ink },
    { step: 'Review', label: `${mrr || ''} sent`.trim(), bar: done, color: ink },
    { step: 'Decision', label: 'Waiting…', bar: `repeating-linear-gradient(90deg, ${tone.dot} 0 8px, ${tone.chip} 8px 14px)`, color: tone.ink },
  ];
  return [
    { step: 'File', label: `Received ${receivedAt || ''}`.trim(), bar: done, color: ink },
    { step: 'Review', label: mrr || '', bar: done, color: ink },
    { step: 'Decision', label: tone.label, bar: tone.dot, color: tone.ink },
  ];
};

const HINT_TEXT: Partial<Record<MedicalItemState, string>> = {
  missing: 'Nothing uploaded yet. The client needs to send this before the retreat.',
  received: 'File is in. No medical review request has been created yet.',
  pending: 'The reviewer has the file. No decision yet.',
};

const DECIDED_STATES: MedicalItemState[] = ['ok', 'caution', 'declined'];

const MedicalItemCard: React.FC<MedicalItemCardProps> = ({
  state, title, artifactRef, mrr, note, channel = 'Internal', receivedAt, sentAt, reviewedAt,
  onOpenFile, onOpenMrr, onCreateMrr, onUploadFile, onRequestFromClient,
}) => {
  const tone = MEDICAL_ITEM_TONES[state];
  const decided = DECIDED_STATES.includes(state);
  const steps = stepperSteps(state, tone, { receivedAt, sentAt, mrr });
  const meta = state === 'missing' ? 'Required before arrival' : state === 'received' ? `Received ${receivedAt || ''}`.trim() : state === 'pending' ? `Sent ${sentAt || ''}`.trim() : `Reviewed ${reviewedAt || ''}`.trim();

  return (
    <article
      className="medical-item-card"
      data-state={state}
      style={{ '--tone-wash': tone.wash, '--tone-chip': tone.chip, '--tone-edge': tone.edge, '--tone-dot': tone.dot, '--tone-ink': tone.ink } as React.CSSProperties}
    >
      <div className="medical-item-card-top">
        <div className="medical-item-card-heading">
          <div className="medical-item-card-title">{title}</div>
          {artifactRef && <div className="medical-item-card-ref">{artifactRef}</div>}
        </div>
        <div className="medical-item-card-chip">
          <span className="medical-item-card-chip-dot"><StateIcon state={state} /></span>
          <span>{tone.label}</span>
        </div>
      </div>

      <div className="medical-item-card-steps">
        {steps.map(step => (
          <div className="medical-item-card-step" key={step.step}>
            <div className="medical-item-card-step-bar" style={{ background: step.bar }} />
            <div className="medical-item-card-step-label">{step.step}</div>
            <div className="medical-item-card-step-value" style={{ color: step.color }}>{step.label}</div>
          </div>
        ))}
      </div>

      {decided && note && (
        <div className="medical-item-card-note">
          <div className="medical-item-card-note-head">Reviewer note · {channel}</div>
          <div className="medical-item-card-note-body">{note}</div>
        </div>
      )}
      {!decided && HINT_TEXT[state] && <p className="medical-item-card-hint">{HINT_TEXT[state]}</p>}

      <div className="medical-item-card-footer">
        <span className="medical-item-card-meta">{meta}</span>
        <div className="medical-item-card-actions">
          {state === 'missing' && onRequestFromClient && <button type="button" onClick={onRequestFromClient}>Request from client</button>}
          {onOpenFile && <button type="button" onClick={onOpenFile}>Open file</button>}
          {state === 'received' && onCreateMrr && <button type="button" className="is-primary" onClick={onCreateMrr}>Create MRR</button>}
          {state !== 'missing' && state !== 'received' && mrr && onOpenMrr && <button type="button" onClick={onOpenMrr}>{mrr}</button>}
          {(state === 'missing' || state === 'declined') && onUploadFile && <button type="button" className="is-primary" onClick={onUploadFile}>{state === 'missing' ? 'Upload file' : 'Upload another'}</button>}
        </div>
      </div>
    </article>
  );
};

export default MedicalItemCard;
