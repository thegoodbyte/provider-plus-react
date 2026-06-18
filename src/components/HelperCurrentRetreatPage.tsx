import React, { useEffect, useMemo, useState } from 'react';
import { FiActivity, FiEdit2, FiFileText, FiRefreshCw, FiSave, FiTrash2, FiUpload, FiX } from 'react-icons/fi';
import { helperAccessApi } from '../services/api';

const Icon: React.FC<{ icon: any; className?: string }> = ({ icon: IconComponent, className }) => {
  return <IconComponent className={className} />;
};

type ClientSummary = {
  _id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  display_id?: number;
};

type HelperBooking = {
  _id: string;
  bookingNumber?: number;
  clientId: ClientSummary;
  status?: string;
};

type HelperRecord = {
  _id: string;
  display_id?: number;
  bookingId?: string | { _id: string };
  clientId?: string | ClientSummary;
  artifactType: 'ekg' | 'blood_pressure';
  title: string;
  data?: Record<string, any>;
  notes?: string;
  receivedAt?: string;
  files?: Array<{ fileName?: string; url?: string; s3Key?: string; uploadedAt?: string }>;
};

type HelperDashboard = {
  retreat?: {
    _id: string;
    name: string;
    code?: string;
    retreatCode?: string;
    startDate?: string;
    endDate?: string;
    location?: string;
  };
  bookings: HelperBooking[];
  records: HelperRecord[];
};

const formatDate = (value?: string) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString();
};

const toDateTimeInput = (value?: string) => {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return '';
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};

const getBookingId = (record: HelperRecord) => {
  if (!record.bookingId) return '';
  return typeof record.bookingId === 'string' ? record.bookingId : record.bookingId._id;
};

const clientName = (client?: ClientSummary) => {
  const name = [client?.firstName, client?.lastName].filter(Boolean).join(' ').trim();
  return name || 'Participant';
};

