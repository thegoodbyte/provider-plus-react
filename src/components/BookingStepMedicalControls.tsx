import React from 'react';
import { Link } from 'react-router-dom';
import { Link2 } from 'lucide-react';
import { BookingFlowAction, BookingFlowItem } from '../types';
import { ReviewStepConfig, reviewDecisionToClassName, reviewDecisionToLabel } from './bookingStepMedicalLinks';
import { formatStepDateTime } from './bookingStepPresentation';

type Props = {
  item: BookingFlowItem; reviewConfig?: ReviewStepConfig; configuredActions: BookingFlowAction[]; isEditing: boolean; saving: string;
  existingRequestId: string; existingRequestDisplay: string | number; decision?: string; notes: string; reviewedAt?: Date | string;
  onCreate: () => void; onLink: () => void;
};

const BookingStepMedicalControls: React.FC<Props> = ({ item, reviewConfig, configuredActions, isEditing, saving, existingRequestId, existingRequestDisplay, decision, notes, reviewedAt, onCreate, onLink }) => <>
  {reviewConfig && (existingRequestId ? <Link to={`/admin/medical-review-requests/${existingRequestId}`} className="inline-flex items-center justify-center gap-1 rounded-md border border-indigo-200 bg-indigo-50 px-2 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-100" title={`Open medical review request #${existingRequestDisplay || existingRequestId}`}>MRR #{existingRequestDisplay || 'linked'}</Link> : <button type="button" disabled={!isEditing || saving === `mrr:${item._id}`} onClick={onCreate} className="inline-flex items-center justify-center gap-1 rounded-md border border-indigo-200 bg-white px-2 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-50 disabled:opacity-50" title={isEditing ? `Create ${reviewConfig.label}` : 'Unlock editing to create medical review request'}>{saving === `mrr:${item._id}` ? '...' : 'Create MRR'}</button>)}
  {reviewConfig && isEditing && !configuredActions.some(action => action.type === 'link_mrr') && <button type="button" disabled={saving === `link-mrr:${item._id}`} onClick={onLink} className="inline-flex items-center justify-center gap-1 rounded-md border border-indigo-200 bg-indigo-50 px-2 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-100 disabled:opacity-50" title="Link an existing medical review request to this step"><Link2 className="h-3.5 w-3.5" />Link existing MRR</button>}
  {reviewConfig && decision && <div className={`rounded-md border px-2 py-1 text-[11px] font-semibold ${reviewDecisionToClassName(decision)}`}><div className="flex items-center justify-between gap-2"><span>{reviewDecisionToLabel(decision) || 'Reviewed'}</span>{reviewedAt && <span className="font-normal opacity-80">{formatStepDateTime(reviewedAt)}</span>}</div>{notes && <div className="mt-1 font-normal leading-snug">{notes}</div>}</div>}
</>;

export default BookingStepMedicalControls;
