import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { retreatsApi, bookingsApi, clientsApi } from '../services/api';
import AppleButton from '../components/AppleButton';
import LoadingSpinner from '../components/LoadingSpinner';
import { FiArrowLeft, FiEdit2, FiCheck, FiX, FiCalendar, FiAlertCircle } from 'react-icons/fi';

// Simple wrapper to fix TypeScript icon issues
const Icon: React.FC<{ icon: any; className?: string }> = ({ icon: IconComponent, className }) => {
  return <IconComponent className={className} />;
};

interface ClientTracking {
  clientId: string;
  clientName: string;
  displayId: number;
  email: string;
  pNumber: string;
  paymentStatus: string;
  paymentAmount: string;
  paymentDate: string;
  sdfSent: string;
  sdfRcvd: string;
  confSent: string;
  ekgRcvd: string;
  ekgMRR: string;
  ekgReviewed: string;
  ekgResult: string;
  ekgNotes: string;
  liverRcvd: string;
  liverMRR: string;
  liverReviewed: string;
  liverResult: string;
  liverNotes: string;
  medStatus: string;
  questSent: string;
  questRcvd: string;
  medsSent: string;
  medsRcvd: string;
  medsReviewed: string;
  medsResult: string;
  medsNotes: string;
  foodSent: string;
  foodRcvd: string;
  caffeineSent: string;
}

interface EditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (value: string) => void;
  title: string;
  value: string;
  fieldType?: 'text' | 'date' | 'select' | 'textarea';
  options?: string[];
}

