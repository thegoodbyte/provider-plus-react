import React, { useState, useEffect } from 'react';
import { ceremoniesApi } from '../services/api';
import { CeremonyParticipant, Ceremony } from '../types';
import { Button, Modal, Form, Input, InputNumber, TimePicker, Select, message, Card, Statistic, Row, Col } from 'antd';
import { CheckCircleOutlined, ExclamationCircleOutlined, MedicineBoxOutlined } from '@ant-design/icons';
import moment from 'moment';

interface ParticipantTrackerProps {
  ceremonyId: string;
  onBack?: () => void;
}

const ParticipantTracker: React.FC<ParticipantTrackerProps> = ({ ceremonyId, onBack }) => {
  const [ceremony, setCeremony] = useState<Ceremony | null>(null);
  const [participants, setParticipants] = useState<CeremonyParticipant[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedParticipant, setSelectedParticipant] = useState<CeremonyParticipant | null>(null);
  const [actionModalVisible, setActionModalVisible] = useState(false);
  const [actionType, setActionType] = useState<'medical' | 'spoons' | 'purge' | 'notes'>('spoons');
  const [form] = Form.useForm();

  const getMedicalClearanceColor = (clearance: string) => {
    const colors: Record<string, string> = {
      approved: 'bg-green-100 text-green-800',
      not_approved: 'bg-red-100 text-red-800',
      conditional: 'bg-yellow-100 text-yellow-800',
      pending: 'bg-gray-100 text-gray-800'
    };
    return colors[clearance] || 'bg-gray-100 text-gray-800';
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      good: 'bg-green-100 text-green-800',
      needs_support: 'bg-yellow-100 text-yellow-800',
      monitoring: 'bg-orange-100 text-orange-800',
      medical_attention: 'bg-red-100 text-red-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getClientName = (participant: CeremonyParticipant) => {
    const client = participant.clientId as any;
    return client ? `${client.firstName || ''} ${client.lastName || ''}`.trim() : 'Unknown';
  };

  useEffect(() => {
    loadData();
  }, [ceremonyId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [ceremonyResponse, participantsResponse] = await Promise.all([
        ceremoniesApi.getOne(ceremonyId),
        ceremoniesApi.getParticipants(ceremonyId)
      ]);

      setCeremony(ceremonyResponse.data);
      setParticipants(participantsResponse.data);
    } catch (error) {
      message.error('Failed to load ceremony data');
      console.error('Error loading ceremony data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleActionClick = (participant: CeremonyParticipant, type: 'medical' | 'spoons' | 'purge' | 'notes') => {
    setSelectedParticipant(participant);
    setActionType(type);

    // Pre-populate form based on action type
    switch (type) {
      case 'medical':
        form.setFieldsValue({
          medicalClearance: participant.medicalClearance || 'pending',
          medicalClearanceNotes: participant.medicalClearanceNotes || '',
          systolic: participant.preCeremonyBloodPressure?.systolic || '',
          diastolic: participant.preCeremonyBloodPressure?.diastolic || '',
          pulse: participant.preCeremonyBloodPressure?.pulse || '',
        });
        break;
      case 'spoons':
        form.setFieldsValue({
          spoonsTaken: participant.spoonsTaken || 0,
          firstSpoonTime: participant.firstSpoonTime ? moment(participant.firstSpoonTime, 'HH:mm') : null,
          arrivalTime: participant.arrivalTime ? moment(participant.arrivalTime, 'HH:mm') : moment(),
        });
        break;
      case 'purge':
        form.setFieldsValue({
          purged: participant.purged || false,
          purgeTime: participant.purgeTime ? moment(participant.purgeTime, 'HH:mm') : null,
          purgeDetails: participant.purgeDetails || '',
        });
        break;
    }

    setActionModalVisible(true);
  };

  const handleSubmit = async (values: any) => {
    if (!selectedParticipant) return;

    try {
      let updateData: any = {};

      switch (actionType) {
        case 'medical':
          updateData = {
            medicalClearance: values.medicalClearance,
            medicalClearanceNotes: values.medicalClearanceNotes,
            preCeremonyBloodPressure: {
              systolic: values.systolic,
              diastolic: values.diastolic,
              pulse: values.pulse,
              recordedAt: new Date(),
              approved: values.medicalClearance === 'approved',
            }
          };
          await ceremoniesApi.updateMedicalCheck(selectedParticipant._id!, updateData);
          break;

        case 'spoons':
          updateData = {
            spoonsTaken: values.spoonsTaken,
            firstSpoonTime: values.firstSpoonTime?.format('HH:mm'),
            arrivalTime: values.arrivalTime?.format('HH:mm'),
          };
          await ceremoniesApi.recordSpoonIntake(selectedParticipant._id!, updateData);
          break;

        case 'purge':
          updateData = {
            purged: values.purged,
            purgeTime: values.purgeTime?.format('HH:mm'),
            purgeDetails: values.purgeDetails,
          };
          await ceremoniesApi.recordPurge(selectedParticipant._id!, updateData);
          break;
      }

      message.success('Updated successfully');
      setActionModalVisible(false);
      loadData(); // Refresh data
    } catch (error) {
      message.error('Failed to update participant data');
      console.error('Error updating participant:', error);
    }
  };

  const getStats = () => {
    const total = participants.length;
    const arrived = participants.filter(p => p.arrivalTime).length;
    const medicalApproved = participants.filter(p => p.medicalClearance === 'approved').length;
    const tookSpoons = participants.filter(p => p.spoonsTaken && p.spoonsTaken > 0).length;
    const purged = participants.filter(p => p.purged).length;

    return { total, arrived, medicalApproved, tookSpoons, purged };
  };

  const stats = getStats();

  if (loading) {
    return (
      <div style={{ padding: '50px', textAlign: 'center' }}>
        <div style={{ fontSize: '48px', marginBottom: '20px' }}>⏳</div>
        <p>Loading ceremony tracker...</p>
      </div>
    );
  }

  return (
    <div style={{ padding: '24px' }}>
      {onBack && (
        <Button onClick={onBack} style={{ marginBottom: '16px' }}>
          ← Back to Ceremonies
        </Button>
      )}

      <div style={{ marginBottom: '24px' }}>
        <h1>🔮 Ceremony Participant Tracker</h1>
        <p>
          <strong>Ceremony #{ceremony?.ceremonyNumber}</strong> - {ceremony?.date ? moment(ceremony.date).format('MMMM DD, YYYY') : 'Date TBD'}
        </p>
      </div>

      {/* Stats Dashboard */}
      <Row gutter={16} style={{ marginBottom: '24px' }}>
        <Col span={4}>
          <Card>
            <Statistic
              title="Total Participants"
              value={stats.total}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic
              title="Arrived"
              value={stats.arrived}
              suffix={`/ ${stats.total}`}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic
              title="Medical Approved"
              value={stats.medicalApproved}
              suffix={`/ ${stats.total}`}
              valueStyle={{ color: stats.medicalApproved === stats.total ? '#52c41a' : '#faad14' }}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic
              title="Took Medicine"
              value={stats.tookSpoons}
              suffix={`/ ${stats.total}`}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic
              title="Purged"
              value={stats.purged}
              suffix={`/ ${stats.tookSpoons}`}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic
              title="Ceremony Time"
              value={moment().format('HH:mm')}
              valueStyle={{ color: '#13c2c2' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Participants Table */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Client
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Arrived
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Medical Clearance
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Spoons
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  First Spoon
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Purged
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {participants.map((participant) => (
                <tr key={participant._id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {getClientName(participant)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {participant.arrivalTime ? moment(participant.arrivalTime, 'HH:mm').format('HH:mm') : '⏳ Not yet'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getMedicalClearanceColor(participant.medicalClearance || 'pending')}`}>
                      {(participant.medicalClearance || 'pending').replace('_', ' ').toUpperCase()}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-blue-600">
                    {participant.spoonsTaken || 0}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {participant.firstSpoonTime ? moment(participant.firstSpoonTime, 'HH:mm').format('HH:mm') : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {participant.purged === true ? '✅ Yes' :
                     participant.purged === false ? '❌ No' :
                     '⏳ Pending'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {participant.postCeremonyStatus ? (
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(participant.postCeremonyStatus)}`}>
                        {participant.postCeremonyStatus.replace('_', ' ').toUpperCase()}
                      </span>
                    ) : (
                      <span className="text-gray-500">⏳ In progress</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                      <Button
                        size="small"
                        onClick={() => handleActionClick(participant, 'medical')}
                        icon={<MedicineBoxOutlined />}
                      >
                        Medical
                      </Button>
                      <Button
                        size="small"
                        onClick={() => handleActionClick(participant, 'spoons')}
                        type="primary"
                      >
                        Spoons
                      </Button>
                      <Button
                        size="small"
                        onClick={() => handleActionClick(participant, 'purge')}
                        danger={!participant.purged}
                      >
                        Purge
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {participants.length === 0 && !loading && (
            <div className="text-center py-8 text-gray-500">
              No participants found
            </div>
          )}
          {loading && (
            <div className="text-center py-8 text-gray-500">
              Loading participants...
            </div>
          )}
        </div>
      </div>

      {/* Action Modal */}
      <Modal
        title={
          actionType === 'medical' ? '🩺 Medical Check' :
          actionType === 'spoons' ? '🥄 Record Medicine Intake' :
          actionType === 'purge' ? '🤮 Record Purging' :
          '📝 Add Notes'
        }
        open={actionModalVisible}
        onCancel={() => setActionModalVisible(false)}
        onOk={() => form.submit()}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
        >
          {actionType === 'medical' && (
            <>
              <Row gutter={16}>
                <Col span={8}>
                  <Form.Item name="systolic" label="Systolic BP">
                    <InputNumber placeholder="120" min={70} max={200} />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="diastolic" label="Diastolic BP">
                    <InputNumber placeholder="80" min={40} max={120} />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="pulse" label="Pulse (BPM)">
                    <InputNumber placeholder="72" min={40} max={150} />
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item name="medicalClearance" label="Medical Clearance">
                <Select>
                  <Select.Option value="pending">Pending Review</Select.Option>
                  <Select.Option value="approved">Approved</Select.Option>
                  <Select.Option value="conditional">Conditional Approval</Select.Option>
                  <Select.Option value="not_approved">Not Approved</Select.Option>
                </Select>
              </Form.Item>

              <Form.Item name="medicalClearanceNotes" label="Notes">
                <Input.TextArea rows={3} placeholder="Medical advisor notes..." />
              </Form.Item>
            </>
          )}

          {actionType === 'spoons' && (
            <>
              <Form.Item name="arrivalTime" label="Arrival Time">
                <TimePicker format="HH:mm" style={{ width: '100%' }} />
              </Form.Item>

              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item name="spoonsTaken" label="Total Spoons Taken">
                    <InputNumber min={0} max={10} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="firstSpoonTime" label="First Spoon Time">
                    <TimePicker format="HH:mm" style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
              </Row>
            </>
          )}

          {actionType === 'purge' && (
            <>
              <Form.Item name="purged" label="Has Purged">
                <Select>
                  <Select.Option value={false}>No</Select.Option>
                  <Select.Option value={true}>Yes</Select.Option>
                </Select>
              </Form.Item>

              <Form.Item name="purgeTime" label="Purge Time">
                <TimePicker format="HH:mm" style={{ width: '100%' }} />
              </Form.Item>

              <Form.Item name="purgeDetails" label="Purge Details">
                <Input.TextArea
                  rows={3}
                  placeholder="Details about purging (frequency, intensity, etc.)"
                />
              </Form.Item>
            </>
          )}
        </Form>
      </Modal>
    </div>
  );
};

export default ParticipantTracker;