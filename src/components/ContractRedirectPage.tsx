import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import LoadingSpinner from './LoadingSpinner';
import { jotformApi } from '../services/api';

const ContractRedirectPage: React.FC = () => {
  const { bookingId = '' } = useParams();
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    const redirect = async () => {
      try {
        const response = await jotformApi.resolveContractLink(bookingId);
        if (!active) return;
        window.location.replace(response.data.redirectUrl);
      } catch (err: any) {
        if (!active) return;
        setError(err?.response?.data?.message || err?.message || 'Unable to open the contract link.');
      }
    };

    redirect();

    return () => {
      active = false;
    };
  }, [bookingId]);

  if (error) {
    return (
      <div className="mx-auto max-w-2xl p-6 text-sm text-red-700">
        {error}
      </div>
    );
  }

  return <LoadingSpinner message="Opening contract..." />;
};

export default ContractRedirectPage;
