import React, { useEffect, useMemo, useState } from 'react';
import { bookingsApi, ceremoniesApi, fileUploadsApi } from '../services/api';
import { Ceremony, CeremonyParticipant, FileUpload, RetreatClient } from '../types';
import { Button, Card, Col, Form, Input, InputNumber, Modal, Row, Select, Statistic, TimePicker, message } from 'antd';
import { Activity, ArrowLeft, Clock3, FileText, HeartPulse, Plus, Trash2 } from 'lucide-react';
import moment from 'moment';

interface ParticipantTrackerProps {
  ceremonyId: string;
  onBack?: () => void;
}

type CeremonyEvent = NonNullable<CeremonyParticipant['eventLog']>[number];
type EventType = CeremonyEvent['eventType'];
type PreCeremonyCheck = NonNullable<CeremonyParticipant['preCeremonyChecks']>[number];
type PostCeremonyCheck = NonNullable<CeremonyParticipant['postCeremonyChecks']>[number];
type MedicalCheckPhase = 'pre' | 'post';

const eventTypeLabels: Record<EventType, string> = {
  medicine: 'Medicine',
  purge: 'Purge',
  launch: 'Launch',
  abnormality: 'Abnormality',
  note: 'Note',
  arrival: 'Arrival',
  departure: 'Departure',
};

const eventTypeStyles: Record<EventType, string> = {
  medicine: 'border-blue-200 bg-blue-50 text-blue-900',
  purge: 'border-purple-200 bg-purple-50 text-purple-900',
  launch: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  abnormality: 'border-red-200 bg-red-50 text-red-900',
  note: 'border-gray-200 bg-gray-50 text-gray-900',
  arrival: 'border-cyan-200 bg-cyan-50 text-cyan-900',
  departure: 'border-slate-200 bg-slate-50 text-slate-900',
};

const Icon: React.FC<{ icon: any; className?: string }> = ({ icon: IconComponent, className }) => <IconComponent className={className} />;

const getObjectId = (value: any): string => {
  if (!value) return '';
  if (typeof value === 'string') return value;
  return value._id || value.id || '';
};

const getClientName = (participant: CeremonyParticipant) => {
  const client = participant.clientId as any;
  if (!client || typeof client === 'string') return `Client ${getObjectId(client).slice(-6) || 'unknown'}`;
  const name = [client.firstName || client.fname, client.lastName || client.lname].filter(Boolean).join(' ');
  return name || client.email || `Client ${getObjectId(client).slice(-6)}`;
};

const getEventSummary = (event: CeremonyEvent) => {
  if (event.eventType === 'medicine') {
    const form = event.medicineForm || 'spoon';
    const unit = form === 'spoon' ? `spoon${event.spoonCount === 1 ? '' : 's'}` : form;
    const parts = [
      event.spoonCount ? `${event.spoonCount} ${unit}` : form,
      form === 'spoon' ? event.spoonAmount : '',
      event.doseAmount,
    ].filter(Boolean);
    return parts.join(' - ') || 'Medicine';
  }
  if (event.eventType === 'purge') return event.note || 'Purged';
  if (event.eventType === 'launch') return event.note || 'Launched';
  if (event.eventType === 'abnormality') return [event.severity, event.note].filter(Boolean).join(' - ') || 'Abnormality';
  return event.note || eventTypeLabels[event.eventType];
};

const sortEvents = (events: CeremonyEvent[] = []) => (
  [...events].sort((a, b) => String(a.time || '').localeCompare(String(b.time || '')))
);

const buildParticipantUpdate = (participant: CeremonyParticipant, eventLog: CeremonyEvent[]) => {
  const sorted = sortEvents(eventLog);
  const medicineEvents = sorted.filter((event) => event.eventType === 'medicine');
  const purgeEvents = sorted.filter((event) => event.eventType === 'purge');
  const arrivalEvent = sorted.find((event) => event.eventType === 'arrival');
  const departureEvent = [...sorted].reverse().find((event) => event.eventType === 'departure');
  const spoonTotal = medicineEvents.reduce((sum, event) => sum + Number(event.spoonCount || 0), 0);
  const firstMedicine = medicineEvents[0];
  const firstPurge = purgeEvents[0];

  return {
    eventLog: sorted,
    participated: sorted.length > 0 || participant.participated,
    arrivalTime: arrivalEvent?.time || participant.arrivalTime,
    departureTime: departureEvent?.time || participant.departureTime,
    spoonsTaken: spoonTotal,
    firstSpoonTime: firstMedicine?.time || '',
    purged: purgeEvents.length > 0,
    purgeTime: firstPurge?.time || '',
    purgeDetails: purgeEvents.map((event) => [event.time, event.note].filter(Boolean).join(' - ')).join('\n'),
  };
};

const getParticipantKey = (participant: CeremonyParticipant) => (
  participant._id || getObjectId(participant.clientId)
);

const getPreCeremonyChecks = (participant: CeremonyParticipant): PreCeremonyCheck[] => {
  if (participant.preCeremonyChecks?.length) return participant.preCeremonyChecks;
  if (!participant.preCeremonyEkg && !participant.preCeremonyBloodPressure && !participant.medicalClearanceNotes && (!participant.medicalClearance || participant.medicalClearance === 'pending')) {
    return [];
  }

  return [{
    id: 'legacy',
    recordedAt: participant.preCeremonyBloodPressure?.recordedAt || participant.preCeremonyEkg?.uploadedAt,
    preCeremonyEkg: participant.preCeremonyEkg,
    preCeremonyBloodPressure: participant.preCeremonyBloodPressure,
    medicalClearance: participant.medicalClearance,
    medicalClearanceNotes: participant.medicalClearanceNotes,
  }];
};

const getLatestPreCeremonyCheck = (participant: CeremonyParticipant) => {
  const checks = getPreCeremonyChecks(participant);
  return checks.length ? checks[checks.length - 1] : undefined;
};

const getPostCeremonyChecks = (participant: CeremonyParticipant): PostCeremonyCheck[] => {
  if (participant.postCeremonyChecks?.length) return participant.postCeremonyChecks;
  if (!participant.postCeremonyEkg) return [];

  return [{
    id: 'legacy-post',
    recordedAt: participant.postCeremonyEkg.uploadedAt,
    postCeremonyEkg: participant.postCeremonyEkg,
  }];
};

const getApprovalLabel = (value?: boolean) => {
  if (value === true) return 'Approved';
  if (value === false) return 'Not approved';
  return 'Pending';
};

