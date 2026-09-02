import React, { useEffect, useMemo, useState } from 'react';
import { bookingsApi, ceremoniesApi, clientsApi, paymentRequestsApi, retreatsApi } from '../services/api';
import { RetreatClient, Client, Retreat, PaymentRequest, Ceremony } from '../types';
import SearchableClientSelect from './SearchableClientSelect';
import SearchableRetreatSelect from './SearchableRetreatSelect';
import SearchablePaymentRequestSelect from './SearchablePaymentRequestSelect';
import AppleButton from './AppleButton';
import LoadingSpinner from './LoadingSpinner';
import { bookingPriceFromPaymentRequest, bookingPriceLinesForClient } from './bookingPaymentRequestPricing';

type BookingFormData = {
  clientId: string;
  retreatId: string;
  paymentRequestId: string;
  totalAmount: number;
  amountPaid: number;
  currency: 'EUR' | 'USD' | 'CZK' | 'PLN';
  status: 'pending' | 'confirmed' | 'checked-in' | 'checked-out' | 'cancelled';
  bookingNumber: string;
  bookingType: 'full_retreat' | 'booster';
  ceremonyId: string;
  ceremonyNumber: string;
  checkInDate: string;
  checkOutDate: string;
  contractGateOverride: 'inherit' | 'required' | 'disabled';
};

const bookingStatusValues = ['pending', 'confirmed', 'checked-in', 'checked-out', 'cancelled'] as const;
type BookingStatus = typeof bookingStatusValues[number];

const normalizeBookingStatus = (status?: string | null): BookingStatus => {
  const normalized = status === 'checked_in' ? 'checked-in' : status === 'checked_out' ? 'checked-out' : status;
  return bookingStatusValues.includes(normalized as BookingStatus) ? normalized as BookingStatus : 'pending';
};

const formatDate = (value?: string | Date | null) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString();
};

interface BookingEditorFormProps {
  mode: 'create' | 'edit';
  bookingId?: string;
  initialBooking?: RetreatClient | null;
  initialRetreats?: Retreat[];
  initialBookingData?: Partial<BookingFormData>;
  onCancel: () => void;
  onSaved: () => void;
  submitLabel?: string;
  showBackButton?: boolean;
}

const emptyForm = (): BookingFormData => ({
  clientId: '',
  retreatId: '',
  paymentRequestId: '',
  totalAmount: 0,
  amountPaid: 0,
  currency: 'EUR',
  status: 'pending',
  bookingNumber: '',
  bookingType: 'full_retreat',
  ceremonyId: '',
  ceremonyNumber: '',
  checkInDate: '',
  checkOutDate: '',
  contractGateOverride: 'inherit',
});

const toDateTimeInput = (value?: string | Date | null) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
};