const EditModal: React.FC<EditModalProps> = ({
  isOpen,
  onClose,
  onSave,
  title,
  value,
  fieldType = 'text',
  options = []
}) => {
  const [inputValue, setInputValue] = useState(value);

  useEffect(() => {
    setInputValue(value);
  }, [value]);

  if (!isOpen) return null;

  const handleSave = () => {
    onSave(inputValue);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg p-6 w-96 max-w-full">
        <h3 className="text-lg font-semibold mb-4">{title}</h3>

        {fieldType === 'textarea' ? (
          <textarea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows={4}
          />
        ) : fieldType === 'date' ? (
          <input
            type="date"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        ) : fieldType === 'select' ? (
          <select
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select...</option>
            {options.map(option => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        ) : (
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        )}

        <div className="flex justify-end gap-2 mt-4">
          <AppleButton variant="secondary" onClick={onClose}>
            Cancel
          </AppleButton>
          <AppleButton variant="primary" onClick={handleSave}>
            Save
          </AppleButton>
        </div>
      </div>
    </div>
  );
};

const RetreatDetailView: React.FC = () => {
  const { retreatId } = useParams<{ retreatId: string }>();
  const navigate = useNavigate();
  const [retreat, setRetreat] = useState<any>(null);
  const [clientTrackings, setClientTrackings] = useState<ClientTracking[]>([]);
  const [loading, setLoading] = useState(true);
  const [editModal, setEditModal] = useState({
    isOpen: false,
    clientId: '',
    field: '',
    value: '',
    title: ''
  });

  useEffect(() => {
    fetchRetreatData();
  }, [retreatId]);

  const fetchRetreatData = async () => {
    if (!retreatId) return;

    try {
      setLoading(true);

      // Fetch retreat details and bookings
      const [retreatResponse, bookingsResponse] = await Promise.all([
        retreatsApi.getOne(retreatId),
        bookingsApi.getByRetreat(retreatId)
      ]);

      const retreatData = retreatResponse.data;
      const bookings = bookingsResponse.data || [];

      // Fetch client details for each booking
      const clientPromises = bookings.map(async (booking: any) => {
        const clientResponse = await clientsApi.getOne(booking.clientId);
        const client = clientResponse.data;

        return {
          clientId: client._id,
          clientName: `${client.firstName} ${client.lastName}`,
          displayId: client.display_id || 0,
          email: client.email || '',
          pNumber: booking.pNumber || '',
          paymentStatus: booking.paymentStatus || '',
          paymentAmount: booking.paymentAmount || '',
          paymentDate: booking.paymentDate || '',
          sdfSent: booking.sdfSent || '',
          sdfRcvd: booking.sdfRcvd || '',
          confSent: booking.confSent || '',
          ekgRcvd: booking.ekgRcvd || '',
          ekgMRR: booking.ekgMRR || '',
          ekgReviewed: booking.ekgReviewed || '',
          ekgResult: booking.ekgResult || '',
          ekgNotes: booking.ekgNotes || '',
          liverRcvd: booking.liverRcvd || '',
          liverMRR: booking.liverMRR || '',
          liverReviewed: booking.liverReviewed || '',
          liverResult: booking.liverResult || '',
          liverNotes: booking.liverNotes || '',
          medStatus: booking.medStatus || '',
          questSent: booking.questSent || '',
          questRcvd: booking.questRcvd || '',
          medsSent: booking.medsSent || '',
          medsRcvd: booking.medsRcvd || '',
          medsReviewed: booking.medsReviewed || '',
          medsResult: booking.medsResult || '',
          medsNotes: booking.medsNotes || '',
          foodSent: booking.foodSent || '',
          foodRcvd: booking.foodRcvd || '',
          caffeineSent: booking.caffeineSent || ''
        };
      });

      const trackingData = await Promise.all(clientPromises);

      setRetreat(retreatData);
      setClientTrackings(trackingData);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching retreat data:', error);
      setLoading(false);
    }
  };

  const handleCellClick = (clientId: string, field: string, value: string, title: string) => {
    setEditModal({
      isOpen: true,
      clientId,
      field,
      value,
      title
    });
  };

  const handleSaveEdit = async (newValue: string) => {
    const { clientId, field } = editModal;

    // Update local state
    setClientTrackings(prev => prev.map(tracking =>
      tracking.clientId === clientId
        ? { ...tracking, [field]: newValue }
        : tracking
    ));

    // TODO: Save to backend
    try {
      // await bookingsApi.updateTracking(clientId, { [field]: newValue });
    } catch (error) {
      console.error('Error saving:', error);
    }
  };

  const getFieldType = (field: string): 'text' | 'date' | 'select' | 'textarea' => {
    if (field.includes('Date') || field.includes('Sent') || field.includes('Rcvd') || field.includes('Reviewed')) {
      return 'date';
    }
    if (field.includes('Status') || field.includes('Result')) {
      return 'select';
    }
    if (field.includes('Notes')) {
      return 'textarea';
    }
    return 'text';
  };

  const getFieldOptions = (field: string): string[] => {
    if (field.includes('Status')) {
      return ['CLEARED', 'DECLINED', 'PENDING', 'CAUTION'];
    }
    if (field.includes('Result')) {
      return ['OK', 'DECLINED', 'CAUTION', 'PENDING'];
    }
    return [];
  };

  const getCellColor = (field: string, value: string): string => {
    if (!value) return '';

    if (field === 'medStatus') {
      if (value === 'CLEARED') return 'bg-green-100';
      if (value === 'DECLINED') return 'bg-red-100';
      if (value === 'CAUTION') return 'bg-yellow-100';
    }

    if (field.includes('Result')) {
      if (value === 'OK') return 'bg-green-50';
      if (value === 'DECLINED') return 'bg-red-100';
      if (value === 'CAUTION') return 'bg-yellow-100';
    }

    return '';
  };

  if (loading) {
    return <LoadingSpinner message="Loading retreat details..." />;
  }

  return (
    <div className="p-4 max-w-full">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <AppleButton variant="ghost" onClick={() => navigate(-1)}>
            <Icon icon={FiArrowLeft} className="w-4 h-4 mr-2" />
            Back
          </AppleButton>
          <h1 className="text-2xl font-bold">{retreat?.title || 'Retreat Detail'}</h1>
          <span className="text-gray-500">{retreat?.startDate} - {retreat?.endDate}</span>
        </div>
      </div>

      {/* Tracking Grid */}
      <div className="overflow-x-auto bg-white border border-gray-200 rounded-lg">
        <table className="min-w-full text-xs">
          <thead className="bg-gray-50">
            <tr>
              <th className="sticky left-0 z-10 bg-gray-50 px-2 py-1 text-left font-medium text-gray-700 border-r">Client</th>
              <th className="px-2 py-1 text-left font-medium text-gray-700">ID</th>
              <th className="px-2 py-1 text-left font-medium text-gray-700">P-Number</th>
              <th className="px-2 py-1 text-left font-medium text-gray-700">Payment</th>
              <th className="px-2 py-1 text-left font-medium text-gray-700">SDF Sent</th>
              <th className="px-2 py-1 text-left font-medium text-gray-700">SDF Rcvd</th>
              <th className="px-2 py-1 text-left font-medium text-gray-700">Conf Sent</th>
              <th className="px-2 py-1 text-left font-medium text-gray-700">EKG Rcvd</th>
              <th className="px-2 py-1 text-left font-medium text-gray-700">EKG MRR#</th>
              <th className="px-2 py-1 text-left font-medium text-gray-700">EKG Review</th>
              <th className="px-2 py-1 text-left font-medium text-gray-700">EKG Result</th>
              <th className="px-2 py-1 text-left font-medium text-gray-700">EKG Notes</th>
              <th className="px-2 py-1 text-left font-medium text-gray-700">Liver Rcvd</th>
              <th className="px-2 py-1 text-left font-medium text-gray-700">Liver MRR#</th>
              <th className="px-2 py-1 text-left font-medium text-gray-700">Liver Review</th>
              <th className="px-2 py-1 text-left font-medium text-gray-700">Liver Result</th>
              <th className="px-2 py-1 text-left font-medium text-gray-700">Liver Notes</th>
              <th className="px-2 py-1 text-left font-medium text-gray-700">Med Status</th>
              <th className="px-2 py-1 text-left font-medium text-gray-700">Quest Sent</th>
              <th className="px-2 py-1 text-left font-medium text-gray-700">Quest Rcvd</th>
              <th className="px-2 py-1 text-left font-medium text-gray-700">Meds Sent</th>
              <th className="px-2 py-1 text-left font-medium text-gray-700">Meds Rcvd</th>
              <th className="px-2 py-1 text-left font-medium text-gray-700">Meds Review</th>
              <th className="px-2 py-1 text-left font-medium text-gray-700">Meds Notes</th>
              <th className="px-2 py-1 text-left font-medium text-gray-700">Food Sent</th>
              <th className="px-2 py-1 text-left font-medium text-gray-700">Food Rcvd</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {clientTrackings.map((tracking, index) => (
              <tr key={tracking.clientId} className="hover:bg-gray-50">
                <td className="sticky left-0 z-10 bg-white px-2 py-1 font-medium border-r">
                  {tracking.clientName}
                </td>
                <td className="px-2 py-1 font-semibold text-blue-600">{tracking.displayId}</td>
                <td className="px-2 py-1">{tracking.pNumber}</td>
                <td
                  className="px-2 py-1 cursor-pointer hover:bg-gray-100"
                  onClick={() => handleCellClick(tracking.clientId, 'paymentAmount', tracking.paymentAmount, 'Payment Amount')}
                >
                  {tracking.paymentAmount || '-'}
                </td>
                <td
                  className="px-2 py-1 cursor-pointer hover:bg-gray-100"
                  onClick={() => handleCellClick(tracking.clientId, 'sdfSent', tracking.sdfSent, 'SDF Sent Date')}
                >
                  {tracking.sdfSent || '-'}
                </td>
                <td
                  className="px-2 py-1 cursor-pointer hover:bg-gray-100"
                  onClick={() => handleCellClick(tracking.clientId, 'sdfRcvd', tracking.sdfRcvd, 'SDF Received Date')}
                >
                  {tracking.sdfRcvd || '-'}
                </td>
                <td
                  className="px-2 py-1 cursor-pointer hover:bg-gray-100"
                  onClick={() => handleCellClick(tracking.clientId, 'confSent', tracking.confSent, 'Confirmation Sent')}
                >
                  {tracking.confSent || '-'}
                </td>
                <td
                  className="px-2 py-1 cursor-pointer hover:bg-gray-100"
                  onClick={() => handleCellClick(tracking.clientId, 'ekgRcvd', tracking.ekgRcvd, 'EKG Received Date')}
                >
                  {tracking.ekgRcvd || '-'}
                </td>
                <td
                  className="px-2 py-1 cursor-pointer hover:bg-gray-100"
                  onClick={() => handleCellClick(tracking.clientId, 'ekgMRR', tracking.ekgMRR, 'EKG MRR#')}
                >
                  {tracking.ekgMRR || '-'}
                </td>
                <td
                  className="px-2 py-1 cursor-pointer hover:bg-gray-100"
                  onClick={() => handleCellClick(tracking.clientId, 'ekgReviewed', tracking.ekgReviewed, 'EKG Reviewed Date')}
                >
                  {tracking.ekgReviewed || '-'}
                </td>
                <td
                  className={`px-2 py-1 cursor-pointer hover:bg-gray-100 ${getCellColor('ekgResult', tracking.ekgResult)}`}
                  onClick={() => handleCellClick(tracking.clientId, 'ekgResult', tracking.ekgResult, 'EKG Result')}
                >
                  {tracking.ekgResult || '-'}
                </td>
                <td
                  className="px-2 py-1 cursor-pointer hover:bg-gray-100"
                  onClick={() => handleCellClick(tracking.clientId, 'ekgNotes', tracking.ekgNotes, 'EKG Notes')}
                >
                  {tracking.ekgNotes ? tracking.ekgNotes.substring(0, 20) + '...' : '-'}
                </td>
                <td
                  className="px-2 py-1 cursor-pointer hover:bg-gray-100"
                  onClick={() => handleCellClick(tracking.clientId, 'liverRcvd', tracking.liverRcvd, 'Liver Test Received')}
                >
                  {tracking.liverRcvd || '-'}
                </td>
                <td
                  className="px-2 py-1 cursor-pointer hover:bg-gray-100"
                  onClick={() => handleCellClick(tracking.clientId, 'liverMRR', tracking.liverMRR, 'Liver MRR#')}
                >
                  {tracking.liverMRR || '-'}
                </td>
                <td
                  className="px-2 py-1 cursor-pointer hover:bg-gray-100"
                  onClick={() => handleCellClick(tracking.clientId, 'liverReviewed', tracking.liverReviewed, 'Liver Reviewed Date')}
                >
                  {tracking.liverReviewed || '-'}
                </td>
                <td
                  className={`px-2 py-1 cursor-pointer hover:bg-gray-100 ${getCellColor('liverResult', tracking.liverResult)}`}
                  onClick={() => handleCellClick(tracking.clientId, 'liverResult', tracking.liverResult, 'Liver Result')}
                >
                  {tracking.liverResult || '-'}
                </td>
                <td
                  className="px-2 py-1 cursor-pointer hover:bg-gray-100"
                  onClick={() => handleCellClick(tracking.clientId, 'liverNotes', tracking.liverNotes, 'Liver Notes')}
                >
                  {tracking.liverNotes ? tracking.liverNotes.substring(0, 20) + '...' : '-'}
                </td>
                <td
                  className={`px-2 py-1 cursor-pointer hover:bg-gray-100 font-semibold ${getCellColor('medStatus', tracking.medStatus)}`}
                  onClick={() => handleCellClick(tracking.clientId, 'medStatus', tracking.medStatus, 'Medical Status')}
                >
                  {tracking.medStatus || '-'}
                </td>
                <td
                  className="px-2 py-1 cursor-pointer hover:bg-gray-100"
                  onClick={() => handleCellClick(tracking.clientId, 'questSent', tracking.questSent, 'Questionnaire Sent')}
                >
                  {tracking.questSent || '-'}
                </td>
                <td
                  className="px-2 py-1 cursor-pointer hover:bg-gray-100"
                  onClick={() => handleCellClick(tracking.clientId, 'questRcvd', tracking.questRcvd, 'Questionnaire Received')}
                >
                  {tracking.questRcvd || '-'}
                </td>
                <td
                  className="px-2 py-1 cursor-pointer hover:bg-gray-100"
                  onClick={() => handleCellClick(tracking.clientId, 'medsSent', tracking.medsSent, 'Medications Form Sent')}
                >
                  {tracking.medsSent || '-'}
                </td>
                <td
                  className="px-2 py-1 cursor-pointer hover:bg-gray-100"
                  onClick={() => handleCellClick(tracking.clientId, 'medsRcvd', tracking.medsRcvd, 'Medications Form Received')}
                >
                  {tracking.medsRcvd || '-'}
                </td>
                <td
                  className="px-2 py-1 cursor-pointer hover:bg-gray-100"
                  onClick={() => handleCellClick(tracking.clientId, 'medsReviewed', tracking.medsReviewed, 'Medications Reviewed')}
                >
                  {tracking.medsReviewed || '-'}
                </td>
                <td
                  className="px-2 py-1 cursor-pointer hover:bg-gray-100"
                  onClick={() => handleCellClick(tracking.clientId, 'medsNotes', tracking.medsNotes, 'Medications Notes')}
                >
                  {tracking.medsNotes ? tracking.medsNotes.substring(0, 20) + '...' : '-'}
                </td>
                <td
                  className="px-2 py-1 cursor-pointer hover:bg-gray-100"
                  onClick={() => handleCellClick(tracking.clientId, 'foodSent', tracking.foodSent, 'Food Preferences Sent')}
                >
                  {tracking.foodSent || '-'}
                </td>
                <td
                  className="px-2 py-1 cursor-pointer hover:bg-gray-100"
                  onClick={() => handleCellClick(tracking.clientId, 'foodRcvd', tracking.foodRcvd, 'Food Preferences Received')}
                >
                  {tracking.foodRcvd || '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Edit Modal */}
      <EditModal
        isOpen={editModal.isOpen}
        onClose={() => setEditModal({ ...editModal, isOpen: false })}
        onSave={handleSaveEdit}
        title={editModal.title}
        value={editModal.value}
        fieldType={getFieldType(editModal.field)}
        options={getFieldOptions(editModal.field)}
      />
    </div>
  );
};

export default RetreatDetailView;