const getBloodPressureLabel = (check?: PreCeremonyCheck) => {
  const bp = check?.preCeremonyBloodPressure;
  if (!bp?.systolic && !bp?.diastolic) return 'BP not recorded';
  return `BP ${[bp.systolic, bp.diastolic].filter(Boolean).join('/')}${bp.pulse ? ` P${bp.pulse}` : ''}`;
};

const getPreCeremonyReadinessLabel = (check?: PreCeremonyCheck) => {
  const hasEkg = Boolean(check?.preCeremonyEkg?.fileUrl || check?.preCeremonyEkg?.fileName || check?.preCeremonyEkg?.approved !== undefined);
  const hasBp = Boolean(check?.preCeremonyBloodPressure?.systolic || check?.preCeremonyBloodPressure?.diastolic);
  if (hasEkg && hasBp) return 'Pre-ceremony EKG and BP recorded';
  if (!hasEkg && !hasBp) return 'Missing pre-ceremony EKG and BP';
  return `Missing pre-ceremony ${hasEkg ? 'BP' : 'EKG'}`;
};

const getCheckTimeLabel = (check: PreCeremonyCheck) => {
  const time = check.recordedAt || check.preCeremonyBloodPressure?.recordedAt || check.preCeremonyEkg?.uploadedAt;
  return time ? moment(time).format('MMM D, HH:mm') : 'No time';
};

const getMedicineValue = (event: CeremonyEvent) => {
  if (event.doseAmount) return event.doseAmount;
  if (event.spoonCount !== undefined && event.spoonCount !== null) return String(event.spoonCount);
  return event.spoonAmount || 'Dose';
};