const HelperCurrentRetreatPage: React.FC = () => {
  const [dashboard, setDashboard] = useState<HelperDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ekgForms, setEkgForms] = useState<Record<string, { files: File[]; notes: string }>>({});
  const [bpForms, setBpForms] = useState<Record<string, { systolic: string; diastolic: string; pulse: string; measuredAt: string; notes: string }>>({});
  const [editing, setEditing] = useState<Record<string, { systolic?: string; diastolic?: string; pulse?: string; measuredAt?: string; notes?: string }>>({});

  const loadDashboard = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await helperAccessApi.getCurrentRetreat();
      setDashboard(response.data);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Could not load current retreat helper dashboard.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  const recordsByBooking = useMemo(() => {
    const map = new Map<string, HelperRecord[]>();
    for (const record of dashboard?.records || []) {
      const bookingId = getBookingId(record);
      if (!map.has(bookingId)) map.set(bookingId, []);
      map.get(bookingId)?.push(record);
    }
    return map;
  }, [dashboard?.records]);

  const uploadEkg = async (bookingId: string) => {
    const form = ekgForms[bookingId];
    if (!form?.files?.length) {
      setError('Choose at least one EKG file first.');
      return;
    }
    setSavingId(`ekg-${bookingId}`);
    setError(null);
    try {
      await helperAccessApi.uploadEkg(bookingId, form.files, { notes: form.notes });
      setEkgForms((prev) => ({ ...prev, [bookingId]: { files: [], notes: '' } }));
      await loadDashboard();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'EKG upload failed.');
    } finally {
      setSavingId(null);
    }
  };

  const saveBloodPressure = async (bookingId: string) => {
    const form = bpForms[bookingId];
    if (!form?.systolic || !form?.diastolic) {
      setError('Enter systolic and diastolic values.');
      return;
    }
    setSavingId(`bp-${bookingId}`);
    setError(null);
    try {
      await helperAccessApi.createBloodPressure(bookingId, {
        ...form,
        measuredAt: form.measuredAt || new Date().toISOString(),
      });
      setBpForms((prev) => ({
        ...prev,
        [bookingId]: { systolic: '', diastolic: '', pulse: '', measuredAt: toDateTimeInput(), notes: '' },
      }));
      await loadDashboard();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Blood pressure entry failed.');
    } finally {
      setSavingId(null);
    }
  };

  const startEdit = (record: HelperRecord) => {
    setEditing((prev) => ({
      ...prev,
      [record._id]: {
        systolic: record.data?.systolic ? String(record.data.systolic) : '',
        diastolic: record.data?.diastolic ? String(record.data.diastolic) : '',
        pulse: record.data?.pulse ? String(record.data.pulse) : '',
        measuredAt: toDateTimeInput(record.data?.measuredAt || record.receivedAt),
        notes: record.notes || '',
      },
    }));
  };

  const saveEdit = async (record: HelperRecord) => {
    const edit = editing[record._id] || {};
    setSavingId(record._id);
    setError(null);
    try {
      await helperAccessApi.updateRecord(record._id, edit);
      setEditing((prev) => {
        const next = { ...prev };
        delete next[record._id];
        return next;
      });
      await loadDashboard();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Record update failed.');
    } finally {
      setSavingId(null);
    }
  };

  const deleteRecord = async (record: HelperRecord) => {
    if (!window.confirm('Delete this helper record?')) return;
    setSavingId(record._id);
    setError(null);
    try {
      await helperAccessApi.deleteRecord(record._id);
      await loadDashboard();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Record delete failed.');
    } finally {
      setSavingId(null);
    }
  };

  if (loading && !dashboard) {
    return <div className="p-6 text-sm text-apple-gray-600">Loading current retreat...</div>;
  }

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-apple-gray-900">Current Retreat Helper</h2>
          <p className="mt-1 text-sm text-apple-gray-600">
            {dashboard?.retreat ? (
              <>
                {dashboard.retreat.code || dashboard.retreat.retreatCode || dashboard.retreat.name} · {formatDate(dashboard.retreat.startDate)} - {formatDate(dashboard.retreat.endDate)}
              </>
            ) : 'No current retreat found'}
          </p>
        </div>
        <button
          onClick={loadDashboard}
          className="inline-flex items-center justify-center gap-2 rounded-apple border border-apple-gray-200 px-3 py-2 text-sm font-medium text-apple-gray-700 hover:bg-apple-gray-50"
        >
          <Icon icon={FiRefreshCw} className="h-4 w-4" />
          Refresh
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-apple border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {typeof error === 'string' ? error : JSON.stringify(error)}
        </div>
      )}

      <div className="space-y-4">
        {(dashboard?.bookings || []).map((booking) => {
          const bookingId = booking._id;
          const participantRecords = recordsByBooking.get(bookingId) || [];
          const bpForm = bpForms[bookingId] || { systolic: '', diastolic: '', pulse: '', measuredAt: toDateTimeInput(), notes: '' };
          const ekgForm = ekgForms[bookingId] || { files: [], notes: '' };

          return (
            <section key={bookingId} className="rounded-apple border border-apple-gray-200 bg-white">
              <div className="flex flex-col gap-2 border-b border-apple-gray-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="font-semibold text-apple-gray-900">
                    #{booking.bookingNumber || 'No #'} · {clientName(booking.clientId)}
                  </h3>
                  <p className="text-xs text-apple-gray-500">{booking.clientId?.email || 'No email'} · {booking.status || 'active'}</p>
                </div>
                <div className="text-xs font-medium text-apple-gray-500">
                  {participantRecords.length} record{participantRecords.length === 1 ? '' : 's'}
                </div>
              </div>

              <div className="grid gap-4 p-4 lg:grid-cols-2">
                <div className="rounded-apple border border-apple-gray-100 p-3">
                  <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-apple-gray-800">
                    <Icon icon={FiUpload} className="h-4 w-4" />
                    EKG upload
                  </div>
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.heic,.heif,image/*,application/pdf"
                    multiple
                    onChange={(event) => setEkgForms((prev) => ({
                      ...prev,
                      [bookingId]: { ...ekgForm, files: Array.from(event.target.files || []) },
                    }))}
                    className="block w-full text-sm text-apple-gray-700 file:mr-3 file:rounded-apple file:border-0 file:bg-apple-gray-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-apple-gray-700"
                  />
                  <textarea
                    value={ekgForm.notes}
                    onChange={(event) => setEkgForms((prev) => ({ ...prev, [bookingId]: { ...ekgForm, notes: event.target.value } }))}
                    placeholder="EKG notes"
                    className="mt-3 min-h-20 w-full rounded-apple border border-apple-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  />
                  <button
                    onClick={() => uploadEkg(bookingId)}
                    disabled={savingId === `ekg-${bookingId}`}
                    className="mt-3 inline-flex items-center gap-2 rounded-apple bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
                  >
                    <Icon icon={FiUpload} className="h-4 w-4" />
                    Upload EKG
                  </button>
                </div>

                <div className="rounded-apple border border-apple-gray-100 p-3">
                  <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-apple-gray-800">
                    <Icon icon={FiActivity} className="h-4 w-4" />
                    Blood pressure
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <input
                      value={bpForm.systolic}
                      onChange={(event) => setBpForms((prev) => ({ ...prev, [bookingId]: { ...bpForm, systolic: event.target.value } }))}
                      placeholder="SYS"
                      inputMode="numeric"
                      className="rounded-apple border border-apple-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                    />
                    <input
                      value={bpForm.diastolic}
                      onChange={(event) => setBpForms((prev) => ({ ...prev, [bookingId]: { ...bpForm, diastolic: event.target.value } }))}
                      placeholder="DIA"
                      inputMode="numeric"
                      className="rounded-apple border border-apple-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                    />
                    <input
                      value={bpForm.pulse}
                      onChange={(event) => setBpForms((prev) => ({ ...prev, [bookingId]: { ...bpForm, pulse: event.target.value } }))}
                      placeholder="Pulse"
                      inputMode="numeric"
                      className="rounded-apple border border-apple-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                    />
                    <input
                      type="datetime-local"
                      value={bpForm.measuredAt}
                      onChange={(event) => setBpForms((prev) => ({ ...prev, [bookingId]: { ...bpForm, measuredAt: event.target.value } }))}
                      className="rounded-apple border border-apple-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                  <textarea
                    value={bpForm.notes}
                    onChange={(event) => setBpForms((prev) => ({ ...prev, [bookingId]: { ...bpForm, notes: event.target.value } }))}
                    placeholder="Blood pressure notes"
                    className="mt-3 min-h-20 w-full rounded-apple border border-apple-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  />
                  <button
                    onClick={() => saveBloodPressure(bookingId)}
                    disabled={savingId === `bp-${bookingId}`}
                    className="mt-3 inline-flex items-center gap-2 rounded-apple bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
                  >
                    <Icon icon={FiSave} className="h-4 w-4" />
                    Save BP
                  </button>
                </div>
              </div>

              {participantRecords.length > 0 && (
                <div className="border-t border-apple-gray-100 px-4 py-3">
                  <div className="mb-2 text-sm font-semibold text-apple-gray-800">Records</div>
                  <div className="space-y-2">
                    {participantRecords.map((record) => {
                      const edit = editing[record._id];
                      const isBp = record.artifactType === 'blood_pressure';
                      return (
                        <div key={record._id} className="rounded-apple bg-apple-gray-50 p-3">
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 text-sm font-semibold text-apple-gray-900">
                                {isBp ? <Icon icon={FiActivity} className="h-4 w-4" /> : <Icon icon={FiFileText} className="h-4 w-4" />}
                                {isBp ? 'Blood pressure' : 'EKG'}
                                <span className="text-xs font-normal text-apple-gray-500">{formatDate(record.receivedAt)}</span>
                              </div>
                              {edit ? (
                                <div className="mt-2 grid gap-2 sm:grid-cols-4">
                                  {isBp && (
                                    <>
                                      <input value={edit.systolic || ''} onChange={(event) => setEditing((prev) => ({ ...prev, [record._id]: { ...edit, systolic: event.target.value } }))} className="rounded-apple border border-apple-gray-200 px-2 py-1 text-sm" placeholder="SYS" />
                                      <input value={edit.diastolic || ''} onChange={(event) => setEditing((prev) => ({ ...prev, [record._id]: { ...edit, diastolic: event.target.value } }))} className="rounded-apple border border-apple-gray-200 px-2 py-1 text-sm" placeholder="DIA" />
                                      <input value={edit.pulse || ''} onChange={(event) => setEditing((prev) => ({ ...prev, [record._id]: { ...edit, pulse: event.target.value } }))} className="rounded-apple border border-apple-gray-200 px-2 py-1 text-sm" placeholder="Pulse" />
                                      <input type="datetime-local" value={edit.measuredAt || ''} onChange={(event) => setEditing((prev) => ({ ...prev, [record._id]: { ...edit, measuredAt: event.target.value } }))} className="rounded-apple border border-apple-gray-200 px-2 py-1 text-sm" />
                                    </>
                                  )}
                                  <textarea value={edit.notes || ''} onChange={(event) => setEditing((prev) => ({ ...prev, [record._id]: { ...edit, notes: event.target.value } }))} className="min-h-16 rounded-apple border border-apple-gray-200 px-2 py-1 text-sm sm:col-span-4" placeholder="Notes" />
                                </div>
                              ) : (
                                <div className="mt-1 text-sm text-apple-gray-700">
                                  {isBp && <span>{record.data?.systolic}/{record.data?.diastolic}{record.data?.pulse ? ` pulse ${record.data.pulse}` : ''}</span>}
                                  {record.notes && <p className="mt-1 whitespace-pre-wrap">{record.notes}</p>}
                                  {record.files?.length ? (
                                    <div className="mt-2 flex flex-wrap gap-2">
                                      {record.files.map((file, index) => (
                                        <a key={`${file.s3Key || file.fileName}-${index}`} href={file.url || '#'} target="_blank" rel="noreferrer" className="rounded-apple bg-white px-2 py-1 text-xs font-medium text-blue-700 hover:text-blue-900">
                                          {file.fileName || `File ${index + 1}`}
                                        </a>
                                      ))}
                                    </div>
                                  ) : null}
                                </div>
                              )}
                            </div>
                            <div className="flex flex-shrink-0 gap-2">
                              {edit ? (
                                <>
                                  <button onClick={() => saveEdit(record)} className="rounded-apple p-2 text-emerald-700 hover:bg-emerald-50" aria-label="Save record"><Icon icon={FiSave} /></button>
                                  <button onClick={() => setEditing((prev) => { const next = { ...prev }; delete next[record._id]; return next; })} className="rounded-apple p-2 text-apple-gray-600 hover:bg-white" aria-label="Cancel edit"><Icon icon={FiX} /></button>
                                </>
                              ) : (
                                <button onClick={() => startEdit(record)} className="rounded-apple p-2 text-apple-gray-700 hover:bg-white" aria-label="Edit record"><Icon icon={FiEdit2} /></button>
                              )}
                              <button onClick={() => deleteRecord(record)} className="rounded-apple p-2 text-red-700 hover:bg-red-50" aria-label="Delete record"><Icon icon={FiTrash2} /></button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
};

export default HelperCurrentRetreatPage;
