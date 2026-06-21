import React, { useState, useEffect } from 'react';
import { ceremoniesApi } from '../services/api';
import { Ceremony, Retreat } from '../types';
import { Button, Modal, Form, Input, DatePicker, TimePicker, Select, message } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, ClockCircleOutlined } from '@ant-design/icons';
import moment from 'moment';
import ParticipantTracker from './ParticipantTracker';

interface CeremoniesGridProps {
  retreatId?: string;
  retreats?: Retreat[];
}

type CeremonyFullTab = 'med_prep' | 'spiritual' | 'spoons' | 'post';

const getRetreatCode = (retreat?: Retreat | null) => {
  if (!retreat) return 'No retreat linked';
  return retreat.code || retreat.retreatCode || retreat.name || 'Retreat';
};

const getObjectId = (value: unknown): string => {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && value !== null && '_id' in value) {
    return String((value as { _id?: string })._id || '');
  }
  return '';
};

const CeremoniesGrid: React.FC<CeremoniesGridProps> = ({ retreatId, retreats = [] }) => {
  const [ceremonies, setCeremonies] = useState<Ceremony[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingCeremony, setEditingCeremony] = useState<Ceremony | null>(null);
  const [trackingCeremonyId, setTrackingCeremonyId] = useState<string | null>(null);
  const [activeFullTab, setActiveFullTab] = useState<CeremonyFullTab>('med_prep');
  const [spiritualNotes, setSpiritualNotes] = useState('');
  const [savingSpiritualNotes, setSavingSpiritualNotes] = useState(false);
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
      const response = retreatId
        ? await ceremoniesApi.getByRetreat(retreatId)
        : await ceremoniesApi.getAll();
      setCeremonies(response.data);
    } catch (error) {
      message.error('Failed to load ceremonies');
      console.error('Error loading ceremonies:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async () => {
    form.resetFields();
    setEditingCeremony(null);
    let allCeremonies = ceremonies;
    try {
      const response = await ceremoniesApi.getAll();
      allCeremonies = response.data;
    } catch (error) {
      console.error('Error loading all ceremonies for next ceremony number:', error);
    }
    const nextCeremonyNumber = allCeremonies.reduce((max, ceremony) => Math.max(max, Number(ceremony.ceremonyNumber) || 0), 0) + 1;
    form.setFieldsValue({ ceremonyNumber: nextCeremonyNumber, retreatId: retreatId || undefined });
    setModalVisible(true);
  };

  const openFullView = (ceremony: Ceremony, tab: CeremonyFullTab = 'med_prep') => {
    setTrackingCeremonyId(ceremony._id!);
    setActiveFullTab(tab);
    setSpiritualNotes(ceremony.spiritualVerificationNotes || '');
  };

  const handleEdit = (ceremony: Ceremony) => {
    setEditingCeremony(ceremony);
    form.setFieldsValue({
      ...ceremony,
      retreatId: getObjectId(ceremony.retreatId),
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
        retreatId: values.retreatId || null,
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

  const selectedCeremony = trackingCeremonyId
    ? ceremonies.find((ceremony) => ceremony._id === trackingCeremonyId) || null
    : null;

  const handleSaveSpiritualVerification = async () => {
    if (!selectedCeremony?._id) return;

    try {
      setSavingSpiritualNotes(true);
      const response = await ceremoniesApi.update(selectedCeremony._id, {
        spiritualVerificationNotes: spiritualNotes,
      });
      setCeremonies((prev) => prev.map((ceremony) => (
        ceremony._id === selectedCeremony._id ? { ...ceremony, ...response.data } : ceremony
      )));
      message.success('Spiritual verification saved');
    } catch (error) {
      message.error('Failed to save spiritual verification');
      console.error('Error saving spiritual verification:', error);
    } finally {
      setSavingSpiritualNotes(false);
    }
  };

  const fullViewTabs: Array<{ key: CeremonyFullTab; label: string }> = [
    { key: 'med_prep', label: 'Med prep' },
    { key: 'spiritual', label: 'Spiritual verification' },
    { key: 'spoons', label: 'Spoons taken' },
    { key: 'post', label: 'Post ceremony data' },
  ];

  // If viewing a ceremony, show the full ceremony workspace
  if (trackingCeremonyId) {
    if (!selectedCeremony) {
      return (
        <div className="p-6">
          <button onClick={() => setTrackingCeremonyId(null)} className="mb-4 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
            Back to Ceremonies
          </button>
          <div className="rounded-lg border border-gray-200 bg-white p-6 text-sm text-gray-500">
            Ceremony not found.
          </div>
        </div>
      );
    }

    return (
      <div className="p-6">
        <button onClick={() => setTrackingCeremonyId(null)} className="mb-4 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
          Back to Ceremonies
        </button>

        <div className="mb-5 rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-gray-900">Ceremony #{selectedCeremony.ceremonyNumber}</h2>
              <p className="text-sm text-gray-600">
                {formatDate(selectedCeremony.date)}
                {selectedCeremony.startTime ? `, ${selectedCeremony.startTime}` : ''}
                {selectedCeremony.endTime ? ` - ${selectedCeremony.endTime}` : ''}
              </p>
            </div>
            <span className={`inline-flex w-fit rounded-full px-3 py-1 text-xs font-semibold ${getStatusColor(selectedCeremony.status || 'scheduled')}`}>
              {(selectedCeremony.status || 'scheduled').replace('_', ' ').toUpperCase()}
            </span>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {fullViewTabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveFullTab(tab.key)}
                className={`rounded-md border px-3 py-2 text-sm font-medium ${
                  activeFullTab === tab.key
                    ? 'border-indigo-200 bg-indigo-50 text-indigo-700'
                    : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {activeFullTab === 'med_prep' && (
          <ParticipantTracker ceremonyId={trackingCeremonyId} initialView="pre" lockedView showHeader={false} />
        )}

        {activeFullTab === 'spiritual' && (
          <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Spiritual verification</h3>
              <p className="text-sm text-gray-500">Record ceremony-level spiritual verification notes.</p>
            </div>
            <Input.TextArea
              rows={8}
              value={spiritualNotes}
              onChange={(event) => setSpiritualNotes(event.target.value)}
              placeholder="Spiritual verification notes"
            />
            <div className="mt-4 flex justify-end">
              <Button type="primary" onClick={handleSaveSpiritualVerification} loading={savingSpiritualNotes}>
                Save spiritual verification
              </Button>
            </div>
          </div>
        )}

        {activeFullTab === 'spoons' && (
          <ParticipantTracker ceremonyId={trackingCeremonyId} initialView="spoons" lockedView showHeader={false} />
        )}

        {activeFullTab === 'post' && (
          <ParticipantTracker ceremonyId={trackingCeremonyId} initialView="post" lockedView showHeader={false} />
        )}
      </div>
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
                {!retreatId && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Retreat
                  </th>
                )}
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
                  {!retreatId && (
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {getRetreatCode(retreats.find((retreat) => retreat._id === getObjectId(ceremony.retreatId)) || (typeof ceremony.retreatId === 'object' ? ceremony.retreatId as Retreat : null))}
                    </td>
                  )}
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
                        onClick={() => openFullView(ceremony, 'spoons')}
                        size="small"
                        title="Open ceremony full view"
                      >
                        Ceremony view
                      </Button>
                      <Button
                        type="text"
                        icon={<EditOutlined />}
                        onClick={() => handleEdit(ceremony)}
                        size="small"
                        title="Edit Ceremony"
                      />
                      <Button
                        type="text"
                        icon={<DeleteOutlined />}
                        danger
                        size="small"
                        title="Delete Ceremony"
                        onClick={() => {
                          Modal.confirm({
                            title: 'Delete ceremony?',
                            content: 'Are you sure you want to delete this ceremony?',
                            okText: 'Yes, delete',
                            cancelText: 'No',
                            okButtonProps: { danger: true },
                            onOk: () => handleDelete(ceremony._id!),
                          });
                        }}
                      />
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
            name="retreatId"
            label="Retreat"
          >
            <Select
              allowClear
              showSearch
              placeholder="Link this ceremony to a retreat"
              optionFilterProp="label"
              options={retreats.map((retreat) => ({
                value: retreat._id!,
                label: `${getRetreatCode(retreat)}${retreat.location_town || retreat.locationTown || retreat.location ? ` - ${retreat.location_town || retreat.locationTown || retreat.location}` : ''}`,
              }))}
            />
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
