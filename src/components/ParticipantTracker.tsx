import React, { useEffect, useMemo, useState } from 'react';
import { bookingsApi, ceremoniesApi } from '../services/api';
import { Ceremony, CeremonyParticipant, RetreatClient } from '../types';
import { Button, Card, Col, Form, Input, InputNumber, Modal, Row, Select, Statistic, TimePicker, message } from 'antd';
import { Activity, ArrowLeft, Clock3, Plus, Trash2 } from 'lucide-react';
import moment from 'moment';

interface ParticipantTrackerProps {
  ceremonyId: string;
  onBack?: () => void;
}

type CeremonyEvent = NonNullable<CeremonyParticipant['eventLog']>[number];
type EventType = CeremonyEvent['eventType'];

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

const ParticipantTracker: React.FC<ParticipantTrackerProps> = ({ ceremonyId, onBack }) => {
  const [ceremony, setCeremony] = useState<Ceremony | null>(null);
  const [participants, setParticipants] = useState<CeremonyParticipant[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedParticipant, setSelectedParticipant] = useState<CeremonyParticipant | null>(null);
  const [medicalParticipant, setMedicalParticipant] = useState<CeremonyParticipant | null>(null);
  const [editingEventId, setEditingEventId] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [addingRow, setAddingRow] = useState(false);
  const [rowTime, setRowTime] = useState(moment().format('HH:mm'));
  const [rowInputs, setRowInputs] = useState<Record<string, string>>({});
  const [form] = Form.useForm();
  const [medicalForm] = Form.useForm();

  useEffect(() => {
    loadData();
  }, [ceremonyId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [ceremonyResponse, participantsResponse] = await Promise.all([
        ceremoniesApi.getOne(ceremonyId),
        ceremoniesApi.getParticipants(ceremonyId),
      ]);
      let nextParticipants = participantsResponse.data || [];

      if (nextParticipants.length === 0) {
        const retreatId = getObjectId(ceremonyResponse.data.retreatId);
        if (retreatId) {
          const bookingsResponse = await bookingsApi.getByRetreatWithDetails(retreatId);
          nextParticipants = ((bookingsResponse.data || []) as RetreatClient[])
            .map((booking: RetreatClient) => participantFromBooking(ceremonyResponse.data, booking))
            .filter(Boolean) as CeremonyParticipant[];
        }
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

  const openMedicalModal = (participant: CeremonyParticipant) => {
    setMedicalParticipant(participant);
    medicalForm.setFieldsValue({
      ekgApproved: participant.preCeremonyEkg?.approved === undefined ? 'pending' : participant.preCeremonyEkg.approved ? 'approved' : 'rejected',
      ekgNotes: participant.preCeremonyEkg?.notes || '',
      systolic: participant.preCeremonyBloodPressure?.systolic,
      diastolic: participant.preCeremonyBloodPressure?.diastolic,
      pulse: participant.preCeremonyBloodPressure?.pulse,
      bpApproved: participant.preCeremonyBloodPressure?.approved === undefined ? 'pending' : participant.preCeremonyBloodPressure.approved ? 'approved' : 'rejected',
      bpNotes: participant.preCeremonyBloodPressure?.notes || '',
      medicalClearance: participant.medicalClearance || 'pending',
      medicalClearanceNotes: participant.medicalClearanceNotes || '',
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
      await ceremoniesApi.updateMedicalCheck(participantToUpdate._id!, {
        preCeremonyEkg: {
          approved: values.ekgApproved === 'pending' ? undefined : values.ekgApproved === 'approved',
          notes: values.ekgNotes || '',
          reviewedAt: values.ekgApproved && values.ekgApproved !== 'pending' ? new Date().toISOString() : undefined,
        },
        preCeremonyBloodPressure: {
          systolic: values.systolic ? Number(values.systolic) : undefined,
          diastolic: values.diastolic ? Number(values.diastolic) : undefined,
          pulse: values.pulse ? Number(values.pulse) : undefined,
          approved: values.bpApproved === 'pending' ? undefined : values.bpApproved === 'approved',
          notes: values.bpNotes || '',
          recordedAt: new Date().toISOString(),
        },
        medicalClearance: values.medicalClearance || 'pending',
        medicalClearanceNotes: values.medicalClearanceNotes || '',
      });
      message.success('Pre-ceremony medical check saved');
      setMedicalParticipant(null);
      await loadData();
    } catch (error) {
      message.error('Failed to save pre-ceremony medical check');
      console.error('Error saving pre-ceremony medical check:', error);
    } finally {
      setSaving(false);
    }
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
          <Button type="primary" icon={<Icon icon={Plus} className="h-4 w-4" />} onClick={startRowAdd} disabled={addingRow || participants.length === 0}>
            Add spoons
          </Button>
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

      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="min-w-[1100px] w-full border-collapse">
          <thead>
            <tr className="bg-gray-50">
              <th className="sticky left-0 z-10 w-28 border-b border-r border-gray-200 bg-gray-50 px-3 py-3 text-left text-xs font-semibold uppercase text-gray-500">Time</th>
              {participants.map((participant) => (
                <th key={participant._id} className="min-w-[220px] border-b border-r border-gray-200 px-3 py-3 text-left align-top">
                  <div className="text-sm font-semibold text-gray-900">{getClientName(participant)}</div>
                  <div className="mt-1 text-xs text-gray-500">
                    {participant.spoonsTaken || 0} spoons
                    {participant.purged ? ` - purged ${participant.purgeTime || ''}` : ''}
                  </div>
                  <Button size="small" type="link" className="mt-1 p-0" onClick={() => openMedicalModal(participant)}>
                    <span className="inline-flex items-center gap-1">
                      <Icon icon={Activity} className="h-3.5 w-3.5" />
                      Pre-ceremony
                    </span>
                  </Button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {addingRow && (
              <tr className="bg-blue-50">
                <td className="sticky left-0 z-10 border-b border-r border-blue-200 bg-blue-50 px-3 py-3 align-top">
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
            {timeRows.map((time) => (
              <tr key={time} className="hover:bg-gray-50">
                <td className="sticky left-0 z-10 border-b border-r border-gray-200 bg-white px-3 py-3 text-sm font-semibold text-gray-900">{time}</td>
                {participants.map((participant) => (
                  <td key={`${participant._id}-${time}`} className="border-b border-r border-gray-200 p-2 align-top">
                    <div className="space-y-2">
                      {eventsAtTime(participant, time).map((event) => (
                        <div key={event.id || `${event.time}-${event.eventType}`} className={`rounded-md border px-2 py-2 text-xs ${eventTypeStyles[event.eventType]}`}>
                          <div className="flex items-start justify-between gap-2">
                            <button type="button" onClick={() => openEventModal(participant, event)} className="text-left font-semibold">
                              {eventTypeLabels[event.eventType]}
                            </button>
                            <button type="button" onClick={() => deleteEvent(participant, event.id)} className="text-gray-500 hover:text-red-600" title="Delete event">
                              <Icon icon={Trash2} className="h-3.5 w-3.5" />
                            </button>
                          </div>
                          <div className="mt-1 whitespace-pre-wrap">{getEventSummary(event)}</div>
                        </div>
                      ))}
                    </div>
                  </td>
                ))}
              </tr>
            ))}
            {timeRows.length === 0 && (
              <tr>
                <td colSpan={participants.length + 1} className="px-4 py-8 text-center text-sm text-gray-500">
                  {loading ? 'Loading participants...' : 'No spoon rows recorded yet. Use Add spoons to create a row.'}
                </td>
              </tr>
            )}
          </tbody>
          {participants.length > 0 && (
            <tfoot>
              <tr className="bg-gray-50">
                <td className="sticky left-0 z-10 border-r border-gray-200 bg-gray-50 px-3 py-3 text-sm font-semibold text-gray-900">Totals</td>
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
        title={`Pre-Ceremony Medical - ${medicalParticipant ? getClientName(medicalParticipant) : ''}`}
        open={Boolean(medicalParticipant)}
        onCancel={() => setMedicalParticipant(null)}
        onOk={() => medicalForm.submit()}
        confirmLoading={saving}
        width={680}
      >
        <Form form={medicalForm} layout="vertical" onFinish={saveMedicalCheck}>
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item name="ekgApproved" label="Pre-Ceremony EKG">
                <Select>
                  <Select.Option value="pending">Pending</Select.Option>
                  <Select.Option value="approved">Approved</Select.Option>
                  <Select.Option value="rejected">Not Approved</Select.Option>
                </Select>
              </Form.Item>
            </Col>
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
          </Row>

          <Form.Item name="ekgNotes" label="EKG Notes">
            <Input.TextArea rows={2} placeholder="EKG observations or medical advisor notes" />
          </Form.Item>

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

          <Form.Item name="medicalClearanceNotes" label="Clearance Notes">
            <Input.TextArea rows={3} placeholder="Overall pre-ceremony medical clearance notes" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default ParticipantTracker;
