import React from 'react';
import { AlertTriangle, ThumbsDown, ThumbsUp, X } from 'lucide-react';
import { BookingFlowAction, BookingFlowActionLog, BookingFlowItem } from '../types';
import { BookingStepMatrixRow } from './bookingStepRows';
import { BookingStepCellModel } from './bookingStepCellModel';
import { getSimpleStepStatus, getStepStatusCellClass } from './bookingStepPresentation';
import { reviewDecisionToClassName } from './bookingStepMedicalLinks';
import BookingStepCellEditor from './BookingStepCellEditor';
import BookingStepMedicalControls from './BookingStepMedicalControls';
import BookingStepActionControls from './BookingStepActionControls';

type Props = {
  item?: BookingFlowItem; row: BookingStepMatrixRow; viewMode: 'detail' | 'simple'; model: BookingStepCellModel;
  actions: BookingFlowAction[]; logs: BookingFlowActionLog[]; isEditing: boolean; saving: string; note: string; canRemind: boolean;
  onToggle: () => void; onStatusChange: (status: BookingFlowItem['status']) => void; onDateDraftChange: (value: string) => void;
  onDateCancel: () => void; onDateSave: (value: string) => void; onPaymentChange: (paymentId: string) => void; onNoteChange: (note: string) => void;
  onCreateMrr: () => void; onLinkMrr: (action?: BookingFlowAction) => void; onRunAction: (action: BookingFlowAction) => void;
  onUpload: (action: BookingFlowAction, files: FileList | null) => void; onReminder: () => void; onAutomation: () => void;
  onLinkArtifact: () => void; onOpenDocuments: () => void;
};

const SimpleStatus = ({ item, title }: { item?: BookingFlowItem; title: string }) => {
  const status = getSimpleStepStatus(item);
  const icon = status.icon === 'failed' ? <ThumbsDown className="h-5 w-5" /> : status.icon === 'attention' ? <AlertTriangle className="h-5 w-5" /> : status.icon === 'fulfilled' ? <ThumbsUp className="h-5 w-5" /> : <X className="h-5 w-5" />;
  return <div className={`mx-auto flex h-9 w-9 items-center justify-center rounded-full ${status.className}`} title={`${title}: ${status.label}`}>{icon}</div>;
};

const BookingStepMatrixCell: React.FC<Props> = ({ item, row, viewMode, model, actions, logs, isEditing, saving, note, canRemind, onToggle, onStatusChange, onDateDraftChange, onDateCancel, onDateSave, onPaymentChange, onNoteChange, onCreateMrr, onLinkMrr, onRunAction, onUpload, onReminder, onAutomation, onLinkArtifact, onOpenDocuments }) => {
  const cellTone = item ? (model.reviewStepConfig && model.resolvedReviewDecision ? reviewDecisionToClassName(model.resolvedReviewDecision) : getStepStatusCellClass(item.status)) : 'bg-red-50 text-red-900';
  return <td className={`${viewMode === 'simple' ? 'min-w-[150px] px-2 py-2 text-center' : 'min-w-[230px] px-2 py-1 align-top'} border-b border-r border-gray-300 ${cellTone}`}>
    {viewMode === 'simple' ? <SimpleStatus item={item} title={row.title} /> : item ? <BookingStepCellEditor item={item} done={getSimpleStepStatus(item).icon === 'fulfilled'} isEditing={isEditing} saving={saving} confirmedDateInputValue={model.confirmedDateInputValue} pendingDateInputValue={model.pendingDateInputValue} hasPendingDateInput={model.hasPendingDateInput} isPaymentReceivedStep={model.isPaymentReceivedStep} bookingPayments={model.bookingPayments} selectedPaymentId={model.selectedPaymentId} note={note} onToggle={onToggle} onStatusChange={onStatusChange} onDateDraftChange={onDateDraftChange} onDateCancel={onDateCancel} onDateSave={onDateSave} onPaymentChange={onPaymentChange} onNoteChange={onNoteChange}>
      <BookingStepMedicalControls item={item} reviewConfig={model.reviewStepConfig} configuredActions={actions} isEditing={isEditing} saving={saving} existingRequestId={model.existingReviewRequestId} existingRequestDisplay={model.existingReviewRequestDisplay} decision={model.resolvedReviewDecision} notes={model.resolvedReviewNotes} reviewedAt={model.resolvedReviewReviewedAt} onCreate={onCreateMrr} onLink={() => onLinkMrr()} />
      <BookingStepActionControls item={item} row={row} actions={actions} logs={logs} isEditing={isEditing} saving={saving} canRemind={canRemind} artifactConfig={model.artifactStepConfig} configuredDocumentType={model.configuredBookingDocumentType} relatedDocument={model.relatedBookingDocument} relatedArtifact={model.relatedMedicalArtifact} relatedArtifactId={model.relatedMedicalArtifactId} linkableArtifactCount={model.linkableArtifacts.length} onRun={onRunAction} onUpload={onUpload} onLinkMrr={onLinkMrr} onReminder={onReminder} onAutomation={onAutomation} onLinkArtifact={onLinkArtifact} onOpenDocuments={onOpenDocuments} />
    </BookingStepCellEditor> : <span className="text-gray-300">-</span>}
  </td>;
};

export default BookingStepMatrixCell;
