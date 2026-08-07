import React, { useEffect, useMemo, useState, useRef } from 'react';
import { bookingsApi, ceremoniesApi, fileUploadsApi, medicalArtifactsApi, medicalReviewRequestsApi } from '../services/api';
import { usersApi, User } from '../services/usersApi';
import { Ceremony, CeremonyParticipant, FileUpload, MedicalArtifact, MedicalReviewGroup, MedicalReviewRequest, RetreatClient } from '../types';
import { Button, Card, Col, Form, Input, InputNumber, Modal, Row, Select, Statistic, TimePicker, message } from 'antd';
import { Activity, ArrowLeft, Clock3, FileText, HeartPulse, Maximize2, Minimize2, Plus, Trash2, GripVertical, Save } from 'lucide-react';
import moment from 'moment';
import { Link } from 'react-router-dom';

interface ParticipantTrackerProps {
  ceremonyId: string;
  onBack?: () => void;
  initialView?: TrackerView;
  lockedView?: boolean;
  showHeader?: boolean;
}

type TrackerView = 'spoons' | 'pre' | 'post';
type CeremonyEvent = NonNullable<CeremonyParticipant['eventLog']>[number];
type EventType = CeremonyEvent['eventType'];
type PreCeremonyCheck = NonNullable<CeremonyParticipant['preCeremonyChecks']>[number];
type PostCeremonyCheck = NonNullable<CeremonyParticipant['postCeremonyChecks']>[number];
type MedicalCheckPhase = 'pre' | 'post';
type PreMedicalFormKind = 'ekg' | 'bp';
type PreCeremonyMatrixDraft = {
  systolic: string;
  diastolic: string;
  pulse: string;
  ekgFile?: File;
};
type ReviewCreationLog = {
  id: string;
  time: string;
  client: string;
  type: string;
  status: 'created' | 'skipped' | 'error';
  requestNumber?: number | string;
  bucket?: string;
  detail: string;
};

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

const getClientFirstName = (participant: CeremonyParticipant) => {
  const client = participant.clientId as any;
  if (!client || typeof client === 'string') return 'Client';
  return client.firstName || client.fname || 'Unknown';
};

const getClientLastName = (participant: CeremonyParticipant) => {
  const client = participant.clientId as any;
  if (!client || typeof client === 'string') return getObjectId(client).slice(-6) || '';
  return client.lastName || client.lname || '';
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

const getCeremonyNightTimeSortValue = (time?: string) => {
  const match = String(time || '').match(/^(\d{1,2}):(\d{2})/);
  if (!match) return Number.MAX_SAFE_INTEGER;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  const minutes = hour * 60 + minute;
  return hour < 12 ? minutes + 24 * 60 : minutes;
};

const sortEvents = (events: CeremonyEvent[] = []) => (
  [...events].sort((a, b) => getCeremonyNightTimeSortValue(a.time) - getCeremonyNightTimeSortValue(b.time))
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

const getParticipantBookingId = (participant: CeremonyParticipant) => (
  getObjectId((participant as any).bookingId)
);

const parseBloodPressureText = (artifact: MedicalArtifact) => {
  const text = [artifact.textContent, artifact.notes, artifact.description].filter(Boolean).join('\n');
  const match = text.match(/(\d{2,3})\s*\/\s*(\d{2,3})(?:\D+(?:HR|P|Pulse)\s*(\d{2,3}))?/i);
  if (!match) return {};
  return {
    systolic: Number(match[1]),
    diastolic: Number(match[2]),
    pulse: match[3] ? Number(match[3]) : undefined,
  };
};

const buildPreCeremonyCheckFromArtifacts = (artifacts: MedicalArtifact[] = []): PreCeremonyCheck | undefined => {
  const bpArtifact = [...artifacts].reverse().find((artifact) => (
    artifact.documentStage === 'pre_ceremony' &&
    (artifact.documentType === 'BP' || artifact.artifactType === 'blood_pressure')
  ));
  const ekgArtifact = [...artifacts].reverse().find((artifact) => (
    artifact.documentStage === 'pre_ceremony' &&
    (artifact.documentType === 'EKG' || artifact.artifactType === 'ceremony_ekg' || artifact.artifactType === 'ekg')
  ));

  if (!bpArtifact && !ekgArtifact) return undefined;

  const bpData = bpArtifact?.data || {};
  const parsedBp = bpArtifact ? parseBloodPressureText(bpArtifact) : {};
  const firstEkgFile = ekgArtifact?.files?.[0];
  return {
    id: `artifact-${bpArtifact?._id || ekgArtifact?._id || 'pre-ceremony'}`,
    recordedAt: bpArtifact?.receivedAt || ekgArtifact?.receivedAt,
    preCeremonyEkg: ekgArtifact ? {
      fileUrl: firstEkgFile?.url || firstEkgFile?.filePath,
      fileName: firstEkgFile?.fileName,
      uploadedAt: firstEkgFile?.uploadedAt || ekgArtifact.receivedAt,
      notes: ekgArtifact.notes || ekgArtifact.textContent || '',
    } : undefined,
    preCeremonyBloodPressure: bpArtifact ? {
      systolic: Number(bpData.systolic || parsedBp.systolic) || undefined,
      diastolic: Number(bpData.diastolic || parsedBp.diastolic) || undefined,
      pulse: Number(bpData.pulse || bpData.heartRate || parsedBp.pulse) || undefined,
      recordedAt: bpData.measuredAt || bpData.resultRecordedAt || bpArtifact.receivedAt,
      notes: bpArtifact.notes || bpArtifact.textContent || '',
    } : undefined,
  };
};

const enrichParticipantsWithPreCeremonyArtifacts = (
  participants: CeremonyParticipant[],
  artifacts: MedicalArtifact[] = [],
  ceremonyNumber?: number,
) => participants.map((participant) => {
  const clientId = getObjectId(participant.clientId);
  const bookingId = getParticipantBookingId(participant);
  const participantArtifacts = artifacts.filter((artifact) => (
    (!artifact.ceremonyNumber || !ceremonyNumber || Number(artifact.ceremonyNumber) === Number(ceremonyNumber)) &&
    (
      Boolean(clientId && getObjectId(artifact.clientId) === clientId) ||
      Boolean(bookingId && getObjectId(artifact.bookingId) === bookingId)
    )
  ));
  const artifactCheck = buildPreCeremonyCheckFromArtifacts(participantArtifacts);
  if (!artifactCheck) return participant;

  const existingChecks = getPreCeremonyChecks(participant);
  return {
    ...participant,
    preCeremonyChecks: [...existingChecks, artifactCheck],
    preCeremonyEkg: participant.preCeremonyEkg || artifactCheck.preCeremonyEkg,
    preCeremonyBloodPressure: participant.preCeremonyBloodPressure || artifactCheck.preCeremonyBloodPressure,
  };
});

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
    bookingId: booking._id,
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
    if (!clientId) return;

    const existingParticipant = participantsByClientId.get(clientId);
    if (existingParticipant) {
      participantsByClientId.set(clientId, {
        ...existingParticipant,
        bookingId: getParticipantBookingId(existingParticipant) || booking._id,
      });
      return;
    }

    const participant = participantFromBooking(ceremony, booking);
    if (participant) participantsByClientId.set(clientId, participant);
  });

  return Array.from(participantsByClientId.values());
};