const retreatDatePart = (value?: string | Date) => {
  if (!value) return '';
  if (typeof value === 'string') {
    const match = value.match(/^(\d{4}-\d{2}-\d{2})/);
    if (match) return match[1];
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
};

export const retreatBookingDateTimes = (retreat?: Retreat) => {
  const startDate = retreatDatePart(retreat?.startDate || retreat?.dates?.startDate);
  const endDate = retreatDatePart(retreat?.endDate || retreat?.dates?.endDate);
  const startTime = retreat?.startTime || retreat?.dates?.startTime || '';
  const endTime = retreat?.endTime || retreat?.dates?.endTime || '';
  return {
    checkInDate: startDate ? `${startDate}T${startTime || '00:00'}` : '',
    checkOutDate: endDate ? `${endDate}T${endTime || '00:00'}` : '',
  };
};

const BookingEditorForm: React.FC<BookingEditorFormProps> = ({
  mode,
  bookingId,
  initialBooking,
  initialRetreats,
  initialBookingData,
  onCancel,
  onSaved,
  submitLabel,
  showBackButton = false,
}) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [retreats, setRetreats] = useState<Retreat[]>(initialRetreats || []);
  const [ceremonies, setCeremonies] = useState<Ceremony[]>([]);
  const [booking, setBooking] = useState<RetreatClient | null>(initialBooking || null);
  const [formData, setFormData] = useState<BookingFormData>(emptyForm());
  const [bookingNumberError, setBookingNumberError] = useState('');
  const [selectedRequest, setSelectedRequest] = useState<PaymentRequest | undefined>();
  const [cancellationReason, setCancellationReason] = useState('');
  const [depositTreatment, setDepositTreatment] = useState<'no_refund' | 'partial_refund' | 'full_refund' | 'credit_transfer'>('no_refund');
  const [cancellationNotes, setCancellationNotes] = useState('');

  useEffect(() => {
    loadData();
  }, [bookingId, initialBooking, initialBookingData, initialRetreats, mode]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [clientsResponse, retreatsResponse, nextNumberResponse] = await Promise.all([
        clientsApi.getBookingOptions(),
        initialRetreats?.length ? Promise.resolve({ data: initialRetreats }) : retreatsApi.getAll(),
        mode === 'create'
          ? bookingsApi.getNextBookingNumber().catch((error) => {
              console.error('Error loading next booking number:', error);
              return { data: undefined };
            })
          : Promise.resolve({ data: undefined }),
      ]);
      setClients(clientsResponse.data || []);
      setRetreats(retreatsResponse.data || []);

      let currentBooking = initialBooking || null;
      if (mode === 'edit' && bookingId && !currentBooking) {
        const response = await bookingsApi.getOne(bookingId);
        currentBooking = response.data || null;
      }
      setBooking(currentBooking);
      setCancellationReason(currentBooking?.cancellationReason || '');
      setDepositTreatment(currentBooking?.cancellationDepositTreatment || 'no_refund');
      setCancellationNotes(currentBooking?.cancellationNotes || '');

      if (currentBooking) {
        setFormData({
          clientId: typeof currentBooking.clientId === 'string' ? currentBooking.clientId : (currentBooking.clientId as any)?._id || '',
          retreatId: typeof currentBooking.retreatId === 'string' ? currentBooking.retreatId : (currentBooking.retreatId as any)?._id || '',
          paymentRequestId: typeof currentBooking.paymentRequestId === 'string' ? currentBooking.paymentRequestId : (currentBooking.paymentRequestId as any)?._id || '',
          totalAmount: Number(currentBooking.totalAmount || 0),
          amountPaid: Number(currentBooking.amountPaid || 0),
          currency: (currentBooking.currency || 'EUR') as BookingFormData['currency'],
          status: normalizeBookingStatus(currentBooking.status),
          bookingNumber: currentBooking.bookingNumber?.toString() || '',
          bookingType: currentBooking.bookingType || 'full_retreat',
          ceremonyId: typeof currentBooking.ceremonyId === 'string' ? currentBooking.ceremonyId : currentBooking.ceremonyId?._id || '',
          ceremonyNumber: currentBooking.ceremonyNumber?.toString() || '',
          checkInDate: toDateTimeInput(currentBooking.checkInDate),
          checkOutDate: toDateTimeInput(currentBooking.checkOutDate),
          contractGateOverride: currentBooking.contractGateOverride === true
            ? 'required'
            : currentBooking.contractGateOverride === false ? 'disabled' : 'inherit',
        });
      } else {
        setFormData({
          ...emptyForm(),
          ...initialBookingData,
          bookingNumber: nextNumberResponse.data ? String(nextNumberResponse.data) : '',
        });
      }
    } catch (error) {
      console.error('Error loading booking editor data:', error);
      setClients([]);
      setRetreats([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!formData.retreatId) {
      setCeremonies([]);
      return;
    }
    ceremoniesApi.getByRetreat(formData.retreatId)
      .then((response) => setCeremonies((response.data || []).sort((a, b) =>
        new Date(a.date).getTime() - new Date(b.date).getTime())))
      .catch((error) => {
        console.error('Error loading retreat ceremonies:', error);
        setCeremonies([]);
      });
  }, [formData.retreatId]);

  useEffect(() => {
    if (!formData.paymentRequestId) {
      setSelectedRequest(undefined);
      return;
    }
    paymentRequestsApi.getOne(formData.paymentRequestId)
      .then(response => setSelectedRequest(response.data))
      .catch(() => setSelectedRequest(undefined));
  }, [formData.paymentRequestId]);

  const resolveId = (value: any) => {
    if (!value) return '';
    if (typeof value === 'string') return value;
    return value._id || '';
  };

  const handlePaymentRequestSelect = (paymentRequestId: string, paymentRequest?: PaymentRequest) => {
    const paymentRetreatId = paymentRequest?.retreatId ? resolveId(paymentRequest.retreatId) : '';
    const retreatDefaults = retreatBookingDateTimes(retreats.find((retreat) => retreat._id === paymentRetreatId));
    setSelectedRequest(paymentRequest);
    setFormData((prev) => {
      const selectedClientId = prev.clientId || (paymentRequest?.clientId ? resolveId(paymentRequest.clientId) : '');
      return {
        ...prev,
        paymentRequestId,
        clientId: selectedClientId,
        retreatId: paymentRetreatId || prev.retreatId,
        checkInDate: paymentRetreatId && paymentRetreatId !== prev.retreatId ? retreatDefaults.checkInDate : prev.checkInDate,
        checkOutDate: paymentRetreatId && paymentRetreatId !== prev.retreatId ? retreatDefaults.checkOutDate : prev.checkOutDate,
        totalAmount: bookingPriceFromPaymentRequest(paymentRequest, selectedClientId) ?? prev.totalAmount,
        amountPaid: prev.amountPaid,
        currency: paymentRequest?.currency ? paymentRequest.currency : prev.currency,
        bookingType: paymentRequest?.bookingType || prev.bookingType,
        ceremonyId: paymentRequest?.bookingType === 'booster'
          ? resolveId(paymentRequest.ceremonyId)
          : prev.ceremonyId,
        ceremonyNumber: paymentRequest?.bookingType === 'booster'
          ? String(paymentRequest.ceremonyNumber || '')
          : prev.ceremonyNumber,
      };
    });
  };

  const handleClientSelect = (clientId: string) => {
    setFormData((prev) => ({
      ...prev,
      clientId,
      paymentRequestId: clientId === prev.clientId ? prev.paymentRequestId : '',
    }));
  };

  const handleRetreatSelect = (retreatId: string) => {
    const selectedRetreat = retreats.find((retreat) => retreat._id === retreatId);
    const defaults = retreatBookingDateTimes(selectedRetreat);
    setFormData((prev) => ({
      ...prev,
      retreatId,
      checkInDate: retreatId === prev.retreatId ? prev.checkInDate : defaults.checkInDate,
      checkOutDate: retreatId === prev.retreatId ? prev.checkOutDate : defaults.checkOutDate,
    }));
  };

  const validateBookingNumber = async (value: string) => {
    if (!value.trim()) {
      setBookingNumberError('');
      return true;
    }
    const numericBookingNumber = parseInt(value, 10);
    if (Number.isNaN(numericBookingNumber)) {
      setBookingNumberError('Booking number must be a valid number');
      return false;
    }
    try {
      const availability = await bookingsApi.isBookingNumberAvailable(numericBookingNumber, bookingId);
      if (!availability.data?.available) {
        setBookingNumberError(`Booking number ${numericBookingNumber} is already in use`);
        return false;
      }
      setBookingNumberError('');
      return true;
    } catch (error) {
      console.error('Error validating booking number:', error);
      setBookingNumberError('Unable to validate booking number');
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (bookingNumberError) return;
    try {
      setSaving(true);
      const bookingNumberValue = formData.bookingNumber.trim();
      const bookingNumber = bookingNumberValue ? Number(bookingNumberValue) : undefined;
      const payload = {
        clientId: formData.clientId,
        retreatId: formData.retreatId,
        paymentRequestId: formData.paymentRequestId || undefined,
        totalAmount: Number(formData.totalAmount || 0),
        currency: formData.currency,
        status: formData.status,
        bookingNumber: Number.isFinite(bookingNumber) ? bookingNumber : undefined,
        bookingType: formData.bookingType,
        ceremonyId: formData.bookingType === 'booster' ? formData.ceremonyId : undefined,
        ceremonyNumber: formData.bookingType === 'booster' ? Number(formData.ceremonyNumber) : undefined,
        registrationDate: booking?.registrationDate || new Date().toISOString(),
        checkInDate: formData.checkInDate ? new Date(formData.checkInDate).toISOString() : undefined,
        checkOutDate: formData.checkOutDate ? new Date(formData.checkOutDate).toISOString() : undefined,
        roomAssignment: (booking as any)?.roomAssignment || '',
        specialRequests: (booking as any)?.specialRequests || '',
        notes: (booking as any)?.notes || '',
        contractGateOverride: formData.contractGateOverride === 'inherit'
          ? null
          : formData.contractGateOverride === 'required',
      };

      if (payload.bookingNumber != null) {
        const valid = await validateBookingNumber(String(payload.bookingNumber));
        if (!valid) return;
      }
      if (formData.bookingType === 'booster' && !formData.ceremonyNumber) {
        alert('Please select the ceremony this booster guest will attend.');
        return;
      }
      if (formData.checkInDate && formData.checkOutDate && new Date(formData.checkOutDate) <= new Date(formData.checkInDate)) {
        alert('Check-out must be after check-in.');
        return;
      }

      if (mode === 'edit' && bookingId) {
        if (formData.status === 'cancelled' && booking?.status !== 'cancelled') {
          if (!cancellationReason.trim()) {
            alert('Please enter a cancellation reason.');
            return;
          }
          const { status: _status, ...bookingChanges } = payload;
          await bookingsApi.update(bookingId, bookingChanges as any);
          const depositTreatmentMap = {
            no_refund: 'retained',
            partial_refund: 'partially_refunded',
            full_refund: 'refund_pending',
            credit_transfer: 'credited',
          } as const;
          await bookingsApi.cancelBooking(bookingId, {
            cancellationDate: new Date().toISOString(),
            cancellationReason: cancellationReason.trim(),
            cancellationDepositTreatment: depositTreatmentMap[depositTreatment],
            cancellationNotes: cancellationNotes.trim() || undefined,
          });
        } else {
          await bookingsApi.update(bookingId, payload as any);
        }
      } else {
        await bookingsApi.create(payload as any);
      }

      onSaved();
    } catch (error) {
      console.error('Error saving booking:', error);
      const message = (error as any)?.response?.data?.message || (error as any)?.message || `Error ${mode === 'edit' ? 'updating' : 'creating'} booking`;
      alert(Array.isArray(message) ? message.join(' ') : String(message));
    } finally {
      setSaving(false);
    }
  };

  const selectedPaymentRequest = useMemo(() => formData.paymentRequestId, [formData.paymentRequestId]);
  const selectedPriceLines = useMemo(
    () => bookingPriceLinesForClient(selectedRequest, formData.clientId),
    [selectedRequest, formData.clientId],
  );

  if (loading) {
    return <LoadingSpinner message={mode === 'edit' ? 'Loading booking...' : 'Loading form...'} />;
  }

  return (
    <div className="w-full">
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Booking number</label>
            <input
              type="number"
              min={1001}
              step={1}
              value={formData.bookingNumber}
              onChange={(e) => {
                const value = e.target.value;
                setFormData({ ...formData, bookingNumber: value });
                void validateBookingNumber(value);
              }}
              className={`w-full rounded-md border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 ${bookingNumberError ? 'border-red-500' : 'border-gray-300'}`}
              placeholder="Optional"
            />
            {bookingNumberError && <p className="mt-1 text-sm text-red-600">{bookingNumberError}</p>}
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Booking dates</label>
            <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-600 max-sm:rounded-none max-sm:border-x-0 max-sm:px-0 max-sm:py-2">
              <div>Registration: {formatDate(booking?.registrationDate)}</div>
              <div>Check-in: {formatDate(booking?.checkInDate)}</div>
              <div>Check-out: {formatDate(booking?.checkOutDate)}</div>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-blue-100 bg-blue-50 p-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Booking type</label>
              <select
                value={formData.bookingType}
                onChange={(e) => setFormData((prev) => ({
                  ...prev,
                  bookingType: e.target.value as BookingFormData['bookingType'],
                  ceremonyId: e.target.value === 'booster' ? prev.ceremonyId : '',
                  ceremonyNumber: e.target.value === 'booster' ? prev.ceremonyNumber : '',
                }))}
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="full_retreat">Full 7-day retreat</option>
                <option value="booster">Booster within this retreat</option>
              </select>
            </div>
            {formData.bookingType === 'booster' && (
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Ceremony attending *</label>
                <select
                  value={formData.ceremonyNumber}
                  onChange={(e) => {
                    const position = Number(e.target.value);
                    setFormData((prev) => ({
                      ...prev,
                      ceremonyNumber: e.target.value,
                      ceremonyId: ceremonies[position - 1]?._id || '',
                    }));
                  }}
                  className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">Select ceremony...</option>
                  {Array.from({ length: retreats.find((item) => item._id === formData.retreatId)?.ceremonyCount || 2 }, (_, index) => (
                    <option key={index + 1} value={index + 1}>
                      Ceremony {index + 1}{ceremonies[index]?.date ? ` — ${new Date(ceremonies[index].date).toLocaleDateString()}` : ''}
                    </option>
                  ))}
                </select>
                {!ceremonies.length && formData.retreatId && (
                  <p className="mt-1 text-xs text-amber-700">Add ceremonies to this retreat before making a booster booking.</p>
                )}
              </div>
            )}
          </div>
          <p className="mt-2 text-xs text-blue-700">
            Booster guests remain part of this retreat, but appear only in their selected ceremony.
          </p>
        </div>

        <div className="rounded-lg border border-indigo-100 bg-indigo-50 p-4">
          <label className="mb-1 block text-sm font-semibold text-gray-800">IbogaReady contract access</label>
          <select
            value={formData.contractGateOverride}
            onChange={(event) => setFormData((previous) => ({
              ...previous,
              contractGateOverride: event.target.value as BookingFormData['contractGateOverride'],
            }))}
            className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 md:max-w-md"
          >
            <option value="inherit">Use global setting</option>
            <option value="required">Require signed contract</option>
            <option value="disabled">Allow access without signed contract</option>
          </select>
          <p className="mt-2 text-xs text-indigo-800">
            This booking-level choice overrides the global setting in Communications → Settings.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Client</label>
            <SearchableClientSelect
              clients={clients}
              selectedClientId={formData.clientId}
              onClientSelect={handleClientSelect}
              placeholder="Search and select a client..."
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Retreat</label>
            {mode === 'edit' ? <>
              <div className="rounded-md border border-gray-300 bg-gray-100 px-3 py-2 text-sm text-gray-800">{(() => { const selected = retreats.find((item) => item._id === formData.retreatId); return selected ? `${selected.name}${selected.location ? ` — ${selected.location}` : ''}` : 'Current retreat'; })()}</div>
              <p className="mt-1.5 text-xs font-medium text-amber-800">To move this booking, close Edit and use <strong>Reschedule booking</strong>. That also moves deadlines, documents, medical reviews, and payment planning.</p>
            </> : <SearchableRetreatSelect
                retreats={retreats}
                selectedRetreatId={formData.retreatId}
                onRetreatSelect={handleRetreatSelect}
                placeholder="Search and select a retreat..."
                required
              />}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Arrival</label>
            <input type="datetime-local" value={formData.checkInDate}
              onChange={(e) => setFormData((prev) => ({ ...prev, checkInDate: e.target.value }))}
              className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Departure</label>
            <input type="datetime-local" value={formData.checkOutDate}
              onChange={(e) => setFormData((prev) => ({ ...prev, checkOutDate: e.target.value }))}
              className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Payment request</label>
          <SearchablePaymentRequestSelect
            selectedPaymentRequestId={formData.paymentRequestId}
            onPaymentRequestSelect={handlePaymentRequestSelect}
            placeholder="Search invoice, client, or retreat"
          />
          <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
            <span>Optional. Multi-person requests remain searchable; only client-assigned price lines are copied.</span>
            {selectedPaymentRequest && (
              <button
                type="button"
                onClick={() => setFormData((prev) => ({ ...prev, paymentRequestId: '' }))}
                className="text-blue-600 hover:text-blue-700"
              >
                Clear selection
              </button>
            )}
          </div>
          {selectedRequest?.lineItems?.length ? (
            <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 p-3">
              <div className="mb-2 flex items-center justify-between gap-3 text-xs font-semibold uppercase tracking-wide text-slate-600">
                <span>Price itemization for this booking</span>
                {!selectedPriceLines.length && <span className="normal-case tracking-normal text-amber-700">Combined request—set this booking’s agreed price below.</span>}
              </div>
              {(selectedPriceLines.length ? selectedPriceLines : selectedRequest.lineItems).map((line, index) => (
                <div key={index} className="flex justify-between gap-4 border-t border-slate-200 py-2 text-sm first:border-t-0">
                  <span>{line.description}</span>
                  <strong className={Number(line.amount) < 0 ? 'text-emerald-700' : 'text-slate-900'}>{Number(line.amount).toFixed(2)} {selectedRequest.currency}</strong>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Agreed price for this booking</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={formData.totalAmount}
              onChange={(e) => setFormData({ ...formData, totalAmount: Number(e.target.value) })}
              className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Paid from payment allocations</label>
            <input
              type="number"
              value={formData.amountPaid}
              readOnly
              className="w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-gray-700"
            />
            <p className="mt-1 text-xs text-gray-500">Read-only ledger total. For a 6,840 PLN joint receipt split evenly, each saved booking must receive a 3,420 PLN allocation in Joint / Split Payment.</p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Currency</label>
            <select
              value={formData.currency}
              onChange={(e) => setFormData({ ...formData, currency: e.target.value as BookingFormData['currency'] })}
              className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="EUR">EUR</option>
              <option value="USD">USD</option>
              <option value="CZK">CZK</option>
              <option value="PLN">PLN</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Status</label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value as BookingFormData['status'] })}
              className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="pending">Pending</option>
              <option value="confirmed">Confirmed</option>
              <option value="checked-in">Checked In</option>
              <option value="checked-out">Checked Out</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>

        {mode === 'edit' && formData.status === 'cancelled' && booking?.status !== 'cancelled' && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 space-y-4">
            <div><h3 className="font-semibold text-red-900">Cancel this booking</h3><p className="text-sm text-red-700">This records the cancellation on the booking. The client profile remains active.</p></div>
            <div><label className="mb-1 block text-sm font-medium text-gray-700">Cancellation reason *</label><textarea rows={3} value={cancellationReason} onChange={e => setCancellationReason(e.target.value)} className="w-full rounded-md border border-gray-300 px-3 py-2" placeholder="Why is this booking being cancelled?" required /></div>
            <div><label className="mb-1 block text-sm font-medium text-gray-700">Deposit treatment *</label><select value={depositTreatment} onChange={e => setDepositTreatment(e.target.value as any)} className="w-full rounded-md border border-gray-300 px-3 py-2"><option value="no_refund">No refund — deposit retained</option><option value="partial_refund">Partial refund</option><option value="full_refund">Full refund</option><option value="credit_transfer">Credit / transfer to another booking</option></select></div>
            <div><label className="mb-1 block text-sm font-medium text-gray-700">Cancellation notes</label><textarea rows={2} value={cancellationNotes} onChange={e => setCancellationNotes(e.target.value)} className="w-full rounded-md border border-gray-300 px-3 py-2" placeholder="Optional internal details" /></div>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <div className="min-w-[220px] flex-1 text-xs text-gray-500">
            A booking can be created without a payment request. That is valid for cash or offline payment flows.
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <AppleButton type="button" onClick={onCancel} className="apple-button-secondary">
              Cancel
            </AppleButton>
            <AppleButton type="submit" className="apple-button-primary" disabled={saving}>
              {saving ? 'Saving...' : submitLabel || (mode === 'edit' ? 'Update Booking' : 'Add Booking')}
            </AppleButton>
          </div>
        </div>
      </form>
    </div>
  );
};

export default BookingEditorForm;
