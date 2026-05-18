import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import PaymentRequestForm from './PaymentRequestForm';
import LoadingSpinner from './LoadingSpinner';
import { paymentRequestsApi } from '../services/api';
import { PaymentRequest } from '../types';

const PaymentRequestEditorPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(Boolean(id));
  const [paymentRequest, setPaymentRequest] = useState<Partial<PaymentRequest> | undefined>(undefined);

  useEffect(() => {
    const loadRequest = async () => {
      if (!id) {
        setLoading(false);
        setPaymentRequest(undefined);
        return;
      }

      try {
        setLoading(true);
        const response = await paymentRequestsApi.getOne(id);
        setPaymentRequest(response.data);
      } catch (error) {
        console.error('Error loading payment request:', error);
      } finally {
        setLoading(false);
      }
    };

    loadRequest();
  }, [id]);

  const handleSave = async (data: Omit<PaymentRequest, '_id'>) => {
    if (id) {
      await paymentRequestsApi.update(id, data);
    } else {
      await paymentRequestsApi.create(data);
    }
    navigate('/admin/payment-requests');
  };

  if (loading) {
    return <LoadingSpinner message={id ? 'Loading payment request...' : 'Loading form...'} />;
  }

  return (
    <PaymentRequestForm
      paymentRequest={paymentRequest}
      onSave={handleSave}
      onCancel={() => navigate('/admin/payment-requests')}
      isEdit={Boolean(id)}
    />
  );
};

export default PaymentRequestEditorPage;
