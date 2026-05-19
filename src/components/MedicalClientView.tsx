import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, FileText, MessageSquarePlus, NotebookText, ScanSearch, UserRound, CalendarDays, ShieldAlert } from 'lucide-react';
import {
  bookingsApi,
  clientMedicalApi,
  clientsApi,
  medicalReviewRequestsApi,
  notesApi,
  screeningApi,
  retreatsApi,
} from '../services/api';
import { Client, ClientMedical, MedicalReviewRequest, Note, RetreatClient, Retreat, ScreeningClient } from '../types';
import { useAuth } from '../context/AuthContext';

type MedicalScreening = ScreeningClient & Record<string, any>;

const iconClass = 'h-4 w-4';

const MedicalClientView: React.FC = () => {
  const { clientId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  const routePrefix = useMemo(() => {
    const firstSegment = location.pathname.split('/').filter(Boolean)[0];
    return ['admin', 'medical', 'staff', 'user'].includes(firstSegment) ? `/${firstSegment}` : '';
  }, [location.pathname]);

  const [loading, setLoading] = useState(true);
  const [client, setClient] = useState<Client | null>(null);
  const [bookings, setBookings] = useState<RetreatClient[]>([]);
  const [retreats, setRetreats] = useState<Retreat[]>([]);
  const [medicalRecords, setMedicalRecords] = useState<ClientMedical[]>([]);
  const [screenings, setScreenings] = useState<MedicalScreening[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [reviewRequests, setReviewRequests] = useState<MedicalReviewRequest[]>([]);
  const [noteTitle, setNoteTitle] = useState('Medical note');
  const [noteContent, setNoteContent] = useState('');
  const [notePriority, setNotePriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');
  const [savingNote, setSavingNote] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!clientId) {
      setLoading(false);
      setError('Missing client ID');
      return;
    }

    let mounted = true;

    const load = async () => {
      setLoading(true);
      setError('');

      try {
        const [
          clientRes,
          bookingsRes,
          retreatsRes,
          medicalRes,
          screeningRes,
          notesRes,
          reviewRes,
        ] = await Promise.allSettled([
          clientsApi.getOne(clientId),
          bookingsApi.getByClient(clientId),
          retreatsApi.getAll(),
          clientMedicalApi.getByClient(clientId),
          screeningApi.getByClient(clientId),
          notesApi.getByClient(clientId),
          medicalReviewRequestsApi.getAll(),
        ]);

        if (!mounted) return;

        if (clientRes.status === 'fulfilled') {
          setClient(clientRes.value.data || null);
        }

        if (bookingsRes.status === 'fulfilled') {
          setBookings(bookingsRes.value.data || []);
        }

        if (retreatsRes.status === 'fulfilled') {
          setRetreats(retreatsRes.value.data || []);
        }

        if (medicalRes.status === 'fulfilled') {
          const records = [...(medicalRes.value.data || [])].sort((a, b) => {
            const aTime = new Date((a.updatedAt || a.createdAt || 0) as string).getTime();
            const bTime = new Date((b.updatedAt || b.createdAt || 0) as string).getTime();
            return bTime - aTime;
          });
          setMedicalRecords(records);
        }

        if (screeningRes.status === 'fulfilled') {
          const screeningData = Array.isArray(screeningRes.value.data) ? screeningRes.value.data : [];
          const sorted = [...screeningData].sort((a, b) => {
            const aTime = new Date((a.updatedAt || a.createdAt || 0) as string).getTime();
            const bTime = new Date((b.updatedAt || b.createdAt || 0) as string).getTime();
            return bTime - aTime;
          });
          setScreenings(sorted);
        }

        if (notesRes.status === 'fulfilled') {
          const payload = notesRes.value.data;
          const noteList = Array.isArray(payload?.data) ? payload.data : [];
          setNotes(noteList);
        }

        if (reviewRes.status === 'fulfilled') {
          const reviewList = Array.isArray(reviewRes.value.data) ? reviewRes.value.data : [];
          setReviewRequests(reviewList.filter((item: MedicalReviewRequest) => {
            const itemClientId = typeof item.clientId === 'string' ? item.clientId : (item.clientId as Client)?._id;
            return itemClientId === clientId;
          }));
        }
      } catch (loadError) {
        console.error('Error loading medical client view:', loadError);
        setError('Unable to load medical client data');
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    load();

    return () => {
      mounted = false;
    };
  }, [clientId]);

  const getCreatorLabel = () => {
    if (!user) return 'Medical Advisor';
    const parts = [user.firstName, user.lastName].filter(Boolean);
    if (parts.length) return parts.join(' ');
    return user.username || user.email || 'Medical Advisor';
  };

  const getRetreatName = (retreatId?: string | Retreat | null) => {
    if (!retreatId) return 'No retreat';
    const id = typeof retreatId === 'string' ? retreatId : retreatId._id;
    if (!id) return 'No retreat';
    const found = retreats.find((retreat) => retreat._id === id);
    return found?.name || (typeof retreatId === 'string' ? retreatId : retreatId.name) || id;
  };

  const latestScreening = screenings[0];
  const latestMedical = medicalRecords[0];

  const formatDateTime = (value?: string | Date | null) => {
    if (!value) return 'Not set';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 'Not set' : date.toLocaleString();
  };

  const renderValue = (value: any) => {
    if (value === null || value === undefined || value === '') return 'Not provided';
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    if (Array.isArray(value)) {
      if (value.length === 0) return 'Not provided';
      return value.map((item) => (typeof item === 'string' ? item : JSON.stringify(item))).join(', ');
    }
    return JSON.stringify(value, null, 2);
  };

  const currentMedications = latestScreening?.currentMedications?.medications || [];
  const supplementFlags = latestScreening?.vitaminsSupplements || {};

  const openMedicalFile = (recordId?: string, type?: 'ekg' | 'liver-panel') => {
    if (!recordId || !type) return;
    navigate(`${routePrefix}/medical-tracking/${recordId}/view/${type}`);
  };

  const handleAddNote = async () => {
    if (!clientId) return;
    const content = noteContent.trim();
    if (!content) return;

    const creator = getCreatorLabel();

    try {
      setSavingNote(true);
      await notesApi.create({
        title: noteTitle.trim() || 'Medical note',
        content,
        type: 'client',
        clientId,
        priority: notePriority,
        tags: ['medical', 'advisor'],
        createdBy: creator,
        creator,
      });
      setNoteContent('');
      setNoteTitle('Medical note');
      setNotePriority('medium');

      const refreshedNotes = await notesApi.getByClient(clientId);
      const noteList = Array.isArray(refreshedNotes.data?.data) ? refreshedNotes.data.data : [];
      setNotes(noteList);
    } catch (submitError) {
      console.error('Error saving medical note:', submitError);
      setError('Unable to save note');
    } finally {
      setSavingNote(false);
    }
  };

  if (loading) {
    return (
      <div className="p-4 sm:p-6">
        <div className="rounded-2xl border border-gray-200 bg-white p-6 text-sm text-gray-600">
          Loading medical client view...
        </div>
      </div>
    );
  }

  if (!clientId) {
    return (
      <div className="p-4 sm:p-6">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700">
          Client ID is missing.
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6">
      <div className="mx-auto max-w-7xl space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-2 self-start rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <ArrowLeft className={iconClass} />
            Back
          </button>

          <div className="text-left sm:text-right">
            <h1 className="text-2xl font-semibold text-gray-900">
              Medical Client View
            </h1>
            <div className="text-sm text-gray-500">
              Client ID: {typeof client?.display_id === 'number' ? client.display_id : clientId}
            </div>
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {error}
          </div>
        )}

        <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
          <section className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  <UserRound className={iconClass} />
                  Client Overview
                </div>
                <h2 className="mt-2 text-2xl font-semibold text-gray-900">
                  {client ? `${client.firstName || ''} ${client.lastName || ''}`.trim() || 'Unnamed client' : 'Client not found'}
                </h2>
                <div className="mt-1 text-sm text-gray-500">
                  {client?.email ? `Email: ${client.email}` : 'Email not shown'}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-xl bg-gray-50 px-3 py-2">
                  <div className="text-[11px] uppercase tracking-wide text-gray-500">Bookings</div>
                  <div className="text-lg font-semibold text-gray-900">{bookings.length}</div>
                </div>
                <div className="rounded-xl bg-gray-50 px-3 py-2">
                  <div className="text-[11px] uppercase tracking-wide text-gray-500">Medical</div>
                  <div className="text-lg font-semibold text-gray-900">{medicalRecords.length}</div>
                </div>
                <div className="rounded-xl bg-gray-50 px-3 py-2">
                  <div className="text-[11px] uppercase tracking-wide text-gray-500">Notes</div>
                  <div className="text-lg font-semibold text-gray-900">{notes.length}</div>
                </div>
                <div className="rounded-xl bg-gray-50 px-3 py-2">
                  <div className="text-[11px] uppercase tracking-wide text-gray-500">Reviews</div>
                  <div className="text-lg font-semibold text-gray-900">{reviewRequests.length}</div>
                </div>
              </div>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                  <CalendarDays className={iconClass} />
                  Bookings
                </div>
                <div className="mt-3 space-y-3">
                  {bookings.length === 0 ? (
                    <div className="text-sm text-gray-500">No bookings found.</div>
                  ) : bookings.map((booking) => (
                    <div key={booking._id} className="rounded-lg border border-gray-200 bg-white p-3 text-sm">
                      <div className="font-semibold text-gray-900">
                        #{booking.bookingNumber || booking._id?.slice(-6)} - {getRetreatName(booking.retreatId as any)}
                      </div>
                      <div className="mt-1 text-gray-600">
                        Status: {booking.status || 'pending'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                  <ShieldAlert className={iconClass} />
                  Quick flags
                </div>
                <dl className="mt-3 space-y-3 text-sm">
                  <div>
                    <dt className="font-medium text-gray-700">Emergency contact</dt>
                    <dd className="text-gray-600">{renderValue(client?.emergencyContact || client?.emergencyContactPhone)}</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-gray-700">Allergies</dt>
                    <dd className="text-gray-600">{renderValue(client?.allergies || latestScreening?.allergies)}</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-gray-700">Current medications</dt>
                  <dd className="text-gray-600">{renderValue((client as any)?.currentMedications || latestScreening?.currentMedications)}</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-gray-700">Medical clearance</dt>
                    <dd className="text-gray-600">
                      {typeof latestMedical?.finalMedicalClearance === 'boolean'
                        ? (latestMedical.finalMedicalClearance ? 'Approved' : 'Not approved')
                        : 'Not set'}
                    </dd>
                  </div>
                </dl>
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <div className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-6">
              <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-gray-500">
                <FileText className={iconClass} />
                Latest Medical Records
              </div>

              <div className="mt-4 space-y-4">
                {medicalRecords.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-500">
                    No EKG or liver records yet.
                  </div>
                ) : medicalRecords.map((record) => (
                  <div key={record._id} className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="text-sm font-semibold text-gray-900">
                          {getRetreatName(record.retreatId as any)}
                        </div>
                        <div className="text-xs text-gray-500">
                          Updated {formatDateTime(record.updatedAt || record.createdAt)}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {record.ekgFileName && (
                          <button
                            type="button"
                            onClick={() => openMedicalFile(record._id, 'ekg')}
                            className="rounded-full bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
                          >
                            View EKG
                          </button>
                        )}
                        {record.liverPanelFileName && (
                          <button
                            type="button"
                            onClick={() => openMedicalFile(record._id, 'liver-panel')}
                            className="rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700"
                          >
                            View Liver
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      <div className="rounded-lg bg-white p-3">
                        <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">EKG</div>
                        <div className="mt-1 text-sm text-gray-900">{record.ekgStatus || 'pending'}</div>
                        <div className="text-xs text-gray-500">{record.ekgFileName || 'No file uploaded'}</div>
                        {record.ekgAdvisorNotes && <div className="mt-2 text-sm text-gray-600">{record.ekgAdvisorNotes}</div>}
                      </div>
                      <div className="rounded-lg bg-white p-3">
                        <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Liver</div>
                        <div className="mt-1 text-sm text-gray-900">{record.liverPanelStatus || 'pending'}</div>
                        <div className="text-xs text-gray-500">{record.liverPanelFileName || 'No file uploaded'}</div>
                        {record.liverPanelAdvisorNotes && <div className="mt-2 text-sm text-gray-600">{record.liverPanelAdvisorNotes}</div>}
                      </div>
                    </div>

                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      <div className="rounded-lg bg-white p-3">
                        <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Questionnaire</div>
                        <div className="mt-2 space-y-2 text-sm text-gray-700">
                          <div><span className="font-medium">Why:</span> {renderValue(latestScreening?.whySeekingIboga)}</div>
                          <div><span className="font-medium">Change:</span> {renderValue(latestScreening?.whatToChange)}</div>
                          <div><span className="font-medium">Plant medicines:</span> {renderValue(latestScreening?.previousPlantMedicines)}</div>
                          <div><span className="font-medium">Spiritual background:</span> {renderValue(latestScreening?.spiritualBackground)}</div>
                          <div><span className="font-medium">Trauma:</span> {renderValue(latestScreening?.traumaHistory)}</div>
                          <div><span className="font-medium">Mental health:</span> {renderValue(latestScreening?.mentalHealthHistory)}</div>
                        </div>
                      </div>
                      <div className="rounded-lg bg-white p-3">
                        <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Medications intake</div>
                        <div className="mt-2 text-sm text-gray-700">
                          {currentMedications.length > 0 ? (
                            <ul className="list-disc space-y-1 pl-5">
                              {currentMedications.map((med: any, index: number) => (
                                <li key={`${med.name || 'med'}-${index}`}>
                                  {med.name || 'Medication'} {med.mgDaily ? `- ${med.mgDaily}` : ''}
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <div>No structured medications listed.</div>
                          )}
                        </div>
                        <div className="mt-3 text-sm text-gray-700">
                          <span className="font-medium">Supplements:</span> {renderValue(supplementFlags)}
                        </div>
                        <div className="mt-3 text-sm text-gray-700">
                          <span className="font-medium">Alcohol:</span> {renderValue(latestScreening?.alcoholConsumption)}
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 rounded-lg bg-white p-3 text-sm text-gray-700">
                      <div className="font-medium text-gray-900">Screening notes</div>
                      <div className="mt-2 whitespace-pre-wrap">{renderValue(latestScreening?.notes || latestScreening?.observations || latestScreening?.medicalIssues)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-6">
              <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-gray-500">
                <ScanSearch className={iconClass} />
                Review Requests
              </div>

              <div className="mt-4 space-y-3">
                {reviewRequests.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-500">
                    No review requests yet.
                  </div>
                ) : reviewRequests.map((request) => (
                  <div key={request._id} className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-semibold text-gray-900">
                        #{request.display_id || request._id?.slice(-6)} - {request.requestType}
                      </div>
                      <div className="rounded-full bg-white px-2 py-1 text-xs font-medium text-gray-700">
                        {request.status}
                      </div>
                    </div>
                    <div className="mt-1 text-gray-600">
                      Requested {formatDateTime(request.requestedAt)}
                    </div>
                    {request.reviewNotes && (
                      <div className="mt-2 whitespace-pre-wrap text-gray-700">{request.reviewNotes}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>

        <section className="grid gap-4 xl:grid-cols-[1fr_1.2fr]">
          <div className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-6">
            <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-gray-500">
              <NotebookText className={iconClass} />
              Note History
            </div>

            <div className="mt-4 space-y-3">
              {notes.length === 0 ? (
                <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-500">
                  No notes yet.
                </div>
              ) : notes.map((note) => (
                <div key={note._id} className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-semibold text-gray-900">{note.title}</div>
                    <div className="text-xs text-gray-500">
                      {formatDateTime(note.createdAt)}
                    </div>
                  </div>
                  <div className="mt-2 whitespace-pre-wrap text-gray-700">{note.content}</div>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs text-gray-500">
                    <span>Priority: {note.priority || 'medium'}</span>
                    <span>Creator: {note.creator || note.createdBy || 'Unknown'}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-6">
            <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-gray-500">
              <MessageSquarePlus className={iconClass} />
              Add Note
            </div>

            <div className="mt-4 grid gap-3">
              <label className="grid gap-1 text-sm">
                <span className="font-medium text-gray-700">Title</span>
                <input
                  value={noteTitle}
                  onChange={(e) => setNoteTitle(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                  placeholder="Medical note"
                />
              </label>

              <label className="grid gap-1 text-sm">
                <span className="font-medium text-gray-700">Content</span>
                <textarea
                  value={noteContent}
                  onChange={(e) => setNoteContent(e.target.value)}
                  rows={8}
                  className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                  placeholder="Add observation, caution, follow-up, or instruction..."
                />
              </label>

              <label className="grid gap-1 text-sm sm:max-w-xs">
                <span className="font-medium text-gray-700">Priority</span>
                <select
                  value={notePriority}
                  onChange={(e) => setNotePriority(e.target.value as typeof notePriority)}
                  className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </label>

              <button
                type="button"
                onClick={handleAddNote}
                disabled={savingNote || !noteContent.trim()}
                className="inline-flex items-center justify-center rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-indigo-300 sm:w-fit"
              >
                Save Note
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default MedicalClientView;
