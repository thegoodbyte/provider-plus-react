import React, { useState, useEffect } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-community';
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
  const [gridApi, setGridApi] = useState<GridApi | null>(null);
  const [selectedParticipant, setSelectedParticipant] = useState<CeremonyParticipant | null>(null);
  const [actionModalVisible, setActionModalVisible] = useState(false);
  const [actionType, setActionType] = useState<'medical' | 'spoons' | 'purge' | 'notes'>('spoons');
  const [form] = Form.useForm();

  const columnDefs: ColDef[] = [
    {
      headerName: 'Client',
      field: 'clientId.firstName',
      width: 150,
      valueFormatter: (params) => {
        const client = params.data.clientId;
        return client ? `${client.firstName || ''} ${client.lastName || ''}`.trim() : 'Unknown';
      }
    },
    {
      headerName: 'Arrived',
      field: 'arrivalTime',
      width: 100,
      cellRenderer: (params: any) => {
        return params.value ? moment(params.value, 'HH:mm').format('HH:mm') : '⏳ Not yet';
      }
    },
    {
      headerName: 'Medical Clearance',
      field: 'medicalClearance',
      width: 150,
      cellRenderer: (params: any) => {
        const clearance = params.value || 'pending';
        const colors = {
          approved: '#52c41a',
          not_approved: '#ff4d4f',
          conditional: '#faad14',
          pending: '#8c8c8c'
        };
        return `<span style="color: ${colors[clearance as keyof typeof colors]}; font-weight: bold;">
          ${clearance.replace('_', ' ').toUpperCase()}
        </span>`;
      }
    },
    {
      headerName: 'Spoons',
      field: 'spoonsTaken',
      width: 80,
      cellRenderer: (params: any) => {
        const count = params.value || 0;
        return `<span style="font-weight: bold; color: #1890ff;">${count}</span>`;
      }
    },
    {
      headerName: 'First Spoon',
      field: 'firstSpoonTime',
      width: 110,
      cellRenderer: (params: any) => {
        return params.value ? moment(params.value, 'HH:mm').format('HH:mm') : '-';
      }
    },
    {
      headerName: 'Purged',
      field: 'purged',
      width: 80,
      cellRenderer: (params: any) => {
        if (params.value === true) return '✅ Yes';
        if (params.value === false) return '❌ No';
        return '⏳ Pending';
      }
    },
    {
      headerName: 'Status',
      field: 'postCeremonyStatus',
      width: 120,
      cellRenderer: (params: any) => {
        const status = params.value;
        if (!status) return '⏳ In progress';

        const statusColors = {
          good: '#52c41a',
          needs_support: '#faad14',
          monitoring: '#ff7875',
          medical_attention: '#ff4d4f'
        };

        return `<span style="color: ${statusColors[status as keyof typeof statusColors]}; font-weight: bold;">
          ${status.replace('_', ' ').toUpperCase()}
        </span>`;
      }
    },
    {
      headerName: 'Actions',
      field: 'actions',
      width: 200,
      cellRenderer: (params: any) => (
        <div style={{ display: 'flex', gap: '4px', height: '100%', alignItems: 'center' }}>
          <Button
            size="small"
            onClick={() => handleActionClick(params.data, 'medical')}
            icon={<MedicineBoxOutlined />}
          >
            Medical
          </Button>
          <Button
            size="small"
            onClick={() => handleActionClick(params.data, 'spoons')}
            type="primary"
          >
            Spoons
          </Button>
          <Button
            size="small"
            onClick={() => handleActionClick(params.data, 'purge')}
            danger={!params.data.purged}
          >
            Purge
          </Button>
        </div>
      )
    }
  ];

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

  const onGridReady = (params: GridReadyEvent) => {
    setGridApi(params.api);
    params.api.sizeColumnsToFit();
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

      {/* Participants Grid */}
      <div className="ag-theme-alpine" style={{ height: 500, width: '100%' }}>
        <AgGridReact
          columnDefs={columnDefs}
          rowData={participants}
          onGridReady={onGridReady}
          loading={loading}
          animateRows={true}
          rowHeight={50}
        />
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