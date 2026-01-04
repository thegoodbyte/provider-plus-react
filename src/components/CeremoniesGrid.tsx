import React, { useState, useEffect } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-community';
import { ceremoniesApi } from '../services/api';
import { Ceremony } from '../types';
import { Button, Modal, Form, Input, DatePicker, TimePicker, Select, message, Popconfirm } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, UserOutlined } from '@ant-design/icons';
import moment from 'moment';
import ParticipantTracker from './ParticipantTracker';

interface CeremoniesGridProps {
  retreatId: string;
}

const CeremoniesGrid: React.FC<CeremoniesGridProps> = ({ retreatId }) => {
  const [ceremonies, setCeremonies] = useState<Ceremony[]>([]);
  const [loading, setLoading] = useState(false);
  const [gridApi, setGridApi] = useState<GridApi | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingCeremony, setEditingCeremony] = useState<Ceremony | null>(null);
  const [trackingCeremonyId, setTrackingCeremonyId] = useState<string | null>(null);
  const [form] = Form.useForm();

  const columnDefs: ColDef[] = [
    {
      headerName: 'Ceremony #',
      field: 'ceremonyNumber',
      width: 120,
      sortable: true
    },
    {
      headerName: 'Date',
      field: 'date',
      width: 120,
      sortable: true,
      valueFormatter: (params) => {
        if (!params.value) return '';
        return moment(params.value).format('MM/DD/YYYY');
      }
    },
    {
      headerName: 'Start Time',
      field: 'startTime',
      width: 120,
      sortable: true
    },
    {
      headerName: 'End Time',
      field: 'endTime',
      width: 120,
      sortable: true
    },
    {
      headerName: 'Status',
      field: 'status',
      width: 130,
      sortable: true,
      cellRenderer: (params: any) => {
        const status = params.value || 'scheduled';
        const statusColors = {
          scheduled: '#1890ff',
          in_progress: '#faad14',
          completed: '#52c41a',
          cancelled: '#ff4d4f'
        };
        return (
          <span style={{
            color: statusColors[status as keyof typeof statusColors],
            fontWeight: 'bold'
          }}>
            {status.replace('_', ' ').toUpperCase()}
          </span>
        );
      }
    },
    {
      headerName: 'Medical Approval',
      field: 'medicalAdvisorApproval',
      width: 150,
      cellRenderer: (params: any) => {
        if (params.value === true) return '✅ Approved';
        if (params.value === false) return '❌ Not Approved';
        return '⏳ Pending';
      }
    },
    {
      headerName: 'Medical Checks',
      field: 'medicalChecksCompleted',
      width: 150,
      cellRenderer: (params: any) => {
        return params.value ? '✅ Complete' : '⏳ Pending';
      }
    },
    {
      headerName: 'Actions',
      field: 'actions',
      width: 140,
      cellRenderer: (params: any) => (
        <div style={{ display: 'flex', gap: '4px' }}>
          <Button
            type="text"
            icon={<UserOutlined />}
            onClick={() => setTrackingCeremonyId(params.data._id)}
            size="small"
            title="Track Participants"
          />
          <Button
            type="text"
            icon={<EditOutlined />}
            onClick={() => handleEdit(params.data)}
            size="small"
            title="Edit Ceremony"
          />
          <Popconfirm
            title="Are you sure you want to delete this ceremony?"
            onConfirm={() => handleDelete(params.data._id)}
            okText="Yes"
            cancelText="No"
          >
            <Button
              type="text"
              icon={<DeleteOutlined />}
              danger
              size="small"
              title="Delete Ceremony"
            />
          </Popconfirm>
        </div>
      )
    }
  ];

  useEffect(() => {
    loadCeremonies();
  }, [retreatId]);

  const loadCeremonies = async () => {
    try {
      setLoading(true);
      const response = await ceremoniesApi.getByRetreat(retreatId);
      setCeremonies(response.data);
    } catch (error) {
      message.error('Failed to load ceremonies');
      console.error('Error loading ceremonies:', error);
    } finally {
      setLoading(false);
    }
  };

  const onGridReady = (params: GridReadyEvent) => {
    setGridApi(params.api);
    params.api.sizeColumnsToFit();
  };

  const handleAdd = () => {
    form.resetFields();
    setEditingCeremony(null);
    setModalVisible(true);
  };

  const handleEdit = (ceremony: Ceremony) => {
    setEditingCeremony(ceremony);
    form.setFieldsValue({
      ...ceremony,
      date: ceremony.date ? moment(ceremony.date) : null,
      startTime: ceremony.startTime ? moment(ceremony.startTime, 'HH:mm') : null,
      endTime: ceremony.endTime ? moment(ceremony.endTime, 'HH:mm') : null
    });
    setModalVisible(true);
  };

  const handleDelete = async (id: string) => {
    try {
      await ceremoniesApi.delete(id);
      message.success('Ceremony deleted successfully');
      loadCeremonies();
    } catch (error) {
      message.error('Failed to delete ceremony');
      console.error('Error deleting ceremony:', error);
    }
  };

  const handleSubmit = async (values: any) => {
    try {
      const ceremonyData = {
        ...values,
        retreatId,
        date: values.date?.format('YYYY-MM-DD'),
        startTime: values.startTime?.format('HH:mm'),
        endTime: values.endTime?.format('HH:mm')
      };

      if (editingCeremony) {
        await ceremoniesApi.update(editingCeremony._id!, ceremonyData);
        message.success('Ceremony updated successfully');
      } else {
        await ceremoniesApi.create(ceremonyData);
        message.success('Ceremony created successfully');
      }

      setModalVisible(false);
      loadCeremonies();
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Failed to save ceremony');
      console.error('Error saving ceremony:', error);
    }
  };

  // If tracking a ceremony, show the tracker
  if (trackingCeremonyId) {
    return (
      <ParticipantTracker
        ceremonyId={trackingCeremonyId}
        onBack={() => setTrackingCeremonyId(null)}
      />
    );
  }

  return (
    <div style={{ height: 500 }}>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3>Ceremonies</h3>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={handleAdd}
        >
          Add Ceremony
        </Button>
      </div>

      <div className="ag-theme-alpine" style={{ height: '100%', width: '100%' }}>
        <AgGridReact
          columnDefs={columnDefs}
          rowData={ceremonies}
          onGridReady={onGridReady}
          loading={loading}
          animateRows={true}
        />
      </div>

      <Modal
        title={editingCeremony ? 'Edit Ceremony' : 'Add New Ceremony'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={() => form.submit()}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
        >
          <Form.Item
            name="ceremonyNumber"
            label="Ceremony Number"
            rules={[{ required: true, message: 'Please enter ceremony number' }]}
          >
            <Input type="number" placeholder="Enter ceremony number" />
          </Form.Item>

          <Form.Item
            name="date"
            label="Date"
            rules={[{ required: true, message: 'Please select date' }]}
          >
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>

          <div style={{ display: 'flex', gap: 16 }}>
            <Form.Item
              name="startTime"
              label="Start Time"
              style={{ flex: 1 }}
            >
              <TimePicker format="HH:mm" style={{ width: '100%' }} />
            </Form.Item>

            <Form.Item
              name="endTime"
              label="End Time"
              style={{ flex: 1 }}
            >
              <TimePicker format="HH:mm" style={{ width: '100%' }} />
            </Form.Item>
          </div>

          <Form.Item
            name="status"
            label="Status"
            initialValue="scheduled"
          >
            <Select>
              <Select.Option value="scheduled">Scheduled</Select.Option>
              <Select.Option value="in_progress">In Progress</Select.Option>
              <Select.Option value="completed">Completed</Select.Option>
              <Select.Option value="cancelled">Cancelled</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="majorNotes"
            label="Major Notes"
          >
            <Input.TextArea rows={3} placeholder="Enter major notes about the ceremony" />
          </Form.Item>

          <Form.Item
            name="spiritualVerificationNotes"
            label="Spiritual Verification Notes"
          >
            <Input.TextArea rows={3} placeholder="Enter spiritual verification notes" />
          </Form.Item>

          <div style={{ display: 'flex', gap: 16 }}>
            <Form.Item
              name="medicalChecksCompleted"
              label="Medical Checks Completed"
              valuePropName="checked"
              style={{ flex: 1 }}
            >
              <Select>
                <Select.Option value={true}>Yes</Select.Option>
                <Select.Option value={false}>No</Select.Option>
              </Select>
            </Form.Item>

            <Form.Item
              name="medicalAdvisorApproval"
              label="Medical Advisor Approval"
              style={{ flex: 1 }}
            >
              <Select>
                <Select.Option value={true}>Approved</Select.Option>
                <Select.Option value={false}>Not Approved</Select.Option>
                <Select.Option value={null}>Pending</Select.Option>
              </Select>
            </Form.Item>
          </div>

          <Form.Item
            name="medicalAdvisorName"
            label="Medical Advisor Name"
          >
            <Input placeholder="Enter medical advisor name" />
          </Form.Item>

          <Form.Item
            name="medicalAdvisorNotes"
            label="Medical Advisor Notes"
          >
            <Input.TextArea rows={3} placeholder="Enter medical advisor notes" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default CeremoniesGrid;