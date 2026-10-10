import React from 'react';
import { Button, Modal } from 'antd';
import { CheckCircleFilled } from '@ant-design/icons';
import { MedicalReviewRequest } from '../types';

export default function MrrCreatedModal({ request, onDismiss, onViewMrr, onBackToArtifacts }: {
  request: MedicalReviewRequest | null;
  onDismiss: () => void;
  onViewMrr: () => void;
  onBackToArtifacts: () => void;
}) {
  return <Modal
    open={Boolean(request)}
    centered
    closable={false}
    maskClosable={false}
    keyboard={false}
    title={<span className="inline-flex items-center gap-2"><CheckCircleFilled style={{ color: '#52c41a' }} />MRR created</span>}
    footer={<div className="flex flex-wrap justify-end gap-2"><Button onClick={onDismiss}>Dismiss</Button><Button onClick={onBackToArtifacts}>Back to artifacts</Button><Button type="primary" onClick={onViewMrr}>View MRR</Button></div>}
  >
    <p className="my-4 text-base">MRR <strong>#{request?.display_id ?? request?._id}</strong> was created.</p>
  </Modal>;
}