const getFileHashFromUrl = (fileUrl?: string) => {
  if (!fileUrl) return '';
  const match = fileUrl.match(/\/file-uploads\/view\/([^/?#]+)/);
  return match?.[1] || '';
};

const isImageFile = (fileName?: string) => /\.(jpe?g|png|gif|webp)$/i.test(fileName || '');
const isPdfFile = (fileName?: string) => /\.pdf$/i.test(fileName || '');

const participantFromBooking = (ceremony: Ceremony, booking: RetreatClient): CeremonyParticipant | null => {
  const clientId = getObjectId(booking.clientId);
  const retreatId = getObjectId(booking.retreatId);
  if (!clientId || !retreatId || booking.status === 'cancelled') return null;

  return {
    _id: `pending-${clientId}`,
    ceremonyId: ceremony._id || '',
    clientId: booking.clientId as any,
    retreatId,
    medicalClearance: 'pending',
    participated: false,
    spoonsTaken: 0,
    purged: false,
    eventLog: [],
  };
};

const mergeParticipantsWithBookings = (
  ceremony: Ceremony,
  ceremonyParticipants: CeremonyParticipant[],
  bookings: RetreatClient[],
): CeremonyParticipant[] => {
  const participantsByClientId = new Map<string, CeremonyParticipant>();

  ceremonyParticipants.forEach((participant) => {
    const clientId = getObjectId(participant.clientId);
    if (clientId) participantsByClientId.set(clientId, participant);
  });

  bookings.forEach((booking) => {
    const clientId = getObjectId(booking.clientId);
    if (!clientId || participantsByClientId.has(clientId)) return;

    const participant = participantFromBooking(ceremony, booking);
    if (participant) participantsByClientId.set(clientId, participant);
  });

  return Array.from(participantsByClientId.values());
};

const ParticipantTracker: React.FC<ParticipantTrackerProps> = ({ ceremonyId, onBack }) => {
  const [ceremony, setCeremony] = useState<Ceremony | null>(null);
  const [participants, setParticipants] = useState<CeremonyParticipant[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedParticipant, setSelectedParticipant] = useState<CeremonyParticipant | null>(null);
  const [medicalParticipant, setMedicalParticipant] = useState<CeremonyParticipant | null>(null);
  const [editingMedicalCheckId, setEditingMedicalCheckId] = useState<string>('');
  const [medicalCheckPhase, setMedicalCheckPhase] = useState<MedicalCheckPhase>('pre');
  const [ekgUploadFile, setEkgUploadFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [previewFileName, setPreviewFileName] = useState<string>('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [addingRow, setAddingRow] = useState(false);
  const [trackerView, setTrackerView] = useState<'spoons' | 'pre' | 'post'>('spoons');
  const [rowTime, setRowTime] = useState(moment().format('HH:mm'));
  const [rowInputs, setRowInputs] = useState<Record<string, string>>({});
  const [form] = Form.useForm();
  const [medicalForm] = Form.useForm();

  useEffect(() => {
    loadData();
  }, [ceremonyId]);

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [ceremonyResponse, participantsResponse] = await Promise.all([
        ceremoniesApi.getOne(ceremonyId),
        ceremoniesApi.getParticipants(ceremonyId),
      ]);
      let nextParticipants = participantsResponse.data || [];

      const retreatId = getObjectId(ceremonyResponse.data.retreatId);
      if (retreatId) {
        const bookingsResponse = await bookingsApi.getByRetreatWithDetails(retreatId);
        nextParticipants = mergeParticipantsWithBookings(
          ceremonyResponse.data,
          nextParticipants,
          (bookingsResponse.data || []) as RetreatClient[],
        );
      }

      setCeremony(ceremonyResponse.data);
      setParticipants(nextParticipants);
    } catch (error) {
      message.error('Failed to load ceremony tracking data');
      console.error('Error loading ceremony tracker:', error);
    } finally {
      setLoading(false);
    }
  };

  const timeRows = useMemo(() => {
    const times = new Set<string>();
    participants.forEach((participant) => {
      (participant.eventLog || []).forEach((event) => {
        if (event.time) times.add(event.time);
      });
    });
    return Array.from(times).sort();
  }, [participants]);

  const stats = useMemo(() => {
    const total = participants.length;
    const tookMedicine = participants.filter((participant) => (participant.spoonsTaken || 0) > 0).length;
    const purged = participants.filter((participant) => participant.purged).length;
    const abnormalities = participants.reduce((count, participant) => (
      count + (participant.eventLog || []).filter((event) => event.eventType === 'abnormality').length
    ), 0);
    const totalSpoons = participants.reduce((sum, participant) => sum + Number(participant.spoonsTaken || 0), 0);
    return { total, tookMedicine, purged, abnormalities, totalSpoons };
  }, [participants]);

  const openEventModal = (participant: CeremonyParticipant, event?: CeremonyEvent) => {
    setSelectedParticipant(participant);
    setEditingEventId(event?.id || '');
    form.setFieldsValue({
      time: event?.time ? moment(event.time, 'HH:mm') : moment(),
      eventType: event?.eventType || 'medicine',
      spoonCount: event?.spoonCount || 1,
      spoonAmount: event?.spoonAmount || 'full',
      medicineForm: event?.medicineForm || 'spoon',
      doseAmount: event?.doseAmount || '',
      severity: event?.severity || 'medium',
      note: event?.note || '',
    });
    setModalOpen(true);
  };

  const openMedicalModal = (participant: CeremonyParticipant, check?: PreCeremonyCheck | PostCeremonyCheck, phase: MedicalCheckPhase = 'pre') => {
    const selectedCheck = check;
    const ekg = phase === 'pre'
      ? (selectedCheck as PreCeremonyCheck | undefined)?.preCeremonyEkg
      : (selectedCheck as PostCeremonyCheck | undefined)?.postCeremonyEkg;
    setMedicalParticipant(participant);
    setEditingMedicalCheckId(selectedCheck?.id || '');
    setMedicalCheckPhase(phase);
    setEkgUploadFile(null);
    medicalForm.setFieldsValue({
      ekgApproved: ekg?.approved === undefined ? 'pending' : ekg.approved ? 'approved' : 'rejected',
      ekgNotes: ekg?.notes || '',
      systolic: phase === 'pre' ? (selectedCheck as PreCeremonyCheck | undefined)?.preCeremonyBloodPressure?.systolic : undefined,
      diastolic: phase === 'pre' ? (selectedCheck as PreCeremonyCheck | undefined)?.preCeremonyBloodPressure?.diastolic : undefined,
      pulse: phase === 'pre' ? (selectedCheck as PreCeremonyCheck | undefined)?.preCeremonyBloodPressure?.pulse : undefined,
      bpApproved: phase === 'pre' && (selectedCheck as PreCeremonyCheck | undefined)?.preCeremonyBloodPressure?.approved !== undefined
        ? ((selectedCheck as PreCeremonyCheck).preCeremonyBloodPressure?.approved ? 'approved' : 'rejected')
        : 'pending',
      bpNotes: phase === 'pre' ? (selectedCheck as PreCeremonyCheck | undefined)?.preCeremonyBloodPressure?.notes || '' : '',
      medicalClearance: phase === 'pre' ? (selectedCheck as PreCeremonyCheck | undefined)?.medicalClearance || 'pending' : 'pending',
      medicalClearanceNotes: phase === 'pre'
        ? (selectedCheck as PreCeremonyCheck | undefined)?.medicalClearanceNotes || ''
        : (selectedCheck as PostCeremonyCheck | undefined)?.notes || '',
    });
  };

  const ensureSavedParticipant = async (participant: CeremonyParticipant) => {
    if (!ceremony) throw new Error('Ceremony is not loaded');
    if (participant._id && !participant._id.startsWith('pending-')) return participant;

    const createdParticipant = await ceremoniesApi.addParticipant({
      ceremonyId: ceremony._id!,
      clientId: getObjectId(participant.clientId),
      retreatId: getObjectId(participant.retreatId),
      medicalClearance: participant.medicalClearance || 'pending',
      participated: false,
      spoonsTaken: 0,
      purged: false,
      eventLog: [],
    });
    return createdParticipant.data;
  };

  const startRowAdd = () => {
    setRowTime(moment().format('HH:mm'));
    setRowInputs({});
    setAddingRow(true);
  };

  const cancelRowAdd = () => {
    setAddingRow(false);
    setRowInputs({});
  };

  const saveRow = async () => {
    const filledEntries = participants
      .map((participant) => ({
        participant,
        value: (rowInputs[getParticipantKey(participant)] || '').trim(),
      }))
      .filter(({ value }) => value.length > 0);

    if (filledEntries.length === 0) {
      message.warning('Enter a spoon amount or note for at least one client');
      return;
    }

    try {
      setSaving(true);
      const time = rowTime || moment().format('HH:mm');

      for (const { participant, value } of filledEntries) {
        const participantToUpdate = await ensureSavedParticipant(participant);
        const spoonMatch = value.match(/(\d+(?:\.\d+)?)/);
        const spoonCount = spoonMatch ? Number(spoonMatch[1]) : 1;
        const nextEvent: CeremonyEvent = {
          id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
          time,
          eventType: 'medicine',
          spoonCount,
          medicineForm: 'spoon',
          spoonAmount: value.toLowerCase().includes('half') ? 'half' : value.toLowerCase().includes('quarter') ? 'quarter' : 'full',
          doseAmount: value,
          note: value,
          recordedAt: new Date().toISOString(),
        };
        const eventLog = [...(participantToUpdate.eventLog || []), nextEvent];
        await ceremoniesApi.updateParticipant(participantToUpdate._id!, buildParticipantUpdate(participantToUpdate, eventLog));
      }

      message.success('Ceremony row saved');
      setAddingRow(false);
      setRowInputs({});
      await loadData();
    } catch (error) {
      message.error('Failed to save ceremony row');
      console.error('Error saving ceremony row:', error);
    } finally {
      setSaving(false);
    }
  };

  const saveEvent = async (values: any) => {
    if (!selectedParticipant?._id || !ceremony) return;
    const eventLog = [...(selectedParticipant.eventLog || [])];
    const nextEvent: CeremonyEvent = {
      id: editingEventId || `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      time: values.time?.format('HH:mm') || moment().format('HH:mm'),
      eventType: values.eventType,
      spoonCount: values.eventType === 'medicine' ? Number(values.spoonCount || 0) : undefined,
      spoonAmount: values.eventType === 'medicine' ? values.spoonAmount : undefined,
      medicineForm: values.eventType === 'medicine' ? values.medicineForm : undefined,
      doseAmount: values.eventType === 'medicine' ? values.doseAmount : undefined,
      severity: values.eventType === 'abnormality' ? values.severity : undefined,
      note: values.note || '',
      recordedAt: new Date().toISOString(),
    };

    const existingIndex = eventLog.findIndex((event) => event.id === nextEvent.id);
    if (existingIndex >= 0) {
      eventLog[existingIndex] = nextEvent;
    } else {
      eventLog.push(nextEvent);
    }

    try {
      setSaving(true);
      const participantToUpdate = await ensureSavedParticipant(selectedParticipant);
      await ceremoniesApi.updateParticipant(participantToUpdate._id!, buildParticipantUpdate(participantToUpdate, eventLog));
      message.success('Ceremony event saved');
      setModalOpen(false);
      await loadData();
    } catch (error) {
      message.error('Failed to save ceremony event');
      console.error('Error saving ceremony event:', error);
    } finally {
      setSaving(false);
    }
  };

  const saveMedicalCheck = async (values: any) => {
    if (!medicalParticipant || !ceremony) return;

    try {
      setSaving(true);
      const participantToUpdate = await ensureSavedParticipant(medicalParticipant);
      const existingChecks: Array<PreCeremonyCheck | PostCeremonyCheck> = medicalCheckPhase === 'pre'
        ? getPreCeremonyChecks(participantToUpdate)
        : getPostCeremonyChecks(participantToUpdate);
      const existingCheck = editingMedicalCheckId
        ? existingChecks.find((check) => check.id === editingMedicalCheckId)
        : undefined;
      const existingPreCheck = existingCheck as PreCeremonyCheck | undefined;

      let uploadedEkg = medicalCheckPhase === 'pre'
        ? (existingCheck as PreCeremonyCheck | undefined)?.preCeremonyEkg
        : (existingCheck as PostCeremonyCheck | undefined)?.postCeremonyEkg;
      if (ekgUploadFile) {
        const formData = new FormData();
        formData.append('file', ekgUploadFile);
        formData.append('documentKind', 'client_medical');
        formData.append('foreignKey', participantToUpdate._id!);
        formData.append('description', `${medicalCheckPhase === 'pre' ? 'Pre' : 'Post'}-ceremony EKG for ${getClientName(participantToUpdate)}`);
        const uploadResponse = await fileUploadsApi.upload(formData);
        uploadedEkg = {
          ...uploadedEkg,
          fileUrl: `/file-uploads/view/${uploadResponse.data.fileHash}`,
          fileName: uploadResponse.data.originalFileName,
          uploadedAt: uploadResponse.data.uploadedAt || new Date().toISOString(),
        };
      }

      const nextCheckId = editingMedicalCheckId || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const nextPreCheck: PreCeremonyCheck = {
        id: nextCheckId,
        recordedAt: existingCheck?.recordedAt || new Date().toISOString(),
        preCeremonyEkg: {
          ...uploadedEkg,
          approved: values.ekgApproved === 'pending' ? undefined : values.ekgApproved === 'approved',
          notes: values.ekgNotes || '',
          reviewedAt: values.ekgApproved && values.ekgApproved !== 'pending' ? new Date().toISOString() : uploadedEkg?.reviewedAt,
        },
        preCeremonyBloodPressure: {
          systolic: values.systolic ? Number(values.systolic) : undefined,
          diastolic: values.diastolic ? Number(values.diastolic) : undefined,
          pulse: values.pulse ? Number(values.pulse) : undefined,
          approved: values.bpApproved === 'pending' ? undefined : values.bpApproved === 'approved',
          notes: values.bpNotes || '',
          recordedAt: existingPreCheck?.preCeremonyBloodPressure?.recordedAt || new Date().toISOString(),
        },
        medicalClearance: values.medicalClearance || 'pending',
        medicalClearanceNotes: values.medicalClearanceNotes || '',
      };
      const nextPostCheck: PostCeremonyCheck = {
        id: nextCheckId,
        recordedAt: existingCheck?.recordedAt || new Date().toISOString(),
        postCeremonyEkg: {
          ...uploadedEkg,
          approved: values.ekgApproved === 'pending' ? undefined : values.ekgApproved === 'approved',
          notes: values.ekgNotes || '',
          reviewedAt: values.ekgApproved && values.ekgApproved !== 'pending' ? new Date().toISOString() : uploadedEkg?.reviewedAt,
        },
        notes: values.medicalClearanceNotes || '',
      };

      const nextChecks = editingMedicalCheckId
        ? existingChecks.map((check) => check.id === editingMedicalCheckId ? (medicalCheckPhase === 'pre' ? nextPreCheck : nextPostCheck) : check)
        : [...existingChecks, medicalCheckPhase === 'pre' ? nextPreCheck : nextPostCheck];

      const payload = medicalCheckPhase === 'pre'
        ? {
            preCeremonyChecks: nextChecks,
            preCeremonyEkg: nextPreCheck.preCeremonyEkg,
            preCeremonyBloodPressure: nextPreCheck.preCeremonyBloodPressure,
            medicalClearance: nextPreCheck.medicalClearance,
            medicalClearanceNotes: nextPreCheck.medicalClearanceNotes,
          }
        : {
            postCeremonyChecks: nextChecks,
            postCeremonyEkg: nextPostCheck.postCeremonyEkg,
          };

      await ceremoniesApi.updateMedicalCheck(participantToUpdate._id!, payload);
      message.success(`${medicalCheckPhase === 'pre' ? 'Pre' : 'Post'}-ceremony medical check saved`);
      setMedicalParticipant(null);
      setEditingMedicalCheckId('');
      setEkgUploadFile(null);
      await loadData();
    } catch (error) {
      message.error(`Failed to save ${medicalCheckPhase === 'pre' ? 'pre' : 'post'}-ceremony medical check`);
      console.error('Error saving ceremony medical check:', error);
    } finally {
      setSaving(false);
    }
  };

  const deleteMedicalCheck = async (participant: CeremonyParticipant, checkId?: string, phase: MedicalCheckPhase = 'pre') => {
    if (!checkId || !window.confirm(`Delete this ${phase === 'pre' ? 'pre' : 'post'}-ceremony check?`)) return;

    try {
      const participantToUpdate = await ensureSavedParticipant(participant);
      const existingChecks: Array<PreCeremonyCheck | PostCeremonyCheck> = phase === 'pre'
        ? getPreCeremonyChecks(participantToUpdate)
        : getPostCeremonyChecks(participantToUpdate);
      const nextChecks = existingChecks.filter((check) => check.id !== checkId);
      const latestCheck = nextChecks[nextChecks.length - 1];

      await ceremoniesApi.updateMedicalCheck(participantToUpdate._id!, phase === 'pre'
        ? {
            preCeremonyChecks: nextChecks,
            preCeremonyEkg: (latestCheck as PreCeremonyCheck | undefined)?.preCeremonyEkg,
            preCeremonyBloodPressure: (latestCheck as PreCeremonyCheck | undefined)?.preCeremonyBloodPressure,
            medicalClearance: (latestCheck as PreCeremonyCheck | undefined)?.medicalClearance || 'pending',
            medicalClearanceNotes: (latestCheck as PreCeremonyCheck | undefined)?.medicalClearanceNotes || '',
          }
        : {
            postCeremonyChecks: nextChecks,
            postCeremonyEkg: (latestCheck as PostCeremonyCheck | undefined)?.postCeremonyEkg,
          });

      message.success(`${phase === 'pre' ? 'Pre' : 'Post'}-ceremony check deleted`);
      await loadData();
    } catch (error) {
      message.error(`Failed to delete ${phase === 'pre' ? 'pre' : 'post'}-ceremony check`);
      console.error('Error deleting ceremony check:', error);
    }
  };

  const openFilePreview = async (participant: CeremonyParticipant, fileUrl?: string, fileName?: string) => {
    const savedFileHash = getFileHashFromUrl(fileUrl);
    if (!savedFileHash && !fileName) {
      message.error('Unable to preview this file');
      return;
    }

    try {
      setPreviewLoading(true);
      if (previewUrl) URL.revokeObjectURL(previewUrl);

      const participantUploadsResponse = await fileUploadsApi.getAll({
        documentKind: 'client_medical',
        foreignKey: getParticipantKey(participant),
        isActive: true,
      });
      let matchingUpload = participantUploadsResponse.data.find((upload: FileUpload) => (
        upload.originalFileName === fileName
        || upload.storedFileName === fileName
      ));

      if (!matchingUpload && fileName) {
        const medicalUploadsResponse = await fileUploadsApi.getAll({
          documentKind: 'client_medical',
          isActive: true,
        });
        matchingUpload = medicalUploadsResponse.data.find((upload: FileUpload) => (
          upload.originalFileName === fileName || upload.storedFileName === fileName
        ));
      }

      if (!matchingUpload?.fileHash) {
        message.error('This EKG file record is missing. Upload the EKG again to preview it.');
        return;
      }

      if (matchingUpload.fileHash === savedFileHash && matchingUpload.originalFileName !== fileName && matchingUpload.storedFileName !== fileName) {
        message.error('This EKG file record is missing. Upload the EKG again to preview it.');
        return;
      }

      const response = await fileUploadsApi.getViewBlob(matchingUpload.fileHash);
      setPreviewUrl(URL.createObjectURL(response.data as Blob));
      setPreviewFileName(matchingUpload.originalFileName || fileName || 'Pre-ceremony EKG');
    } catch (error) {
      message.error('Failed to load file preview');
      console.error('Error loading EKG preview:', error);
    } finally {
      setPreviewLoading(false);
    }
  };

  const closeFilePreview = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl('');
    setPreviewFileName('');
  };

  const deleteEvent = async (participant: CeremonyParticipant, eventId?: string) => {
    if (!participant._id || !eventId) return;
    const eventLog = (participant.eventLog || []).filter((event) => event.id !== eventId);
    try {
      await ceremoniesApi.updateParticipant(participant._id, buildParticipantUpdate(participant, eventLog));
      message.success('Ceremony event deleted');
      await loadData();
    } catch (error) {
      message.error('Failed to delete ceremony event');
      console.error('Error deleting ceremony event:', error);
    }
  };

  const eventsAtTime = (participant: CeremonyParticipant, time: string) => (
    sortEvents(participant.eventLog || []).filter((event) => event.time === time)
  );

  return (
    <div className="p-6">
      {onBack && (
        <button onClick={onBack} className="mb-4 inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
          <Icon icon={ArrowLeft} className="h-4 w-4" />
          Back to Ceremonies
        </button>
      )}

      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Track Spoons & Time</h1>
          <p className="text-sm text-gray-600">
            Ceremony #{ceremony?.ceremonyNumber || '-'} - spoon counts, timing, purges, launch, abnormalities, and notes by participant.
            {ceremony?.date ? ` ${moment(ceremony.date).format('MMMM DD, YYYY')}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {trackerView === 'spoons' && (
            <Button type="primary" icon={<Icon icon={Plus} className="h-4 w-4" />} onClick={startRowAdd} disabled={addingRow || participants.length === 0}>
              Add spoons
            </Button>
          )}
          <div className="inline-flex items-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700">
            <Icon icon={Clock3} className="h-4 w-4" />
            {moment().format('HH:mm')}
          </div>
        </div>
      </div>

      <Row gutter={16} className="mb-5">
        <Col xs={12} lg={4}><Card><Statistic title="Participants" value={stats.total} /></Card></Col>
        <Col xs={12} lg={5}><Card><Statistic title="Took Medicine" value={stats.tookMedicine} suffix={`/ ${stats.total}`} /></Card></Col>
        <Col xs={12} lg={5}><Card><Statistic title="Total Doses" value={stats.totalSpoons} /></Card></Col>
        <Col xs={12} lg={5}><Card><Statistic title="Purged" value={stats.purged} suffix={`/ ${stats.tookMedicine}`} /></Card></Col>
        <Col xs={12} lg={5}><Card><Statistic title="Abnormalities" value={stats.abnormalities} valueStyle={{ color: stats.abnormalities ? '#b91c1c' : '#166534' }} /></Card></Col>
      </Row>

      <div className="mb-4 flex flex-wrap gap-2">
        {[
          { key: 'spoons', label: 'Spoons & Time' },
          { key: 'pre', label: 'Pre-ceremony checks' },
          { key: 'post', label: 'Post-ceremony EKG' },
        ].map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setTrackerView(item.key as 'spoons' | 'pre' | 'post')}
            className={`rounded-md border px-3 py-2 text-sm font-medium ${trackerView === item.key ? 'border-indigo-200 bg-indigo-50 text-indigo-700' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'}`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="min-w-[1100px] w-full border-collapse">
          <thead>
            <tr className="bg-gray-50">
              <th className="sticky top-0 z-20 w-28 border-b border-r border-gray-200 bg-gray-50 px-3 py-3 text-left text-xs font-semibold uppercase text-gray-500 shadow-sm">Time</th>
              {participants.map((participant) => {
                const checks = getPreCeremonyChecks(participant);
                const latestCheck = getLatestPreCeremonyCheck(participant);
                const postChecks = getPostCeremonyChecks(participant);
                return (
                  <th key={participant._id} className="sticky top-0 z-20 min-w-[240px] border-b border-r border-gray-200 bg-gray-50 px-3 py-3 text-left align-top shadow-sm">
                    <div className="text-sm font-semibold text-gray-900">{getClientName(participant)}</div>
                    <div className="mt-1 text-xs text-gray-500">
                      {participant.spoonsTaken || 0} spoons
                      {participant.purged ? ` - purged ${participant.purgeTime || ''}` : ''}
                    </div>
                    {latestCheck && (
                      <div className="mt-2 rounded-md border border-gray-200 bg-white px-2 py-2 text-xs text-gray-700">
                        <div className="font-medium text-gray-900">Latest pre-ceremony</div>
                        <div className={getPreCeremonyReadinessLabel(latestCheck).includes('Missing') ? 'font-semibold text-amber-700' : 'font-semibold text-emerald-700'}>
                          {getPreCeremonyReadinessLabel(latestCheck)}
                        </div>
                        <div>{getBloodPressureLabel(latestCheck)}</div>
                        <div>EKG {getApprovalLabel(latestCheck.preCeremonyEkg?.approved)}{latestCheck.preCeremonyEkg?.fileName ? ` - ${latestCheck.preCeremonyEkg.fileName}` : ''}</div>
                        <div>Clearance {latestCheck.medicalClearance || 'pending'}</div>
                      </div>
                    )}
                    {!latestCheck && (
                      <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-2 py-2 text-xs font-semibold text-amber-800">
                        Missing pre-ceremony EKG and BP
                      </div>
                    )}
                    {trackerView === 'pre' && checks.length > 0 && (
                      <div className="mt-2 space-y-2">
                        {checks.map((check, index) => (
                          <div key={check.id || index} className="rounded-md border border-gray-200 bg-gray-50 px-2 py-2 text-xs text-gray-700">
                            <div className="flex items-start justify-between gap-2">
                              <div className="font-semibold text-gray-900">Check {index + 1}</div>
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => openMedicalModal(participant, check, 'pre')}
                                  className="rounded border border-gray-300 bg-white px-2 py-0.5 text-xs font-medium text-gray-700 hover:bg-gray-100"
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  onClick={() => deleteMedicalCheck(participant, check.id, 'pre')}
                                  className="rounded border border-red-200 bg-white px-2 py-0.5 text-xs font-medium text-red-600 hover:bg-red-50"
                                >
                                  Delete
                                </button>
                              </div>
                            </div>
                            <div className="mt-1">{getCheckTimeLabel(check)}</div>
                            <div className="mt-2 rounded-md border border-blue-100 bg-blue-50 px-2 py-2 text-blue-950">
                              <div className="flex items-center gap-2">
                                <Icon icon={FileText} className="h-4 w-4 text-blue-600" />
                                <span className="font-semibold">EKG</span>
                                <span className="rounded bg-white/80 px-1.5 py-0.5 text-[11px] text-blue-700">{getApprovalLabel(check.preCeremonyEkg?.approved)}</span>
                              </div>
                              {check.preCeremonyEkg?.fileUrl && (
                                <button
                                  type="button"
                                  onClick={() => openFilePreview(participant, check.preCeremonyEkg?.fileUrl, check.preCeremonyEkg?.fileName)}
                                  className="mt-1 block truncate font-medium text-blue-700 hover:text-blue-900"
                                  title={check.preCeremonyEkg.fileName || 'Preview EKG file'}
                                >
                                  {check.preCeremonyEkg.fileName || 'Preview EKG file'}
                                </button>
                              )}
                              {check.preCeremonyEkg?.notes && <div className="mt-1 whitespace-pre-wrap text-blue-900">Notes: {check.preCeremonyEkg.notes}</div>}
                            </div>
                            <div className="mt-2 rounded-md border border-rose-100 bg-rose-50 px-2 py-2 text-rose-950">
                              <div className="flex items-center gap-2">
                                <Icon icon={HeartPulse} className="h-4 w-4 text-rose-600" />
                                <span className="font-semibold">Blood pressure</span>
                                <span className="rounded bg-white/80 px-1.5 py-0.5 text-[11px] text-rose-700">{getApprovalLabel(check.preCeremonyBloodPressure?.approved)}</span>
                              </div>
                              <div className="mt-1 font-medium">{getBloodPressureLabel(check)}</div>
                              {check.preCeremonyBloodPressure?.notes && <div className="mt-1 whitespace-pre-wrap text-rose-900">Notes: {check.preCeremonyBloodPressure.notes}</div>}
                            </div>
                            <div className="mt-2 font-medium">Clearance {check.medicalClearance || 'pending'}</div>
                            {check.medicalClearanceNotes && <div className="whitespace-pre-wrap text-gray-600">Clearance: {check.medicalClearanceNotes}</div>}
                          </div>
                        ))}
                      </div>
                    )}
                    {trackerView === 'pre' && (
                      <Button size="small" type="link" className="mt-1 p-0" onClick={() => openMedicalModal(participant, undefined, 'pre')}>
                        <span className="inline-flex items-center gap-1">
                          <Icon icon={Activity} className="h-3.5 w-3.5" />
                          Add pre-ceremony
                        </span>
                      </Button>
                    )}
                    {trackerView === 'post' && <div className="mt-3 rounded-md border border-gray-200 bg-white px-2 py-2 text-xs text-gray-700">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <span className="font-semibold text-gray-900">Post-ceremony EKG</span>
                        <Button size="small" type="link" className="p-0" onClick={() => openMedicalModal(participant, undefined, 'post')}>
                          Add
                        </Button>
                      </div>
                      {postChecks.length === 0 ? (
                        <div className="text-gray-500">No post-ceremony EKG yet</div>
                      ) : (
                        <div className="space-y-2">
                          {postChecks.map((check, index) => (
                            <div key={check.id || index} className="rounded-md border border-gray-200 bg-gray-50 px-2 py-2">
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <div className="font-semibold text-gray-900">Post check {index + 1}</div>
                                  <div>{getCheckTimeLabel(check as any)}</div>
                                </div>
                                <div className="flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => openMedicalModal(participant, check, 'post')}
                                    className="rounded border border-gray-300 bg-white px-2 py-0.5 text-xs font-medium text-gray-700 hover:bg-gray-100"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => deleteMedicalCheck(participant, check.id, 'post')}
                                    className="rounded border border-red-200 bg-white px-2 py-0.5 text-xs font-medium text-red-600 hover:bg-red-50"
                                  >
                                    Delete
                                  </button>
                                </div>
                              </div>
                              <div className="mt-2 rounded-md border border-blue-100 bg-blue-50 px-2 py-2 text-blue-950">
                                <div className="flex items-center gap-2">
                                  <Icon icon={FileText} className="h-4 w-4 text-blue-600" />
                                  <span className="font-semibold">EKG</span>
                                  <span className="rounded bg-white/80 px-1.5 py-0.5 text-[11px] text-blue-700">{getApprovalLabel(check.postCeremonyEkg?.approved)}</span>
                                </div>
                                {check.postCeremonyEkg?.fileUrl && (
                                  <button
                                    type="button"
                                    onClick={() => openFilePreview(participant, check.postCeremonyEkg?.fileUrl, check.postCeremonyEkg?.fileName)}
                                    className="mt-1 block truncate font-medium text-blue-700 hover:text-blue-900"
                                    title={check.postCeremonyEkg.fileName || 'Preview post EKG file'}
                                  >
                                    {check.postCeremonyEkg.fileName || 'Preview post EKG file'}
                                  </button>
                                )}
                                {check.postCeremonyEkg?.notes && <div className="mt-1 whitespace-pre-wrap text-blue-900">Notes: {check.postCeremonyEkg.notes}</div>}
                              </div>
                              {check.notes && <div className="mt-1 whitespace-pre-wrap text-gray-600">Notes: {check.notes}</div>}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {trackerView === 'spoons' && addingRow && (
              <tr className="bg-blue-50">
                <td className="border-b border-r border-blue-200 bg-blue-50 px-3 py-3 align-top">
                  <input
                    type="time"
                    value={rowTime}
                    onChange={(event) => setRowTime(event.target.value)}
                    className="w-full rounded-md border border-gray-200 px-2 py-1 text-sm"
                  />
                  <div className="mt-2 flex gap-2">
                    <Button size="small" type="primary" onClick={saveRow} loading={saving}>Save</Button>
                    <Button size="small" onClick={cancelRowAdd} disabled={saving}>Cancel</Button>
                  </div>
                </td>
                {participants.map((participant) => {
                  const key = getParticipantKey(participant);
                  return (
                    <td key={`${key}-add`} className="border-b border-r border-blue-200 p-2 align-top">
                      <Input
                        value={rowInputs[key] || ''}
                        onChange={(event) => setRowInputs(prev => ({ ...prev, [key]: event.target.value }))}
                        placeholder="Spoons"
                      />
                    </td>
                  );
                })}
              </tr>
            )}
            {trackerView === 'spoons' && timeRows.map((time) => (
              <tr key={time} className="hover:bg-gray-50">
                <td className="border-b border-r border-gray-200 bg-white px-3 py-3 text-sm font-semibold text-gray-900">{time}</td>
                {participants.map((participant) => (
                  <td key={`${participant._id}-${time}`} className="border-b border-r border-gray-200 p-2 align-top">
                    <div className="space-y-2">
                      {eventsAtTime(participant, time).map((event) => (
                        <div key={event.id || `${event.time}-${event.eventType}`} className={`rounded-md border px-2 py-2 text-xs ${eventTypeStyles[event.eventType]}`}>
                          <div className="flex items-start justify-between gap-2">
                            {event.eventType === 'medicine' ? (
                              <div className="text-left text-lg font-bold leading-none text-gray-950">{getMedicineValue(event)}</div>
                            ) : (
                              <div className="text-left font-semibold">{eventTypeLabels[event.eventType]}</div>
                            )}
                            <div className="flex items-center gap-2">
                              <button type="button" onClick={() => openEventModal(participant, event)} className="rounded border border-current px-2 py-0.5 text-xs font-medium hover:bg-white/60">
                                Edit
                              </button>
                              <button type="button" onClick={() => deleteEvent(participant, event.id)} className="text-gray-500 hover:text-red-600" title="Delete event">
                                <Icon icon={Trash2} className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                          {event.eventType === 'medicine' ? (
                            event.note && event.note !== getMedicineValue(event) && <div className="mt-1 whitespace-pre-wrap">{event.note}</div>
                          ) : (
                            <div className="mt-1 whitespace-pre-wrap">{getEventSummary(event)}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  </td>
                ))}
              </tr>
            ))}
            {trackerView === 'spoons' && timeRows.length === 0 && (
              <tr>
                <td colSpan={participants.length + 1} className="px-4 py-8 text-center text-sm text-gray-500">
                  {loading ? 'Loading participants...' : 'No spoon rows recorded yet. Use Add spoons to create a row.'}
                </td>
              </tr>
            )}
            {trackerView !== 'spoons' && (
              <tr>
                <td colSpan={participants.length + 1} className="px-4 py-8 text-center text-sm text-gray-500">
                  Use the controls under each participant name above to manage {trackerView === 'pre' ? 'pre-ceremony EKG and blood pressure checks' : 'post-ceremony EKG checks'}.
                </td>
              </tr>
            )}
          </tbody>
          {participants.length > 0 && (
            <tfoot>
              <tr className="bg-gray-50">
                <td className="border-r border-gray-200 bg-gray-50 px-3 py-3 text-sm font-semibold text-gray-900">Totals</td>
                {participants.map((participant) => (
                  <td key={`${participant._id}-total`} className="border-r border-gray-200 px-3 py-3 text-sm text-gray-700">
                    <div>{participant.spoonsTaken || 0} spoons</div>
                    <div>{participant.purged ? `Purged ${participant.purgeTime || ''}` : 'No purge recorded'}</div>
                    {participant.purgeDetails && <div className="mt-1 whitespace-pre-wrap text-xs text-gray-500">{participant.purgeDetails}</div>}
                  </td>
                ))}
              </tr>
            </tfoot>
          )}
        </table>
        {participants.length === 0 && !loading && (
          <div className="px-4 py-8 text-center text-sm text-gray-500">No participants found for this ceremony.</div>
        )}
      </div>

      <Modal
        title={editingEventId ? 'Edit Spoon/Time Event' : 'Add Spoon/Time Event'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={saving}
        width={620}
      >
        <Form form={form} layout="vertical" onFinish={saveEvent}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="time" label="Time" rules={[{ required: true, message: 'Choose a time' }]}>
                <TimePicker format="HH:mm" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="eventType" label="Event Type" rules={[{ required: true, message: 'Choose a type' }]}>
                <Select>
                  {Object.entries(eventTypeLabels).map(([value, label]) => (
                    <Select.Option key={value} value={value}>{label}</Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item noStyle shouldUpdate={(prev, current) => prev.eventType !== current.eventType}>
            {({ getFieldValue }) => getFieldValue('eventType') === 'medicine' && (
              <Row gutter={16}>
                <Col span={8}>
                  <Form.Item name="spoonCount" label="Amount">
                    <InputNumber min={0} max={20} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="medicineForm" label="Form">
                    <Select>
                      <Select.Option value="spoon">Spoon</Select.Option>
                      <Select.Option value="capsules">Capsules</Select.Option>
                      <Select.Option value="tea">Tea</Select.Option>
                      <Select.Option value="other">Other</Select.Option>
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="doseAmount" label="Dose Note">
                    <Input placeholder="Optional" />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item noStyle shouldUpdate={(prev, current) => prev.medicineForm !== current.medicineForm}>
                    {({ getFieldValue }) => getFieldValue('medicineForm') === 'spoon' && (
                      <Form.Item name="spoonAmount" label="Spoon Amount">
                        <Select>
                          <Select.Option value="full">Full</Select.Option>
                          <Select.Option value="half">Half</Select.Option>
                          <Select.Option value="quarter">Quarter</Select.Option>
                          <Select.Option value="other">Other</Select.Option>
                        </Select>
                      </Form.Item>
                    )}
                  </Form.Item>
                </Col>
              </Row>
            )}
          </Form.Item>

          <Form.Item noStyle shouldUpdate={(prev, current) => prev.eventType !== current.eventType}>
            {({ getFieldValue }) => getFieldValue('eventType') === 'abnormality' && (
              <Form.Item name="severity" label="Severity">
                <Select>
                  <Select.Option value="low">Low</Select.Option>
                  <Select.Option value="medium">Medium</Select.Option>
                  <Select.Option value="high">High</Select.Option>
                  <Select.Option value="urgent">Urgent</Select.Option>
                </Select>
              </Form.Item>
            )}
          </Form.Item>

          <Form.Item name="note" label="Notes">
            <Input.TextArea rows={4} placeholder="Purge details, launch details, abnormalities, observations, or other notes" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={`${editingMedicalCheckId ? 'Edit' : 'Add'} ${medicalCheckPhase === 'pre' ? 'Pre' : 'Post'}-Ceremony Medical - ${medicalParticipant ? getClientName(medicalParticipant) : ''}`}
        open={Boolean(medicalParticipant)}
        onCancel={() => {
          setMedicalParticipant(null);
          setEditingMedicalCheckId('');
          setMedicalCheckPhase('pre');
          setEkgUploadFile(null);
        }}
        onOk={() => medicalForm.submit()}
        confirmLoading={saving}
        width={680}
      >
        <Form form={medicalForm} layout="vertical" onFinish={saveMedicalCheck}>
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item name="ekgApproved" label={`${medicalCheckPhase === 'pre' ? 'Pre' : 'Post'}-Ceremony EKG`}>
                <Select>
                  <Select.Option value="pending">Pending</Select.Option>
                  <Select.Option value="approved">Approved</Select.Option>
                  <Select.Option value="rejected">Not Approved</Select.Option>
                </Select>
              </Form.Item>
            </Col>
            {medicalCheckPhase === 'pre' && (
              <Col xs={24} md={12}>
                <Form.Item name="medicalClearance" label="Medical Clearance">
                  <Select>
                    <Select.Option value="pending">Pending</Select.Option>
                    <Select.Option value="approved">Approved</Select.Option>
                    <Select.Option value="conditional">Conditional</Select.Option>
                    <Select.Option value="not_approved">Not Approved</Select.Option>
                  </Select>
                </Form.Item>
              </Col>
            )}
          </Row>

          <Form.Item label="Upload EKG">
            {editingMedicalCheckId && medicalCheckPhase === 'pre' && getPreCeremonyChecks(medicalParticipant || {} as CeremonyParticipant).find((check) => check.id === editingMedicalCheckId)?.preCeremonyEkg?.fileName && (
              <div className="mb-2 text-xs text-gray-500">
                Current file: {getPreCeremonyChecks(medicalParticipant || {} as CeremonyParticipant).find((check) => check.id === editingMedicalCheckId)?.preCeremonyEkg?.fileName}
              </div>
            )}
            {editingMedicalCheckId && medicalCheckPhase === 'post' && getPostCeremonyChecks(medicalParticipant || {} as CeremonyParticipant).find((check) => check.id === editingMedicalCheckId)?.postCeremonyEkg?.fileName && (
              <div className="mb-2 text-xs text-gray-500">
                Current file: {getPostCeremonyChecks(medicalParticipant || {} as CeremonyParticipant).find((check) => check.id === editingMedicalCheckId)?.postCeremonyEkg?.fileName}
              </div>
            )}
            <input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,image/*,application/pdf"
              onChange={(event) => setEkgUploadFile(event.target.files?.[0] || null)}
              className="block w-full text-sm text-gray-700"
            />
            {ekgUploadFile && <div className="mt-1 text-xs text-gray-500">Selected: {ekgUploadFile.name}</div>}
          </Form.Item>

          <Form.Item name="ekgNotes" label="EKG Notes">
            <Input.TextArea rows={2} placeholder="EKG observations or medical advisor notes" />
          </Form.Item>

          {medicalCheckPhase === 'pre' && (
            <>
              <Row gutter={16}>
                <Col xs={12} md={8}>
                  <Form.Item name="systolic" label="Systolic">
                    <InputNumber min={60} max={250} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col xs={12} md={8}>
                  <Form.Item name="diastolic" label="Diastolic">
                    <InputNumber min={40} max={150} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col xs={12} md={8}>
                  <Form.Item name="pulse" label="Pulse">
                    <InputNumber min={30} max={220} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item name="bpApproved" label="Blood Pressure Status">
                <Select>
                  <Select.Option value="pending">Pending</Select.Option>
                  <Select.Option value="approved">Approved</Select.Option>
                  <Select.Option value="rejected">Not Approved</Select.Option>
                </Select>
              </Form.Item>

              <Form.Item name="bpNotes" label="Blood Pressure Notes">
                <Input.TextArea rows={2} placeholder="Blood pressure context, concerns, or recheck notes" />
              </Form.Item>
            </>
          )}

          <Form.Item name="medicalClearanceNotes" label={medicalCheckPhase === 'pre' ? 'Clearance Notes' : 'Post-Ceremony Notes'}>
            <Input.TextArea rows={3} placeholder={medicalCheckPhase === 'pre' ? 'Overall pre-ceremony medical clearance notes' : 'Post-ceremony EKG notes or follow-up instructions'} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={previewFileName || 'File preview'}
        open={Boolean(previewUrl) || previewLoading}
        onCancel={closeFilePreview}
        footer={previewUrl ? (
          <a href={previewUrl} download={previewFileName} className="text-sm font-medium text-blue-600 hover:text-blue-800">
            Download file
          </a>
        ) : null}
        width={900}
      >
        {previewLoading && <div className="py-10 text-center text-sm text-gray-500">Loading preview...</div>}
        {!previewLoading && previewUrl && isImageFile(previewFileName) && (
          <img src={previewUrl} alt={previewFileName} className="max-h-[70vh] w-full rounded-md object-contain" />
        )}
        {!previewLoading && previewUrl && isPdfFile(previewFileName) && (
          <iframe src={previewUrl} title={previewFileName} className="h-[70vh] w-full rounded-md border border-gray-200 bg-white" />
        )}
        {!previewLoading && previewUrl && !isImageFile(previewFileName) && !isPdfFile(previewFileName) && (
          <div className="rounded-md border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
            Preview is not available for this file type. Use Download file to open it.
          </div>
        )}
      </Modal>
    </div>
  );
};

export default ParticipantTracker;