const ParticipantTracker: React.FC<ParticipantTrackerProps> = ({ ceremonyId, onBack, initialView = 'spoons', lockedView = false, showHeader = true }) => {
  const [ceremony, setCeremony] = useState<Ceremony | null>(null);
  const [participants, setParticipants] = useState<CeremonyParticipant[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [hasPositionChanges, setHasPositionChanges] = useState(false);
  const dragCounter = useRef(0);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedParticipant, setSelectedParticipant] = useState<CeremonyParticipant | null>(null);
  const [medicalParticipant, setMedicalParticipant] = useState<CeremonyParticipant | null>(null);
  const [editingMedicalCheckId, setEditingMedicalCheckId] = useState<string>('');
  const [medicalCheckPhase, setMedicalCheckPhase] = useState<MedicalCheckPhase>('pre');
  const [preMedicalFormKind, setPreMedicalFormKind] = useState<PreMedicalFormKind>('ekg');
  const [ekgUploadFile, setEkgUploadFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [previewFileName, setPreviewFileName] = useState<string>('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [trackerView, setTrackerView] = useState<TrackerView>(initialView);
  const [gridEdits, setGridEdits] = useState<Record<string, string>>({});
  const [newRows, setNewRows] = useState<Array<{ id: string; time: string }>>([]);
  const [isSpoonsFullScreen, setIsSpoonsFullScreen] = useState(false);
  const [preCeremonyMatrix, setPreCeremonyMatrix] = useState<Record<string, PreCeremonyMatrixDraft>>({});
  const [preCeremonyDirty, setPreCeremonyDirty] = useState<Record<string, boolean>>({});
  const [savingPreCeremonyMatrix, setSavingPreCeremonyMatrix] = useState(false);
  const [medicalAdvisors, setMedicalAdvisors] = useState<User[]>([]);
  const [medicalReviewBuckets, setMedicalReviewBuckets] = useState<MedicalReviewGroup[]>([]);
  const [selectedMedicalAdvisorId, setSelectedMedicalAdvisorId] = useState('');
  const [selectedMedicalReviewBucketId, setSelectedMedicalReviewBucketId] = useState('');
  const [creatingMedicalReviews, setCreatingMedicalReviews] = useState(false);
  const [reviewCreationLog, setReviewCreationLog] = useState<ReviewCreationLog[]>([]);
  const [form] = Form.useForm();
  const [medicalForm] = Form.useForm();

  useEffect(() => {
    loadData();
  }, [ceremonyId]);

  useEffect(() => {
    setTrackerView(initialView);
  }, [initialView]);

  useEffect(() => {
    Promise.all([usersApi.getAll(), medicalReviewRequestsApi.getGroups()]).then(([usersResponse, groupsResponse]) => {
      const advisors = (usersResponse.data || []).filter((user) => user.role === 'medical_advisor' && user.isActive !== false);
      setMedicalAdvisors(advisors);
      setMedicalReviewBuckets(groupsResponse.data || []);
      setSelectedMedicalAdvisorId((current) => current || (advisors.length === 1 ? advisors[0]._id : ''));
    }).catch(() => { setMedicalAdvisors([]); setMedicalReviewBuckets([]); });
  }, []);

  useEffect(() => {
    if (selectedMedicalReviewBucketId || !ceremony || medicalReviewBuckets.length === 0) return;
    const retreatId = getObjectId(ceremony.retreatId);
    if (!retreatId) return;
    const matchingPackets = medicalReviewBuckets.filter((packet) => (
      packet._id && !packet.revokedAt && getObjectId(packet.retreatId) === retreatId
    ));
    const selectedPacket = matchingPackets.find((packet) => (
      packet.groupType === 'ceremony' && Number(packet.ceremonyNumber) === Number(ceremony.ceremonyNumber)
    )) || matchingPackets.find((packet) => (
      packet.groupType === 'retreat' && packet.ceremonyNumber == null
    )) || matchingPackets[0];
    if (selectedPacket?._id) setSelectedMedicalReviewBucketId(selectedPacket._id);
  }, [ceremony, medicalReviewBuckets, selectedMedicalReviewBucketId]);

  useEffect(() => {
    if (trackerView !== 'pre') return;
    setPreCeremonyMatrix((current) => {
      const next = { ...current };
      participants.forEach((participant) => {
        const key = getParticipantKey(participant);
        if (preCeremonyDirty[key]) return;
        const bp = getLatestPreCeremonyCheck(participant)?.preCeremonyBloodPressure;
        next[key] = {
          systolic: bp?.systolic ? String(bp.systolic) : '',
          diastolic: bp?.diastolic ? String(bp.diastolic) : '',
          pulse: bp?.pulse ? String(bp.pulse) : '',
        };
      });
      return next;
    });
  }, [participants, preCeremonyDirty, trackerView]);

  useEffect(() => {
    if (!isSpoonsFullScreen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsSpoonsFullScreen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [isSpoonsFullScreen]);

  // Drag and Drop Handlers
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setIsDragging(true);
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    // Add a slight transparency to the dragged element
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '0.5';
    }
  };

  const handleDragEnd = (e: React.DragEvent) => {
    setIsDragging(false);
    setDraggedIndex(null);
    setDragOverIndex(null);
    dragCounter.current = 0;
    // Reset opacity
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '1';
    }
  };

  const handleDragEnter = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    dragCounter.current++;
    if (draggedIndex !== null && draggedIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    dragCounter.current--;
    if (dragCounter.current === 0) {
      setDragOverIndex(null);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    dragCounter.current = 0;

    if (draggedIndex === null || draggedIndex === dropIndex) {
      return;
    }

    const draggedItem = participants[draggedIndex];
    const newParticipants = [...participants];

    // Remove the dragged item
    newParticipants.splice(draggedIndex, 1);

    // Insert it at the new position
    const adjustedDropIndex = draggedIndex < dropIndex ? dropIndex - 1 : dropIndex;
    newParticipants.splice(adjustedDropIndex, 0, draggedItem);

    // Update positions
    const updatedParticipants = newParticipants.map((p, idx) => ({
      ...p,
      position: idx
    }));

    setParticipants(updatedParticipants);
    setHasPositionChanges(true);
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const savePositions = async () => {
    try {
      // Update each participant's position in the database
      const updates = participants.map((participant, index) =>
        ceremoniesApi.updateParticipant(participant._id!, {
          position: index
        })
      );

      await Promise.all(updates);
      message.success('Seating positions saved successfully');
      setHasPositionChanges(false);
    } catch (error) {
      console.error('Error saving positions:', error);
      message.error('Failed to save seating positions');
    }
  };

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
        const [bookingsResponse, ceremonyArtifactsResponse, legacyRetreatArtifactsResponse] = await Promise.all([
          bookingsApi.getByRetreatWithDetails(retreatId),
          medicalArtifactsApi.getAll({
            ceremonyId,
            documentStage: 'pre_ceremony',
          }).catch(() => ({ data: [] as MedicalArtifact[] })),
          medicalArtifactsApi.getAll({
            retreatId,
            documentStage: 'pre_ceremony',
          }).catch(() => ({ data: [] as MedicalArtifact[] })),
        ]);
        const artifactsById = new Map<string, MedicalArtifact>();
        [...(legacyRetreatArtifactsResponse.data || []), ...(ceremonyArtifactsResponse.data || [])].forEach((artifact) => {
          const artifactId = artifact._id || `${getObjectId(artifact.clientId)}:${artifact.documentType}:${artifact.receivedAt || ''}`;
          artifactsById.set(artifactId, artifact);
        });
        nextParticipants = mergeParticipantsWithBookings(
          ceremonyResponse.data,
          nextParticipants,
          (bookingsResponse.data || []) as RetreatClient[],
        );
        nextParticipants = enrichParticipantsWithPreCeremonyArtifacts(
          nextParticipants,
          Array.from(artifactsById.values()),
          ceremonyResponse.data.ceremonyNumber,
        );
      }

      setCeremony(ceremonyResponse.data);
      // Sort participants by position if it exists, otherwise keep original order
      const sortedParticipants = nextParticipants.sort((a: any, b: any) => {
        if (a.position !== undefined && b.position !== undefined) {
          return a.position - b.position;
        }
        return 0;
      });
      setParticipants(sortedParticipants);
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
    return Array.from(times).sort((a, b) => getCeremonyNightTimeSortValue(a) - getCeremonyNightTimeSortValue(b));
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

  const preCeremonyBoardStats = useMemo(() => participants.reduce((totals, participant) => {
    const key = getParticipantKey(participant);
    const draft = preCeremonyMatrix[key] || { systolic: '', diastolic: '', pulse: '' };
    const latest = getLatestPreCeremonyCheck(participant);
    const hasBp = Boolean(draft.systolic && draft.diastolic);
    const hasEkg = Boolean(draft.ekgFile || latest?.preCeremonyEkg?.fileName || latest?.preCeremonyEkg?.fileUrl);
    if (hasBp && hasEkg) totals.complete += 1;
    else totals.incomplete += 1;
    return totals;
  }, { complete: 0, incomplete: 0 }), [participants, preCeremonyMatrix]);

  const openEventModal = (participant: CeremonyParticipant, event?: CeremonyEvent, defaultTime?: string) => {
    setSelectedParticipant(participant);
    setEditingEventId(event?.id || '');
    form.setFieldsValue({
      time: event?.time ? moment(event.time, 'HH:mm') : defaultTime ? moment(defaultTime, 'HH:mm') : moment(),
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

  const openMedicalModal = (
    participant: CeremonyParticipant,
    check?: PreCeremonyCheck | PostCeremonyCheck,
    phase: MedicalCheckPhase = 'pre',
    formKind: PreMedicalFormKind = 'ekg',
  ) => {
    const selectedCheck = check;
    const ekg = phase === 'pre'
      ? (selectedCheck as PreCeremonyCheck | undefined)?.preCeremonyEkg
      : (selectedCheck as PostCeremonyCheck | undefined)?.postCeremonyEkg;
    setMedicalParticipant(participant);
    setEditingMedicalCheckId(selectedCheck?.id || '');
    setMedicalCheckPhase(phase);
    setPreMedicalFormKind(formKind);
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

    const clientId = getObjectId(participant.clientId);
    const findExistingParticipant = async () => {
      const response = await ceremoniesApi.getParticipants(ceremony._id!);
      return (response.data || []).find((existing) => getObjectId(existing.clientId) === clientId);
    };

    const existingParticipant = await findExistingParticipant();
    if (existingParticipant) return existingParticipant;

    try {
      const createdParticipant = await ceremoniesApi.addParticipant({
        ceremonyId: ceremony._id!,
        clientId,
        retreatId: getObjectId(participant.retreatId),
        medicalClearance: participant.medicalClearance || 'pending',
        participated: false,
        spoonsTaken: 0,
        purged: false,
        eventLog: [],
      });
      return createdParticipant.data;
    } catch (error: any) {
      if (error?.response?.status === 409) {
        const participantCreatedBySync = await findExistingParticipant();
        if (participantCreatedBySync) return participantCreatedBySync;
      }
      throw error;
    }
  };

  const existingCellKey = (participant: CeremonyParticipant, time: string) => `${getParticipantKey(participant)}__t__${time}`;
  const newCellKey = (participant: CeremonyParticipant, rowId: string) => `${getParticipantKey(participant)}__n__${rowId}`;

  const getSpoonCellValue = (participant: CeremonyParticipant, time: string) => {
    const medicineEvents = (participant.eventLog || []).filter((event) => event.time === time && event.eventType === 'medicine');
    if (!medicineEvents.length) return '';
    const total = medicineEvents.reduce((sum, event) => sum + Number(event.spoonCount || 0), 0);
    return Number.isFinite(total) && total !== 0 ? String(total) : '';
  };

  const getCellDisplayValue = (key: string, fallback: string) => (key in gridEdits ? gridEdits[key] : fallback);

  const setCellValue = (key: string, value: string) => {
    setGridEdits((prev) => ({ ...prev, [key]: value }));
  };

  const hasGridChanges = Object.keys(gridEdits).length > 0 || newRows.length > 0;

  const addGridRow = () => {
    setNewRows((prev) => [...prev, { id: `${Date.now()}-${Math.random().toString(16).slice(2)}`, time: moment().format('HH:mm') }]);
  };

  const updateNewRowTime = (rowId: string, time: string) => {
    setNewRows((prev) => prev.map((row) => (row.id === rowId ? { ...row, time } : row)));
  };

  const removeNewRow = (rowId: string) => {
    setNewRows((prev) => prev.filter((row) => row.id !== rowId));
    setGridEdits((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((key) => {
        if (key.endsWith(`__n__${rowId}`)) delete next[key];
      });
      return next;
    });
  };

  const discardGridChanges = () => {
    setGridEdits({});
    setNewRows([]);
  };

  const deriveSpoonAmount = (value: number): 'full' | 'half' | 'quarter' => {
    if (value <= 0.25) return 'quarter';
    if (value <= 0.5) return 'half';
    return 'full';
  };

  const applyMedicineValue = (eventLog: CeremonyEvent[], time: string, rawValue: string): CeremonyEvent[] => {
    const withoutMedicineAtTime = eventLog.filter((event) => !(event.time === time && event.eventType === 'medicine'));
    const numericMatch = rawValue.trim().replace(',', '.').match(/\d+(?:\.\d+)?/);
    const numeric = numericMatch ? Number(numericMatch[0]) : NaN;
    if (!Number.isFinite(numeric) || numeric <= 0) return withoutMedicineAtTime;
    const medicineEvent: CeremonyEvent = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      time,
      eventType: 'medicine',
      spoonCount: numeric,
      medicineForm: 'spoon',
      spoonAmount: deriveSpoonAmount(numeric),
      doseAmount: `${numeric}`,
      recordedAt: new Date().toISOString(),
    };
    return [...withoutMedicineAtTime, medicineEvent];
  };

  const saveGrid = async () => {
    if (!hasGridChanges || !ceremony) return;

    const changesByParticipantKey = new Map<string, { participant: CeremonyParticipant; updates: Array<{ time: string; value: string }>; position?: number }>();
    const registerChange = (participant: CeremonyParticipant, time: string, value: string) => {
      if (!time) return;
      const key = getParticipantKey(participant);
      if (!changesByParticipantKey.has(key)) changesByParticipantKey.set(key, { participant, updates: [] });
      changesByParticipantKey.get(key)!.updates.push({ time, value });
    };

    participants.forEach((participant, index) => {
      // Position is unrelated to spoon entry. Only include it when the user
      // actually reordered columns; otherwise an empty row could report success.
      if (hasPositionChanges && participant.position !== undefined) {
        const key = getParticipantKey(participant);
        if (!changesByParticipantKey.has(key)) changesByParticipantKey.set(key, { participant, updates: [], position: participant.position });
        else changesByParticipantKey.get(key)!.position = participant.position;
      }

      timeRows.forEach((time) => {
        const key = existingCellKey(participant, time);
        if (key in gridEdits) registerChange(participant, time, gridEdits[key]);
      });
      newRows.forEach((row) => {
        const key = newCellKey(participant, row.id);
        if (key in gridEdits) registerChange(participant, row.time, gridEdits[key]);
      });
    });

    if (changesByParticipantKey.size === 0) {
      message.warning('Enter at least one spoon amount before saving.');
      return;
    }

    try {
      setSaving(true);
      const entries = Array.from(changesByParticipantKey.values()).flatMap(({ participant, updates }) =>
        updates
          .filter(({ time, value }) => /\d/.test(value) || getSpoonCellValue(participant, time) !== '')
          .map(({ time, value }) => {
            const numericMatch = value.trim().replace(',', '.').match(/\d+(?:\.\d+)?/);
            return { clientId: getObjectId(participant.clientId), time, spoonCount: numericMatch ? Number(numericMatch[0]) : 0 };
          }),
      );
      if (!entries.length) throw new Error('Enter at least one spoon amount before saving.');
      const response = await ceremoniesApi.saveSpoonMatrix(ceremony._id!, entries);
      if (response.data.savedCells !== entries.length) throw new Error('The server did not confirm every spoon entry');
      message.success(`${response.data.savedCells} spoon ${response.data.savedCells === 1 ? 'entry' : 'entries'} saved`);
      discardGridChanges();
      await loadData();
    } catch (error: any) {
      message.error(error?.response?.data?.message || error?.message || 'Failed to save spoon matrix');
      console.error('Error saving spoon matrix:', error);
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
      const shouldSavePreEkg = medicalCheckPhase === 'pre' && preMedicalFormKind === 'ekg';
      const shouldSavePreBp = medicalCheckPhase === 'pre' && preMedicalFormKind === 'bp';
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
      if (ekgUploadFile && (medicalCheckPhase === 'post' || shouldSavePreEkg)) {
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
        preCeremonyEkg: shouldSavePreEkg
          ? {
              ...uploadedEkg,
              approved: values.ekgApproved === 'pending' ? undefined : values.ekgApproved === 'approved',
              notes: values.ekgNotes || '',
              reviewedAt: values.ekgApproved && values.ekgApproved !== 'pending' ? new Date().toISOString() : uploadedEkg?.reviewedAt,
            }
          : existingPreCheck?.preCeremonyEkg,
        preCeremonyBloodPressure: shouldSavePreBp
          ? {
              systolic: values.systolic ? Number(values.systolic) : undefined,
              diastolic: values.diastolic ? Number(values.diastolic) : undefined,
              pulse: values.pulse ? Number(values.pulse) : undefined,
              approved: values.bpApproved === 'pending' ? undefined : values.bpApproved === 'approved',
              notes: values.bpNotes || '',
              recordedAt: existingPreCheck?.preCeremonyBloodPressure?.recordedAt || new Date().toISOString(),
            }
          : existingPreCheck?.preCeremonyBloodPressure,
        medicalClearance: values.medicalClearance || existingPreCheck?.medicalClearance || 'pending',
        medicalClearanceNotes: values.medicalClearanceNotes ?? existingPreCheck?.medicalClearanceNotes ?? '',
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

      const nextPreChecks = nextChecks as PreCeremonyCheck[];
      const latestPreEkg = [...nextPreChecks].reverse().find((check) => check.preCeremonyEkg)?.preCeremonyEkg;
      const latestPreBloodPressure = [...nextPreChecks].reverse().find((check) => check.preCeremonyBloodPressure)?.preCeremonyBloodPressure;
      const latestPreClearance = [...nextPreChecks].reverse().find((check) => check.medicalClearance || check.medicalClearanceNotes);

      const payload = medicalCheckPhase === 'pre'
        ? {
            preCeremonyChecks: nextChecks,
            preCeremonyEkg: latestPreEkg,
            preCeremonyBloodPressure: latestPreBloodPressure,
            medicalClearance: latestPreClearance?.medicalClearance || 'pending',
            medicalClearanceNotes: latestPreClearance?.medicalClearanceNotes || '',
          }
        : {
            postCeremonyChecks: nextChecks,
            postCeremonyEkg: nextPostCheck.postCeremonyEkg,
          };

      const updatedParticipantResponse = await ceremoniesApi.updateMedicalCheck(participantToUpdate._id!, payload);
      const updatedParticipant = updatedParticipantResponse.data;
      setParticipants((prev) => prev.map((participant) => (
        getParticipantKey(participant) === getParticipantKey(participantToUpdate)
          || getObjectId(participant.clientId) === getObjectId(participantToUpdate.clientId)
          ? { ...participant, ...updatedParticipant }
          : participant
      )));
      const savedLabel = medicalCheckPhase === 'post'
        ? 'Post-ceremony EKG'
        : preMedicalFormKind === 'bp'
          ? 'Pre-ceremony BP'
          : 'Pre-ceremony EKG';
      message.success(`${savedLabel} saved`);
      setMedicalParticipant(null);
      setEditingMedicalCheckId('');
      setPreMedicalFormKind('ekg');
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

      if (!savedFileHash && fileUrl && ceremony?._id) {
        const artifactResponse = await medicalArtifactsApi.getAll({
          ceremonyId: ceremony._id,
          clientId: getObjectId(participant.clientId),
          documentStage: 'pre_ceremony',
          documentType: 'EKG',
        });
        const matchingArtifact = ((artifactResponse.data || []) as MedicalArtifact[]).find((artifact: MedicalArtifact) => (
          artifact.files?.some((file: NonNullable<MedicalArtifact['files']>[number]) => file.s3Key === fileUrl || file.filePath === fileUrl || file.fileName === fileName)
        ));
        const matchingFile = matchingArtifact?.files?.find((file: NonNullable<MedicalArtifact['files']>[number]) => (
          file.s3Key === fileUrl || file.filePath === fileUrl || file.fileName === fileName
        ));
        const storedPath = matchingFile?.s3Key || matchingFile?.filePath;
        if (matchingArtifact?._id && storedPath) {
          const response = await medicalArtifactsApi.getFileBlob(matchingArtifact._id, storedPath);
          setPreviewUrl(URL.createObjectURL(response.data as Blob));
          setPreviewFileName(matchingFile.fileName || fileName || 'Pre-ceremony EKG');
          return;
        }
      }

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

  const showEkgFields = medicalCheckPhase === 'post' || preMedicalFormKind === 'ekg';
  const showBpFields = medicalCheckPhase === 'pre' && preMedicalFormKind === 'bp';
  const showMedicalClearanceFields = false;
  const medicalModalTitle = [
    editingMedicalCheckId ? 'Edit' : 'Add',
    medicalCheckPhase === 'post'
      ? 'Post-Ceremony EKG'
        : preMedicalFormKind === 'bp'
          ? 'Pre-Ceremony BP'
          : 'Pre-Ceremony EKG',
    medicalParticipant ? `- ${getClientName(medicalParticipant)}` : '',
  ].filter(Boolean).join(' ');

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

  const updatePreCeremonyDraft = (participant: CeremonyParticipant, patch: Partial<PreCeremonyMatrixDraft>) => {
    const key = getParticipantKey(participant);
    setPreCeremonyMatrix((current) => ({
      ...current,
      [key]: { ...(current[key] || { systolic: '', diastolic: '', pulse: '' }), ...patch },
    }));
    setPreCeremonyDirty((current) => ({ ...current, [key]: true }));
  };

  const savePreCeremonyMatrix = async (
    participantOverride?: CeremonyParticipant,
    draftOverride?: PreCeremonyMatrixDraft,
  ) => {
    if (!ceremony?._id) return;
    const changedParticipants = participantOverride
      ? [participantOverride]
      : participants.filter((participant) => preCeremonyDirty[getParticipantKey(participant)]);
    if (!changedParticipants.length) return;

    for (const participant of changedParticipants) {
      const draft = participantOverride && getParticipantKey(participantOverride) === getParticipantKey(participant)
        ? draftOverride || preCeremonyMatrix[getParticipantKey(participant)]
        : preCeremonyMatrix[getParticipantKey(participant)];
      const resolvedDraft = draft || { systolic: '', diastolic: '', pulse: '' };
      const systolic = Number(resolvedDraft.systolic || 0);
      const diastolic = Number(resolvedDraft.diastolic || 0);
      const pulse = Number(resolvedDraft.pulse || 0);
      const hasAnyBp = Boolean(resolvedDraft.systolic || resolvedDraft.diastolic || resolvedDraft.pulse);
      if (hasAnyBp && (!systolic || !diastolic || systolic < 60 || systolic > 250 || diastolic < 40 || diastolic > 150 || (pulse && (pulse < 30 || pulse > 220)))) {
        message.error(`Check the blood pressure values for ${getClientName(participant)}`);
        return;
      }
    }

    try {
      setSavingPreCeremonyMatrix(true);
      await Promise.all(changedParticipants.map(async (participant) => {
        const participantToUpdate = await ensureSavedParticipant(participant);
        if (getObjectId(participantToUpdate.ceremonyId) !== ceremony._id) {
          throw new Error(`Participant ${getClientName(participant)} is not assigned to the selected ceremony`);
        }
        const key = getParticipantKey(participant);
        const draft = participantOverride && getParticipantKey(participantOverride) === key
          ? draftOverride || preCeremonyMatrix[key] || { systolic: '', diastolic: '', pulse: '' }
          : preCeremonyMatrix[key] || { systolic: '', diastolic: '', pulse: '' };
        const allChecks = getPreCeremonyChecks(participantToUpdate);
        const storedChecks = allChecks.filter((check) => !String(check.id || '').startsWith('artifact-'));
        const latestStored = storedChecks[storedChecks.length - 1];
        const latestVisible = getLatestPreCeremonyCheck(participantToUpdate);
        let ekg = latestStored?.preCeremonyEkg || latestVisible?.preCeremonyEkg;

        if (draft.ekgFile) {
          ekg = {
            fileName: draft.ekgFile.name,
            uploadedAt: new Date().toISOString(),
            approved: undefined,
            notes: '',
          };
        }

        const hasBp = Boolean(draft.systolic && draft.diastolic);
        const checkId = latestStored?.id || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
        const nextCheck: PreCeremonyCheck = {
          ...latestStored,
          id: checkId,
          recordedAt: new Date().toISOString(),
          preCeremonyEkg: ekg,
          preCeremonyBloodPressure: hasBp ? {
            ...latestStored?.preCeremonyBloodPressure,
            systolic: Number(draft.systolic),
            diastolic: Number(draft.diastolic),
            pulse: draft.pulse ? Number(draft.pulse) : undefined,
            recordedAt: new Date().toISOString(),
          } : latestStored?.preCeremonyBloodPressure || latestVisible?.preCeremonyBloodPressure,
          medicalClearance: latestStored?.medicalClearance || 'pending',
          medicalClearanceNotes: latestStored?.medicalClearanceNotes || '',
        };
        let nextChecks = latestStored
          ? storedChecks.map((check) => check.id === latestStored.id ? nextCheck : check)
          : [...storedChecks, nextCheck];

        const buildMedicalPayload = () => ({
          ceremonyId: ceremony._id,
          context: 'pre_ceremony',
          preCeremonyChecks: nextChecks,
          preCeremonyEkg: nextCheck.preCeremonyEkg,
          preCeremonyBloodPressure: nextCheck.preCeremonyBloodPressure,
          medicalClearance: nextCheck.medicalClearance || 'pending',
          medicalClearanceNotes: nextCheck.medicalClearanceNotes || '',
        } as any);

        await ceremoniesApi.updateMedicalCheck(participantToUpdate._id!, buildMedicalPayload());

        if (draft.ekgFile) {
          const artifactResponse = await medicalArtifactsApi.getAll({
            ceremonyId: ceremony._id,
            clientId: getObjectId(participantToUpdate.clientId),
            documentStage: 'pre_ceremony',
            documentType: 'EKG',
          });
          const ekgArtifacts = (artifactResponse.data || []) as MedicalArtifact[];
          const ekgArtifact = ekgArtifacts.find((artifact: MedicalArtifact) => (
            String((artifact.data as any)?.preCeremonyCheckId || '') === String(checkId)
          )) || ekgArtifacts[0];
          if (!ekgArtifact?._id) throw new Error(`The EKG artifact for ${getClientName(participantToUpdate)} was not created`);

          const uploadResponse = await medicalArtifactsApi.uploadFiles(ekgArtifact._id, [draft.ekgFile]);
          const uploadedArtifact = (uploadResponse.data as any)?.artifact as MedicalArtifact | undefined;
          const uploadedFile = uploadedArtifact?.files?.[uploadedArtifact.files.length - 1];
          const durablePath = uploadedFile?.s3Key || uploadedFile?.filePath;
          if (!durablePath) throw new Error(`The EKG file for ${getClientName(participantToUpdate)} was not stored`);

          nextCheck.preCeremonyEkg = {
            ...nextCheck.preCeremonyEkg,
            fileUrl: durablePath,
            fileName: uploadedFile?.fileName || draft.ekgFile.name,
            uploadedAt: uploadedFile?.uploadedAt || new Date().toISOString(),
          };
          nextChecks = nextChecks.map((check) => check.id === checkId ? nextCheck : check);
          await ceremoniesApi.updateMedicalCheck(participantToUpdate._id!, buildMedicalPayload());
        }
      }));
      setPreCeremonyDirty((current) => {
        const next = { ...current };
        changedParticipants.forEach((participant) => delete next[getParticipantKey(participant)]);
        return next;
      });
      message.success(`Pre-ceremony data saved for Ceremony #${ceremony.ceremonyNumber}`);
      await loadData();
    } catch (error) {
      message.error('Failed to save all pre-ceremony data. Existing successful uploads were preserved.');
      console.error('Error saving pre-ceremony matrix:', error);
    } finally {
      setSavingPreCeremonyMatrix(false);
    }
  };

  const handlePreCeremonyEkgSelection = async (participant: CeremonyParticipant, file?: File) => {
    if (!file) return;
    const key = getParticipantKey(participant);
    const nextDraft = {
      ...(preCeremonyMatrix[key] || { systolic: '', diastolic: '', pulse: '' }),
      ekgFile: file,
    };
    setPreCeremonyMatrix((current) => ({ ...current, [key]: nextDraft }));
    setPreCeremonyDirty((current) => ({ ...current, [key]: true }));
    message.info(`Uploading replacement EKG for ${getClientName(participant)}...`);
    await savePreCeremonyMatrix(participant, nextDraft);
  };

  const createPreCeremonyMedicalReviews = async () => {
    if (!ceremony?._id) return;
    if (!selectedMedicalAdvisorId) return void message.error('Select a medical advisor.');
    if (!selectedMedicalReviewBucketId) return void message.error('Select an MRR bucket.');
    if (Object.values(preCeremonyDirty).some(Boolean)) return void message.error('Save the pre-ceremony data before creating its medical reviews.');

    const bucket = medicalReviewBuckets.find((item) => item._id === selectedMedicalReviewBucketId);
    const bucketReviewerId = getObjectId(bucket?.reviewerUserId);
    if (bucketReviewerId && bucketReviewerId !== selectedMedicalAdvisorId) {
      return void message.error('The selected bucket is assigned to a different medical advisor. Select a matching advisor or bucket.');
    }
    const advisor = medicalAdvisors.find((item) => item._id === selectedMedicalAdvisorId);
    const advisorName = advisor ? [advisor.firstName, advisor.lastName].filter(Boolean).join(' ') || advisor.email : 'Selected advisor';
    const participantNameByClientId = new Map(participants.map((participant) => [getObjectId(participant.clientId), getClientName(participant)]));
    setReviewCreationLog([]);
    setCreatingMedicalReviews(true);

    try {
      const artifactsResponse = await medicalArtifactsApi.getAll({ ceremonyId: ceremony._id, documentStage: 'pre_ceremony' });
      const artifacts: MedicalArtifact[] = (artifactsResponse.data || []).filter((artifact: MedicalArtifact) => (
        artifact._id && ['EKG', 'BP'].includes(String(artifact.documentType || '').toUpperCase())
      ));
      if (!artifacts.length) {
        message.warning('No saved pre-ceremony EKG or blood-pressure records were found for this ceremony.');
        return;
      }
      const existingResponse = await medicalReviewRequestsApi.getByArtifacts(artifacts.map((artifact) => artifact._id!));
      const existingByArtifact = new Map<string, MedicalReviewRequest>();
      (existingResponse.data || []).forEach((request: MedicalReviewRequest) => {
        const ids = (request.artifactIds || []).map((artifact: any) => getObjectId(artifact));
        ids.forEach((id) => { if (id && !existingByArtifact.has(id)) existingByArtifact.set(id, request); });
      });

      for (const artifact of artifacts) {
        const artifactId = artifact._id!;
        const type = String(artifact.documentType).toUpperCase() === 'BP' ? 'Blood pressure' : 'Pre-ceremony EKG';
        const client = participantNameByClientId.get(getObjectId(artifact.clientId)) || 'Client';
        const existing = existingByArtifact.get(artifactId);
        if (existing) {
          setReviewCreationLog((current) => [...current, {
            id: `${artifactId}-skip`, time: new Date().toLocaleTimeString(), client, type, status: 'skipped',
            requestNumber: existing.display_id, bucket: bucket?.title, detail: `Existing MRR #${existing.display_id || existing._id} was not duplicated.`,
          }]);
          continue;
        }
        try {
          const requestType: MedicalReviewRequest['requestType'] = type === 'Blood pressure' ? 'blood_pressure_review' : 'ceremony_ekg_review';
          const createdResponse = await medicalReviewRequestsApi.createFromArtifact(artifactId, requestType, {
            assignedToUserId: selectedMedicalAdvisorId,
            medicalReviewGroupId: selectedMedicalReviewBucketId,
          });
          const created = createdResponse.data;
          await medicalReviewRequestsApi.addRequestsToGroup(selectedMedicalReviewBucketId, [created._id!]);
          setReviewCreationLog((current) => [...current, {
            id: created._id!, time: new Date().toLocaleTimeString(), client, type, status: 'created',
            requestNumber: created.display_id, bucket: bucket?.title, detail: `Assigned to ${advisorName}.`,
          }]);
        } catch (error: any) {
          setReviewCreationLog((current) => [...current, {
            id: `${artifactId}-error`, time: new Date().toLocaleTimeString(), client, type, status: 'error',
            bucket: bucket?.title, detail: error?.response?.data?.message || 'MRR creation failed.',
          }]);
        }
      }
      message.success(`Finished creating pre-ceremony reviews for Ceremony #${ceremony.ceremonyNumber}.`);
    } catch (error: any) {
      message.error(error?.response?.data?.message || 'Unable to create pre-ceremony medical reviews.');
    } finally {
      setCreatingMedicalReviews(false);
    }
  };

  return (
    <div className={isSpoonsFullScreen ? 'fixed inset-0 z-[100] flex flex-col overflow-hidden bg-gray-100 p-4 sm:p-6' : showHeader ? 'p-6' : 'p-0'}>
      {onBack && (
        <button onClick={onBack} className="mb-4 inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
          <Icon icon={ArrowLeft} className="h-4 w-4" />
          Back to Ceremonies
        </button>
      )}

      <div className={`${showHeader ? 'mb-5' : 'mb-4'} flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between`}>
        <div>
          {showHeader && <h1 className="text-2xl font-semibold text-gray-900">Track Spoons & Time</h1>}
          <p className="text-sm text-gray-600">
            Ceremony #{ceremony?.ceremonyNumber || '-'}
            {trackerView === 'spoons' ? ' - type a spoon amount (e.g. 1, 0.5, 0.75) into each client cell, add time rows, then Save.' : ''}
            {ceremony?.date ? ` ${moment(ceremony.date).format('MMMM DD, YYYY')}` : ''}
          </p>
          {trackerView === 'pre' && ceremony && (
            <p className="mt-1 text-sm font-semibold text-indigo-700">
              All entries below will be saved as pre-ceremony data for Ceremony #{ceremony.ceremonyNumber}.
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {trackerView === 'pre' && (
            <Button
              type="primary"
              icon={<Icon icon={Save} className="h-4 w-4" />}
              onClick={() => savePreCeremonyMatrix()}
              loading={savingPreCeremonyMatrix}
              disabled={!Object.values(preCeremonyDirty).some(Boolean)}
            >
              Save all pre-ceremony data
            </Button>
          )}
          {trackerView === 'spoons' && (
            <>
              <Button icon={<Icon icon={isSpoonsFullScreen ? Minimize2 : Maximize2} className="h-4 w-4" />} onClick={() => setIsSpoonsFullScreen((current) => !current)}>
                {isSpoonsFullScreen ? 'Back to small' : 'Enlarge'}
              </Button>
              <Button icon={<Icon icon={Plus} className="h-4 w-4" />} onClick={addGridRow} disabled={participants.length === 0}>
                Add row
              </Button>
              {hasGridChanges && (
                <>
                  <Button type="primary" onClick={saveGrid} loading={saving}>Save</Button>
                  <Button onClick={discardGridChanges} disabled={saving}>Discard</Button>
                </>
              )}
            </>
          )}
          <div className="inline-flex items-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700">
            <Icon icon={Clock3} className="h-4 w-4" />
            {moment().format('HH:mm')}
          </div>
        </div>
      </div>

      {!isSpoonsFullScreen && trackerView !== 'pre' && <Row gutter={16} className="mb-5">
        <Col xs={12} lg={4}><Card><Statistic title="Participants" value={stats.total} /></Card></Col>
        <Col xs={12} lg={5}><Card><Statistic title="Took Medicine" value={stats.tookMedicine} suffix={`/ ${stats.total}`} /></Card></Col>
        <Col xs={12} lg={5}><Card><Statistic title="Total Doses" value={stats.totalSpoons} /></Card></Col>
        <Col xs={12} lg={5}><Card><Statistic title="Purged" value={stats.purged} suffix={`/ ${stats.tookMedicine}`} /></Card></Col>
        <Col xs={12} lg={5}><Card><Statistic title="Abnormalities" value={stats.abnormalities} valueStyle={{ color: stats.abnormalities ? '#b91c1c' : '#166534' }} /></Card></Col>
      </Row>}

      {!lockedView && <div className="mb-4 flex flex-wrap gap-2">
        {[
          { key: 'spoons', label: 'Spoons & Time' },
          { key: 'pre', label: 'Pre-ceremony checks' },
          { key: 'post', label: 'Post-ceremony EKG' },
        ].map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setTrackerView(item.key as TrackerView)}
            className={`rounded-md border px-3 py-2 text-sm font-medium ${trackerView === item.key ? 'border-indigo-200 bg-indigo-50 text-indigo-700' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'}`}
          >
            {item.label}
          </button>
        ))}
      </div>}

      {trackerView === 'pre' && (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-5 border-b-[3px] border-slate-900 px-6 py-6 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">Pre-ceremony clearance</div>
              <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-950">Vitals board</h2>
              <div className="mt-1 text-sm text-slate-500">Ceremony #{ceremony?.ceremonyNumber} · enter all readings and EKGs in one place</div>
            </div>
            <div className="flex flex-wrap items-center gap-5 text-sm text-slate-600">
              <div className="flex items-center gap-5">
                <div className="flex items-baseline gap-2"><span className="text-3xl font-extrabold text-amber-700">{preCeremonyBoardStats.incomplete}</span><span>incomplete</span></div>
                <div className="h-10 w-px bg-slate-200" />
                <div className="flex items-baseline gap-2"><span className="text-3xl font-extrabold text-emerald-700">{preCeremonyBoardStats.complete}</span><span>complete</span></div>
              </div>
              <div className="flex flex-col items-start gap-1 sm:items-end">
                {Object.values(preCeremonyDirty).some(Boolean) && <span className="text-xs font-bold uppercase tracking-wide text-amber-700">Unsaved changes</span>}
                <Button
                  type="primary"
                  size="large"
                  icon={<Icon icon={Save} className="h-4 w-4" />}
                  onClick={() => savePreCeremonyMatrix()}
                  loading={savingPreCeremonyMatrix}
                  disabled={!Object.values(preCeremonyDirty).some(Boolean)}
                >
                  Save vitals
                </Button>
              </div>
            </div>
          </div>
          <div className="overflow-auto">
          <table className="min-w-[1040px] w-full border-collapse text-sm">
            <thead className="sticky top-0 z-20 bg-white">
              <tr>
                <th className="sticky left-0 z-30 w-[27%] border-b border-slate-200 bg-white px-6 py-4 text-left text-xs font-bold uppercase tracking-[0.15em] text-slate-500">Client</th>
                <th className="w-[27%] border-b border-slate-200 px-6 py-4 text-left text-xs font-bold uppercase tracking-[0.15em] text-slate-500">Blood pressure</th>
                <th className="w-[25%] border-b border-slate-200 px-6 py-4 text-left text-xs font-bold uppercase tracking-[0.15em] text-slate-500">EKG</th>
                <th className="w-[21%] border-b border-slate-200 px-6 py-4 text-left text-xs font-bold uppercase tracking-[0.15em] text-slate-500">Earlier readings</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {participants.map((participant) => {
                const key = getParticipantKey(participant);
                const draft = preCeremonyMatrix[key] || { systolic: '', diastolic: '', pulse: '' };
                const check = getLatestPreCeremonyCheck(participant);
                const checks = getPreCeremonyChecks(participant);
                const earlierChecks = checks.slice(0, -1).reverse();
                const existingEkg = check?.preCeremonyEkg;
                const hasBp = Boolean(draft.systolic && draft.diastolic);
                const hasEkg = Boolean(draft.ekgFile || existingEkg?.fileName || existingEkg?.fileUrl);
                const complete = hasBp && hasEkg;
                const statusText = complete ? 'Ready for review' : `Missing ${[!hasEkg ? 'EKG' : '', !hasBp ? 'BP' : ''].filter(Boolean).join(' and ')}`;
                return (
                  <tr key={`${key}-pre-row`} className="align-middle hover:bg-slate-50/70">
                    <th className="sticky left-0 z-10 bg-white px-6 py-5 text-left">
                      <div className="flex gap-4">
                        <span className={`mt-2 h-2.5 w-2.5 shrink-0 rounded-full ${complete ? 'bg-emerald-500' : hasBp || hasEkg ? 'bg-slate-400' : 'bg-amber-500'}`} />
                        <div className="min-w-0">
                          <div className="text-base font-extrabold text-slate-950">{getClientFirstName(participant)} {getClientLastName(participant)}</div>
                          <div className={`mt-1 font-semibold ${complete ? 'text-emerald-700' : 'text-amber-700'}`}>{statusText}</div>
                          <div className="mt-2 space-y-0.5 text-[11px] font-normal text-slate-400">
                            <div>Client <Link to={`/admin/clients/${getObjectId(participant.clientId)}`} className="font-semibold text-blue-700 hover:underline">{getObjectId(participant.clientId)}</Link></div>
                            {getParticipantBookingId(participant) && <div>Booking <Link to={`/admin/bookings/${getParticipantBookingId(participant)}`} className="font-semibold text-blue-700 hover:underline">{getParticipantBookingId(participant)}</Link></div>}
                          </div>
                        </div>
                      </div>
                    </th>
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-2">
                        <input type="number" min="60" max="250" aria-label={`Systolic for ${getClientName(participant)}`} placeholder="—" value={draft.systolic} onChange={(event) => updatePreCeremonyDraft(participant, { systolic: event.target.value })} className="w-20 rounded-lg border border-slate-200 bg-slate-50 px-2 py-2 text-center text-2xl font-extrabold text-slate-950 outline-none focus:border-blue-500 focus:bg-white" />
                        <span className="text-3xl font-light text-slate-300">/</span>
                        <input type="number" min="40" max="150" aria-label={`Diastolic for ${getClientName(participant)}`} placeholder="—" value={draft.diastolic} onChange={(event) => updatePreCeremonyDraft(participant, { diastolic: event.target.value })} className="w-20 rounded-lg border border-slate-200 bg-slate-50 px-2 py-2 text-center text-2xl font-extrabold text-slate-950 outline-none focus:border-blue-500 focus:bg-white" />
                      </div>
                      <div className="mt-2 flex items-center gap-2 text-xs text-slate-500"><span>Pulse</span><input type="number" min="30" max="220" aria-label={`Pulse for ${getClientName(participant)}`} placeholder="—" value={draft.pulse} onChange={(event) => updatePreCeremonyDraft(participant, { pulse: event.target.value })} className="w-16 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-center font-bold text-slate-700 outline-none focus:border-blue-500" /></div>
                    </td>
                    <td className="px-6 py-5">
                      <div className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 font-bold ${hasEkg ? 'bg-slate-100 text-slate-700' : 'bg-amber-100 text-amber-700'}`}><Icon icon={Activity} className="h-4 w-4" />{hasEkg ? 'Pending' : 'Not taken'}</div>
                      {existingEkg?.fileName && <button type="button" onClick={() => openFilePreview(participant, existingEkg.fileUrl, existingEkg.fileName)} className="mt-2 block max-w-[230px] truncate text-xs font-semibold text-blue-700 hover:underline" title={existingEkg.fileName}>View {existingEkg.fileName}</button>}
                      <label className="mt-2 block w-fit cursor-pointer text-xs font-semibold text-blue-700 hover:underline">
                        {draft.ekgFile ? 'Change selected EKG' : existingEkg?.fileName ? 'Replace EKG' : 'Upload EKG'}
                        <input type="file" accept=".pdf,.jpg,.jpeg,.png,image/*,application/pdf" className="sr-only" onChange={(event) => void handlePreCeremonyEkgSelection(participant, event.target.files?.[0])} />
                      </label>
                      {draft.ekgFile && <div className="mt-1 max-w-[230px] truncate text-xs text-slate-500" title={draft.ekgFile.name}>{draft.ekgFile.name}</div>}
                    </td>
                    <td className="px-6 py-5 text-slate-400">
                      {earlierChecks.length ? earlierChecks.slice(0, 2).map((earlier, index) => <div key={earlier.id || index} className="mb-1 text-xs"><span className="font-bold text-slate-600">{getBloodPressureLabel(earlier)}</span> · {getCheckTimeLabel(earlier)}</div>) : <span className="text-sm">nothing recorded</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
          {participants.length === 0 && !loading && <div className="px-4 py-8 text-center text-sm text-gray-500">No participants found for this ceremony.</div>}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-6 py-4">
            <div className="text-xs text-slate-400">Last refreshed {moment().format('HH:mm')} · Ceremony #{ceremony?.ceremonyNumber}</div>
            <Button
              type="primary"
              icon={<Icon icon={Save} className="h-4 w-4" />}
              onClick={() => savePreCeremonyMatrix()}
              loading={savingPreCeremonyMatrix}
              disabled={!Object.values(preCeremonyDirty).some(Boolean)}
            >
              {Object.values(preCeremonyDirty).some(Boolean) ? 'Save vitals' : 'All changes saved'}
            </Button>
          </div>
        </div>
      )}

      <div className={`${trackerView === 'pre' ? 'hidden' : ''} overflow-auto rounded-lg border border-gray-200 bg-white ${isSpoonsFullScreen ? 'min-h-0 flex-1' : ''}`}>
        <table className="w-full table-fixed border-collapse">
          <colgroup>
            <col style={{ width: '8%' }} />
            {participants.map((participant) => <col key={participant._id} style={{ width: `${92 / Math.max(participants.length, 1)}%` }} />)}
          </colgroup>
          <thead className="sticky top-0 z-20">
            <tr className="bg-gray-50">
              <th className="sticky left-0 top-0 z-30 border-b border-r border-gray-200 bg-gray-50 px-2 py-3 text-left text-xs font-semibold uppercase text-gray-500 shadow-sm">Time</th>
              {participants.map((participant, index) => {
                const checks = getPreCeremonyChecks(participant);
                const latestCheck = getLatestPreCeremonyCheck(participant);
                const postChecks = getPostCeremonyChecks(participant);
                const isDraggedOver = dragOverIndex === index && draggedIndex !== index;
                return (
                  <th
                    key={participant._id}
                    className={`sticky top-0 z-20 min-w-0 break-words border-b border-r border-gray-200 bg-gray-50 px-2 py-3 text-left align-top shadow-sm cursor-move transition-all duration-200 ${
                      isDraggedOver ? 'border-l-4 border-l-blue-500' : ''
                    } ${isDragging && draggedIndex === index ? 'opacity-50' : ''}`}
                    draggable
                    onDragStart={(e) => handleDragStart(e, index)}
                    onDragEnd={handleDragEnd}
                    onDragEnter={(e) => handleDragEnter(e, index)}
                    onDragLeave={handleDragLeave}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, index)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="space-y-0.5">
                        <div className="text-base font-bold text-gray-900">{getClientFirstName(participant)}</div>
                        <div className="text-xs font-normal text-gray-600">{getClientLastName(participant)}</div>
                        {trackerView === 'spoons' && (
                          <div className="text-xs font-semibold text-indigo-700">
                            Previous ceremonies: {participant.previousSpoonsTotal || 0} spoons
                          </div>
                        )}
                      </div>
                      <div className="text-gray-400 hover:text-gray-600">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                        </svg>
                      </div>
                    </div>
                    <div className="mt-2 text-xs text-gray-500">
                      {participant.spoonsTaken || 0} spoons
                      {participant.purged && <div className="text-xs">Purged {participant.purgeTime || ''}</div>}
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
                    {trackerView === 'pre' && !lockedView && checks.length > 0 && (
                      <div className="mt-2 space-y-2">
                        {checks.map((check, index) => (
                          <div key={check.id || index} className="rounded-md border border-gray-200 bg-gray-50 px-2 py-2 text-xs text-gray-700">
                            <div className="flex items-start justify-between gap-2">
                              <div className="font-semibold text-gray-900">Check {index + 1}</div>
                              <div className="flex items-center gap-1">
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
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  <Icon icon={FileText} className="h-4 w-4 text-blue-600" />
                                  <span className="font-semibold">EKG</span>
                                  <span className="rounded bg-white/80 px-1.5 py-0.5 text-[11px] text-blue-700">{getApprovalLabel(check.preCeremonyEkg?.approved)}</span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => openMedicalModal(participant, check, 'pre', 'ekg')}
                                  className="rounded border border-blue-200 bg-white px-2 py-0.5 text-xs font-medium text-blue-700 hover:bg-blue-50"
                                >
                                  Edit EKG
                                </button>
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
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  <Icon icon={HeartPulse} className="h-4 w-4 text-rose-600" />
                                  <span className="font-semibold">Blood pressure</span>
                                  <span className="rounded bg-white/80 px-1.5 py-0.5 text-[11px] text-rose-700">{getApprovalLabel(check.preCeremonyBloodPressure?.approved)}</span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => openMedicalModal(participant, check, 'pre', 'bp')}
                                  className="rounded border border-rose-200 bg-white px-2 py-0.5 text-xs font-medium text-rose-700 hover:bg-rose-50"
                                >
                                  Edit BP
                                </button>
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
                    {trackerView === 'pre' && !lockedView && (
                      <div className="mt-1 flex flex-wrap gap-3">
                        <Button size="small" type="link" className="p-0" onClick={() => openMedicalModal(participant, undefined, 'pre', 'ekg')}>
                          <span className="inline-flex items-center gap-1">
                            <Icon icon={Activity} className="h-3.5 w-3.5" />
                            Add pre-ceremony EKG
                          </span>
                        </Button>
                        <Button size="small" type="link" className="p-0" onClick={() => openMedicalModal(participant, undefined, 'pre', 'bp')}>
                          <span className="inline-flex items-center gap-1">
                            <Icon icon={HeartPulse} className="h-3.5 w-3.5" />
                            Add pre-ceremony BP
                          </span>
                        </Button>
                      </div>
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
            {trackerView === 'spoons' && timeRows.map((time) => (
              <tr key={time} className="hover:bg-gray-50">
                <td className="sticky left-0 z-10 border-b border-r border-gray-200 bg-white px-2 py-3 align-top text-sm font-semibold text-gray-900">{time}</td>
                {participants.map((participant) => {
                  const key = existingCellKey(participant, time);
                  const otherEvents = eventsAtTime(participant, time).filter((event) => event.eventType !== 'medicine');
                  return (
                    <td key={`${participant._id}-${time}`} className="border-b border-r border-gray-200 p-2 align-top">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={getCellDisplayValue(key, getSpoonCellValue(participant, time))}
                        onChange={(event) => setCellValue(key, event.target.value)}
                        placeholder="-"
                        className="w-full rounded-md border border-gray-200 px-2 py-1 text-center text-base font-semibold text-gray-900 focus:border-indigo-400 focus:outline-none"
                      />
                      <div className="mt-1 space-y-1">
                        {otherEvents.map((event) => (
                          <div key={event.id || `${event.time}-${event.eventType}`} className={`rounded-md border px-2 py-1 text-xs ${eventTypeStyles[event.eventType]}`}>
                            <div className="flex items-start justify-between gap-2">
                              <span className="font-semibold">{eventTypeLabels[event.eventType]}</span>
                              <span className="flex items-center gap-1">
                                <button type="button" onClick={() => openEventModal(participant, event)} className="rounded border border-current px-1.5 py-0.5 text-[11px] font-medium hover:bg-white/60">
                                  Edit
                                </button>
                                <button type="button" onClick={() => deleteEvent(participant, event.id)} className="text-gray-500 hover:text-red-600" title="Delete event">
                                  <Icon icon={Trash2} className="h-3 w-3" />
                                </button>
                              </span>
                            </div>
                            <div className="mt-0.5 whitespace-pre-wrap">{getEventSummary(event)}</div>
                          </div>
                        ))}
                        <button type="button" onClick={() => openEventModal(participant, undefined, time)} className="text-[11px] font-medium text-indigo-600 hover:text-indigo-800">
                          + event
                        </button>
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
            {trackerView === 'spoons' && newRows.map((row) => (
              <tr key={row.id} className="bg-blue-50/40">
                <td className="sticky left-0 z-10 border-b border-r border-blue-200 bg-blue-50 px-2 py-3 align-top">
                  <input
                    type="time"
                    value={row.time}
                    onChange={(event) => updateNewRowTime(row.id, event.target.value)}
                    className="w-full rounded-md border border-gray-200 px-2 py-1 text-sm"
                  />
                  <button type="button" onClick={() => removeNewRow(row.id)} className="mt-1 text-[11px] font-medium text-red-600 hover:text-red-800">
                    Remove row
                  </button>
                </td>
                {participants.map((participant) => {
                  const key = newCellKey(participant, row.id);
                  return (
                    <td key={`${participant._id}-${row.id}`} className="border-b border-r border-blue-200 p-2 align-top">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={getCellDisplayValue(key, '')}
                        onChange={(event) => setCellValue(key, event.target.value)}
                        placeholder="-"
                        className="w-full rounded-md border border-gray-200 px-2 py-1 text-center text-base font-semibold text-gray-900 focus:border-indigo-400 focus:outline-none"
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
            {trackerView === 'spoons' && timeRows.length === 0 && newRows.length === 0 && (
              <tr>
                <td colSpan={participants.length + 1} className="px-4 py-8 text-center text-sm text-gray-500">
                  {loading ? 'Loading participants...' : 'No spoon rows yet. Use Add row to start the matrix.'}
                </td>
              </tr>
            )}
            {trackerView === 'pre' && (
              <>
                <tr className="bg-white">
                  <td className="sticky left-0 z-10 border-b border-r border-gray-200 bg-white px-3 py-4 align-top text-sm font-semibold text-gray-900">
                    Blood pressure
                    <div className="mt-1 text-xs font-normal text-gray-500">Systolic / diastolic / pulse</div>
                  </td>
                  {participants.map((participant) => {
                    const key = getParticipantKey(participant);
                    const draft = preCeremonyMatrix[key] || { systolic: '', diastolic: '', pulse: '' };
                    return (
                      <td key={`${key}-pre-bp`} className="min-w-[220px] border-b border-r border-gray-200 p-3 align-top">
                        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-1">
                          <input type="number" min="60" max="250" aria-label={`Systolic for ${getClientName(participant)}`} placeholder="SYS" value={draft.systolic} onChange={(event) => updatePreCeremonyDraft(participant, { systolic: event.target.value })} className="min-w-0 rounded-md border border-gray-300 px-2 py-2 text-center text-sm" />
                          <span className="font-semibold text-gray-500">/</span>
                          <input type="number" min="40" max="150" aria-label={`Diastolic for ${getClientName(participant)}`} placeholder="DIA" value={draft.diastolic} onChange={(event) => updatePreCeremonyDraft(participant, { diastolic: event.target.value })} className="min-w-0 rounded-md border border-gray-300 px-2 py-2 text-center text-sm" />
                        </div>
                        <input type="number" min="30" max="220" aria-label={`Pulse for ${getClientName(participant)}`} placeholder="Pulse (optional)" value={draft.pulse} onChange={(event) => updatePreCeremonyDraft(participant, { pulse: event.target.value })} className="mt-2 w-full rounded-md border border-gray-300 px-2 py-2 text-center text-sm" />
                      </td>
                    );
                  })}
                </tr>
                <tr className="bg-gray-50/40">
                  <td className="sticky left-0 z-10 border-b border-r border-gray-200 bg-gray-50 px-3 py-4 align-top text-sm font-semibold text-gray-900">
                    Pre-ceremony EKG
                    <div className="mt-1 text-xs font-normal text-gray-500">PDF or image</div>
                  </td>
                  {participants.map((participant) => {
                    const key = getParticipantKey(participant);
                    const draft = preCeremonyMatrix[key] || { systolic: '', diastolic: '', pulse: '' };
                    const existingEkg = getLatestPreCeremonyCheck(participant)?.preCeremonyEkg;
                    return (
                      <td key={`${key}-pre-ekg`} className="min-w-[220px] border-b border-r border-gray-200 p-3 align-top">
                        {existingEkg?.fileName && (
                          <button type="button" onClick={() => openFilePreview(participant, existingEkg.fileUrl, existingEkg.fileName)} className="mb-2 block max-w-full truncate text-sm font-semibold text-blue-700 hover:text-blue-900" title={existingEkg.fileName}>
                            View: {existingEkg.fileName}
                          </button>
                        )}
                        <label className="block cursor-pointer rounded-md border border-dashed border-indigo-300 bg-indigo-50 px-3 py-3 text-center text-sm font-medium text-indigo-700 hover:bg-indigo-100">
                          {draft.ekgFile ? 'Replace selected file' : existingEkg?.fileName ? 'Replace EKG' : 'Upload EKG'}
                          <input type="file" accept=".pdf,.jpg,.jpeg,.png,image/*,application/pdf" className="sr-only" onChange={(event) => void handlePreCeremonyEkgSelection(participant, event.target.files?.[0])} />
                        </label>
                        {draft.ekgFile && <div className="mt-2 truncate text-xs font-medium text-gray-700" title={draft.ekgFile.name}>{draft.ekgFile.name}</div>}
                      </td>
                    );
                  })}
                </tr>
                <tr className="bg-white">
                  <td className="sticky left-0 z-10 border-r border-gray-200 bg-white px-3 py-3 text-sm font-semibold text-gray-900">Completion</td>
                  {participants.map((participant) => {
                    const key = getParticipantKey(participant);
                    const draft = preCeremonyMatrix[key] || { systolic: '', diastolic: '', pulse: '' };
                    const check = getLatestPreCeremonyCheck(participant);
                    const hasBp = Boolean(draft.systolic && draft.diastolic);
                    const hasEkg = Boolean(draft.ekgFile || check?.preCeremonyEkg?.fileName || check?.preCeremonyEkg?.fileUrl);
                    return <td key={`${key}-pre-status`} className="border-r border-gray-200 px-3 py-3 text-center text-sm"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${hasBp && hasEkg ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>{hasBp && hasEkg ? 'BP + EKG ready' : `Missing ${[!hasBp ? 'BP' : '', !hasEkg ? 'EKG' : ''].filter(Boolean).join(' + ')}`}</span></td>;
                  })}
                </tr>
              </>
            )}
            {trackerView === 'post' && (
              <tr>
                <td colSpan={participants.length + 1} className="px-4 py-8 text-center text-sm text-gray-500">
                  Use the controls under each participant name above to manage post-ceremony EKG checks.
                </td>
              </tr>
            )}
          </tbody>
          {participants.length > 0 && trackerView !== 'pre' && (
            <tfoot>
              <tr className="bg-gray-50">
                <td className="sticky left-0 z-10 border-r border-gray-200 bg-gray-50 px-2 py-3 text-sm font-semibold text-gray-900">
                  Totals
                </td>
                {participants.map((participant) => (
                  <td key={`${participant._id}-total`} className="border-r border-gray-200 px-2 py-3 text-sm text-gray-700">
                    <div className="text-base font-bold text-gray-900">{participant.spoonsTaken || 0} spoons</div>
                    <div>{participant.purged ? `Purged ${participant.purgeTime || ''}` : 'No purge recorded'}</div>
                    {participant.purgeDetails && <div className="mt-1 whitespace-pre-wrap text-xs text-gray-500">{participant.purgeDetails}</div>}
                  </td>
                ))}
              </tr>
              {trackerView === 'spoons' && (
                <tr className="bg-white">
                  <td colSpan={participants.length + 1} className="border-t border-gray-200 px-2 py-3">
                    <Button size="small" icon={<Icon icon={Plus} className="h-4 w-4" />} onClick={addGridRow}>Add next row</Button>
                  </td>
                </tr>
              )}
            </tfoot>
          )}
        </table>
        {participants.length === 0 && !loading && (
          <div className="px-4 py-8 text-center text-sm text-gray-500">No participants found for this ceremony.</div>
        )}
      </div>

      {trackerView === 'pre' && participants.length > 0 && (
        <section className="mt-4 rounded-lg border border-indigo-200 bg-indigo-50/50 p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
            <label className="flex-1 text-sm font-semibold text-gray-800">
              Medical advisor
              <Select
                className="mt-1 w-full"
                value={selectedMedicalAdvisorId || undefined}
                placeholder="Select medical advisor"
                onChange={setSelectedMedicalAdvisorId}
                options={medicalAdvisors.map((advisor) => ({
                  value: advisor._id,
                  label: [advisor.firstName, advisor.lastName].filter(Boolean).join(' ') || advisor.email,
                }))}
              />
            </label>
            <label className="flex-1 text-sm font-semibold text-gray-800">
              MRR bucket
              <Select
                className="mt-1 w-full"
                value={selectedMedicalReviewBucketId || undefined}
                placeholder="Select review bucket"
                onChange={setSelectedMedicalReviewBucketId}
                options={medicalReviewBuckets.filter((bucket) => bucket._id).map((bucket) => ({
                  value: bucket._id!,
                  label: `${bucket.title}${bucket.reviewerName || bucket.reviewerEmail ? ` · ${bucket.reviewerName || bucket.reviewerEmail}` : ''}`,
                }))}
              />
            </label>
            <Button
              type="primary"
              icon={<Icon icon={FileText} className="h-4 w-4" />}
              onClick={createPreCeremonyMedicalReviews}
              loading={creatingMedicalReviews}
              disabled={!selectedMedicalAdvisorId || !selectedMedicalReviewBucketId || Object.values(preCeremonyDirty).some(Boolean)}
            >
              Create missing MRRs
            </Button>
          </div>
          <p className="mt-2 text-xs text-gray-600">
            Creates one review per saved pre-ceremony EKG or BP for Ceremony #{ceremony?.ceremonyNumber}. Existing MRRs are skipped.
          </p>
          {reviewCreationLog.length > 0 && (
            <div className="mt-4 overflow-x-auto rounded-md border border-gray-200 bg-white">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500"><tr><th className="px-3 py-2">Time</th><th className="px-3 py-2">Client</th><th className="px-3 py-2">Type</th><th className="px-3 py-2">MRR</th><th className="px-3 py-2">Bucket</th><th className="px-3 py-2">Result</th></tr></thead>
                <tbody className="divide-y divide-gray-100">
                  {reviewCreationLog.map((entry) => <tr key={entry.id}><td className="whitespace-nowrap px-3 py-2 text-gray-600">{entry.time}</td><td className="px-3 py-2 font-medium text-gray-900">{entry.client}</td><td className="px-3 py-2">{entry.type}</td><td className="px-3 py-2 font-semibold">{entry.requestNumber ? `#${entry.requestNumber}` : '—'}</td><td className="px-3 py-2">{entry.bucket || '—'}</td><td className={`px-3 py-2 font-medium ${entry.status === 'created' ? 'text-emerald-700' : entry.status === 'skipped' ? 'text-amber-700' : 'text-red-700'}`}>{entry.status.toUpperCase()} · {entry.detail}</td></tr>)}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {trackerView === 'spoons' && participants.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
          <Button type="primary" onClick={saveGrid} loading={saving} disabled={!hasGridChanges}>
            Save
          </Button>
          {hasGridChanges && (
            <Button onClick={discardGridChanges} disabled={saving}>Discard</Button>
          )}
        </div>
      )}

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
        title={medicalModalTitle}
        open={Boolean(medicalParticipant)}
        onCancel={() => {
          setMedicalParticipant(null);
          setEditingMedicalCheckId('');
          setMedicalCheckPhase('pre');
          setPreMedicalFormKind('ekg');
          setEkgUploadFile(null);
        }}
        onOk={() => medicalForm.submit()}
        confirmLoading={saving}
        width={680}
      >
        <Form form={medicalForm} layout="vertical" onFinish={saveMedicalCheck}>
          <Row gutter={16}>
            {showEkgFields && (
              <Col xs={24} md={12}>
                <Form.Item name="ekgApproved" label={`${medicalCheckPhase === 'pre' ? 'Pre' : 'Post'}-Ceremony EKG`}>
                  <Select>
                    <Select.Option value="pending">Pending</Select.Option>
                    <Select.Option value="approved">Approved</Select.Option>
                    <Select.Option value="rejected">Not Approved</Select.Option>
                  </Select>
                </Form.Item>
              </Col>
            )}
            {medicalCheckPhase === 'pre' && showMedicalClearanceFields && (
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

          {showEkgFields && (
            <>
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
            </>
          )}

          {showBpFields && (
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

          {medicalCheckPhase === 'post' && (
            <Form.Item name="medicalClearanceNotes" label="Post-Ceremony Notes">
              <Input.TextArea rows={3} placeholder="Post-ceremony EKG notes or follow-up instructions" />
            </Form.Item>
          )}
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
