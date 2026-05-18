import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import BookingEditorForm from './BookingEditorForm';

const Icon: React.FC<{ icon: any; className?: string }> = ({ icon: IconComponent, className }) => <IconComponent className={className} />;

interface Props {
  mode: 'create' | 'edit';
}

const BookingEditorPage: React.FC<Props> = ({ mode }) => {
  const navigate = useNavigate();
  const { bookingId } = useParams();

  return (
    <div className="p-6">
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="mb-5 inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
      >
        <Icon icon={ArrowLeft} className="h-4 w-4" />
        Back
      </button>

      <div className="mx-auto max-w-3xl rounded-lg border border-gray-200 bg-white p-6">
        <h1 className="mb-2 text-2xl font-semibold text-gray-900">
          {mode === 'edit' ? 'Edit Booking' : 'Add New Booking'}
        </h1>
        <p className="mb-6 text-sm text-gray-600">
          Select the client, retreat, and optionally link a payment request.
        </p>

        <BookingEditorForm
          mode={mode}
          bookingId={bookingId}
          onCancel={() => navigate(-1)}
          onSaved={() => navigate('/admin/bookings')}
        />
      </div>
    </div>
  );
};

export default BookingEditorPage;
