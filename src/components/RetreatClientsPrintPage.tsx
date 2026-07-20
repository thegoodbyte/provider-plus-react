import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FiArrowLeft, FiPrinter } from 'react-icons/fi';
import { bookingsApi, retreatsApi } from '../services/api';
import { Retreat } from '../types';
import './RetreatClientsPrintPage.css';

const Icon: React.FC<{ icon: any }> = ({ icon: IconComponent }) => <IconComponent />;

type PrintClient = {
  id: string;
  name: string;
  bookingNumber: string;
  phone: string;
  room: string;
  status: string;
  arrival: string;
  notes: string;
};

const getId = (value: any) => typeof value === 'object' ? value?._id || value?.id : value;

const formatDate = (value?: string | Date) => {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString();
};

const getRetreatCode = (retreat?: Retreat | null) => String(
  retreat?.retreatCode || retreat?.code || retreat?.name || 'Retreat',
);

const ROWS: Array<{ label: string; value: (client: PrintClient) => string }> = [
  { label: 'Full name', value: (client) => client.name },
  { label: 'Client ID', value: (client) => client.id },
  { label: 'Booking #', value: (client) => client.bookingNumber },
  { label: 'Phone', value: (client) => client.phone },
  { label: 'Room', value: (client) => client.room },
  { label: 'Status', value: (client) => client.status },
  { label: 'Arrival', value: (client) => client.arrival },
  { label: 'Notes', value: (client) => client.notes },
];

const chunk = <T,>(items: T[], size: number): T[][] => {
  if (!items.length) return [[]];
  return Array.from({ length: Math.ceil(items.length / size) }, (_, index) => items.slice(index * size, (index + 1) * size));
};

const RetreatClientsPrintPage: React.FC = () => {
  const { retreatId = '' } = useParams();
  const navigate = useNavigate();
  const [retreat, setRetreat] = useState<Retreat | null>(null);
  const [clients, setClients] = useState<PrintClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    Promise.all([
      retreatsApi.getOne(retreatId),
      bookingsApi.getByRetreatWithDetails(retreatId),
    ]).then(([retreatResponse, bookingsResponse]) => {
      if (!active) return;
      setRetreat(retreatResponse.data);
      setClients((bookingsResponse.data || [])
        .filter((booking: any) => String(booking.status || '').toLowerCase() !== 'cancelled')
        .map((booking: any) => {
          const client = typeof booking.clientId === 'object' ? booking.clientId : booking.client || {};
          const displayId = client.display_id || client.displayId;
          return {
            id: displayId ? `#${displayId}` : String(getId(client) || ''),
            name: `${client.firstName || client.fname || ''} ${client.lastName || client.lname || ''}`.trim() || 'Unknown client',
            bookingNumber: String(booking.bookingNumber || booking.display_id || booking.displayId || ''),
            phone: String(client.phone || ''),
            room: String(booking.roomAssignment || ''),
            status: String(booking.status || 'pending').replace(/_/g, ' '),
            arrival: formatDate(booking.checkInDate || retreatResponse.data?.startDate),
            notes: String(booking.specialRequests || booking.notes || ''),
          };
        }));
    }).catch((loadError: any) => {
      if (active) setError(loadError?.response?.data?.message || loadError?.message || 'Unable to load retreat clients.');
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [retreatId]);

  const pages = useMemo(() => chunk(clients, 6), [clients]);

  return (
    <div className="retreat-client-print-page">
      <div className="retreat-client-print-toolbar">
        <button type="button" onClick={() => navigate(-1)}><Icon icon={FiArrowLeft} /> Back</button>
        <button type="button" onClick={() => window.print()} disabled={loading || Boolean(error)}><Icon icon={FiPrinter} /> Print</button>
      </div>
      {loading && <div className="retreat-client-print-message">Loading retreat clients…</div>}
      {error && <div className="retreat-client-print-message retreat-client-print-error">{error}</div>}
      {!loading && !error && pages.map((pageClients, pageIndex) => (
        <section className="retreat-client-print-sheet" key={pageIndex}>
          <h1>{getRetreatCode(retreat)}</h1>
          {pages.length > 1 && <div className="retreat-client-print-page-number">Page {pageIndex + 1} of {pages.length}</div>}
          <table>
            <tbody>
              {ROWS.map((row) => (
                <tr key={row.label}>
                  <th scope="row">{row.label}</th>
                  {pageClients.map((client, clientIndex) => (
                    <td key={`${client.bookingNumber}-${clientIndex}`}>{row.value(client)}</td>
                  ))}
                  {Array.from({ length: Math.max(0, 6 - pageClients.length) }, (_, index) => <td key={`empty-${index}`} />)}
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}
    </div>
  );
};

export default RetreatClientsPrintPage;
