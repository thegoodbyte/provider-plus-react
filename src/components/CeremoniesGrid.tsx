import React, { useState, useEffect } from 'react';
import { ceremoniesApi } from '../services/api';
import { Ceremony } from '../types';
import { Button, Modal, Form, Input, DatePicker, TimePicker, Select, message, Popconfirm } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, ClockCircleOutlined } from '@ant-design/icons';
import moment from 'moment';
import ParticipantTracker from './ParticipantTracker';

interface CeremoniesGridProps {
  retreatId: string;
}

const CeremoniesGrid: React.FC<CeremoniesGridProps> = ({ retreatId }) => {
  const [ceremonies, setCeremonies] = useState<Ceremony[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingCeremony, setEditingCeremony] = useState<Ceremony | null>(null);
  const [trackingCeremonyId, setTrackingCeremonyId] = useState<string | null>(null);
  const [form] = Form.useForm();

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      scheduled: 'bg-blue-100 text-blue-800',
      in_progress: 'bg-yellow-100 text-yellow-800',
      completed: 'bg-green-100 text-green-800',
      cancelled: 'bg-red-100 text-red-800'
    };
    return colors[status] || 'bg-blue-100 text-blue-800';
  };

  const formatDate = (date: string | Date) => {
    if (!date) return '';
    return moment(date).format('MM/DD/YYYY');
  };

  const formatOrdinal = (value?: number) => {
    if (!value) return 'N/A';
    const suffix = value % 100 >= 11 && value % 100 <= 13
      ? 'th'
      : ({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[value % 10] || 'th';
    return `${value}${suffix}`;
  };

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

  const handleAdd = () => {
    form.resetFields();
    setEditingCeremony(null);
    const nextCeremonyNumber = ceremonies.reduce((max, ceremony) => Math.max(max, Number(ceremony.ceremonyNumber) || 0), 0) + 1;
    form.setFieldsValue({ ceremonyNumber: nextCeremonyNumber });
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
        <button
          onClick={handleAdd}
          style={{
            background: 'transparent',
            border: '1px solid #d9d9d9',
            borderRadius: '4px',
            padding: '4px 12px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minWidth: '32px',
            height: '32px',
            transition: 'all 0.3s'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = '#40a9ff';
            e.currentTarget.style.color = '#40a9ff';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = '#d9d9d9';
            e.currentTarget.style.color = 'inherit';
          }}
          title="Add Ceremony"
        >
          <PlusOutlined />
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Ceremony #
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Start Time
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  End Time
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Medical Approval
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Medical Checks
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {ceremonies.map((ceremony) => (
                <tr key={ceremony._id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {formatOrdinal(ceremony.ceremonyNumber)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatDate(ceremony.date)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {ceremony.startTime}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {ceremony.endTime}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(ceremony.status || 'scheduled')}`}>
                      {(ceremony.status || 'scheduled').replace('_', ' ').toUpperCase()}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {ceremony.medicalAdvisorApproval === true ? '✅ Approved' :
                     ceremony.medicalAdvisorApproval === false ? '❌ Not Approved' :
                     '⏳ Pending'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {ceremony.medicalChecksCompleted ? '✅ Complete' : '⏳ Pending'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                      <Button
                        type="primary"
                        icon={<ClockCircleOutlined />}
                        onClick={() => setTrackingCeremonyId(ceremony._id!)}
                        size="small"
                        title="Track spoons and time"
                      >
                        Track spoons & time
                      </Button>
                      <Button
                        type="text"
                        icon={<EditOutlined />}
                        onClick={() => handleEdit(ceremony)}
                        size="small"
                        title="Edit Ceremony"
                      />
                      <Popconfirm
                        title="Are you sure you want to delete this ceremony?"
                        onConfirm={() => handleDelete(ceremony._id!)}
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
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {ceremonies.length === 0 && !loading && (
            <div className="text-center py-8 text-gray-500">
              No ceremonies found
            </div>
          )}
          {loading && (
            <div className="text-center py-8 text-gray-500">
              Loading ceremonies...
            </div>
          )}
        </div>
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
            label="Internal Ceremony Number"
            rules={[{ required: true, message: 'Please enter ceremony number' }]}
          >
            <Input type="number" min={1} placeholder="1st, 2nd, 3rd..." />
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
