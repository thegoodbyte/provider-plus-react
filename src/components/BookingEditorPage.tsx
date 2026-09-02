import React from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import BookingEditorForm from './BookingEditorForm';

const Icon: React.FC<{ icon: any; className?: string }> = ({ icon: IconComponent, className }) => <IconComponent className={className} />;

interface Props {
  mode: 'create' | 'edit';
}

const toFiniteNumber = (value: string | null) => {
  if (value === null || value === '') return undefined;
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
};

const BookingEditorPage: React.FC<Props> = ({ mode }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { bookingId } = useParams();
  const createPrefill = React.useMemo(() => {
    const params = new URLSearchParams(location.search);
    return {
      clientId: params.get('clientId') || undefined,
      retreatId: params.get('retreatId') || undefined,
      paymentRequestId: params.get('paymentRequestId') || undefined,
      totalAmount: toFiniteNumber(params.get('totalAmount')),
      amountPaid: toFiniteNumber(params.get('amountPaid')),
      currency: (params.get('currency') as 'EUR' | 'USD' | 'CZK' | 'PLN' | null) || undefined,
      status: (params.get('status') as 'pending' | 'confirmed' | 'checked-in' | 'checked-out' | 'cancelled' | null) || undefined,
    };
  }, [location.search]);
  const routePrefix = React.useMemo(() => {
    const firstSegment = location.pathname.split('/').filter(Boolean)[0];
    return ['admin', 'medical', 'staff', 'user'].includes(firstSegment) ? `/${firstSegment}` : '';
  }, [location.pathname]);

  return (
    <div className="p-6 max-sm:p-0">
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="mb-5 inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 max-sm:m-4 max-sm:mb-3"
      >
        <Icon icon={ArrowLeft} className="h-4 w-4" />
        Back
      </button>

      <div className="mx-auto max-w-5xl rounded-lg border border-gray-200 bg-white p-6 max-sm:max-w-none max-sm:rounded-none max-sm:border-0 max-sm:p-4">
        <h1 className="mb-2 text-2xl font-semibold text-gray-900">
          {mode === 'edit' ? 'Edit Booking' : 'Add New Booking'}
        </h1>
        <p className="mb-6 text-sm text-gray-600 max-sm:mb-4">
          Select the client, retreat, and optionally link a payment request.
        </p>

        <BookingEditorForm
          mode={mode}
          bookingId={bookingId}
          initialBookingData={createPrefill}
          onCancel={() => navigate(-1)}
          onSaved={() => navigate(routePrefix ? `${routePrefix}/bookings` : '/bookings')}
        />
      </div>
    </div>
  );
};

export default BookingEditorPage;
