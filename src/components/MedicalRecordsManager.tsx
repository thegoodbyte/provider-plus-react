import React, { useState, useEffect } from 'react';
import {
  MedicalRecord,
  MedicalRecordType,
  TestType,
  TestStatus,
  MedicalRecordGroup,
  ClientMedicalSummary
} from '../types/medical';
import { FiUpload, FiDownload, FiEye, FiEdit2, FiCheck, FiX, FiAlertCircle, FiClock, FiPlus } from 'react-icons/fi';
import { message, Modal, Upload, Select, Input, DatePicker, InputNumber, Tabs, Badge, Collapse, Button, Tag } from 'antd';
import moment from 'moment';

const { Panel } = Collapse;
const { TextArea } = Input;
const { Option } = Select;

interface MedicalRecordsManagerProps {
  clientId: string;
  retreatId?: string;
  clientName?: string;
}

// Helper to get record type label
const getRecordTypeLabel = (type: MedicalRecordType): string => {
  const labels: Record<MedicalRecordType, string> = {
    [MedicalRecordType.ENTRY_DOCUMENT]: 'Entry Documents',
    [MedicalRecordType.ENTRY_CORRECTION]: 'Entry Corrections',
    [MedicalRecordType.PRE_CEREMONY]: 'Pre-Ceremony',
    [MedicalRecordType.IN_CEREMONY]: 'In-Ceremony',
    [MedicalRecordType.POST_CEREMONY]: 'Post-Ceremony',
    [MedicalRecordType.ADDITIONAL]: 'Additional Records'
  };
  return labels[type];
};

// Helper to get test type label
const getTestTypeLabel = (type: TestType): string => {
  const labels: Record<TestType, string> = {
    [TestType.EKG]: 'EKG',
    [TestType.LIVER_PANEL]: 'Liver Panel',
    [TestType.BLOOD_PRESSURE]: 'Blood Pressure',
    [TestType.HEART_RATE]: 'Heart Rate',
    [TestType.BLOOD_TEST]: 'Blood Test',
    [TestType.OTHER]: 'Other'
  };
  return labels[type];
};

// Helper to get status color
const getStatusColor = (status: TestStatus): string => {
  const colors: Record<TestStatus, string> = {
    [TestStatus.PENDING]: 'orange',
    [TestStatus.APPROVED]: 'green',
    [TestStatus.NEEDS_CORRECTION]: 'red',
    [TestStatus.REJECTED]: 'red'
  };
  return colors[status];
};

const MedicalRecordsManager: React.FC<MedicalRecordsManagerProps> = ({
  clientId,
  retreatId,
  clientName = 'Client'
}) => {
  const [records, setRecords] = useState<MedicalRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<MedicalRecord | null>(null);
  const [activeTab, setActiveTab] = useState<MedicalRecordType>(MedicalRecordType.ENTRY_DOCUMENT);

  // Form states
  const [formData, setFormData] = useState<Partial<MedicalRecord>>({
    recordType: MedicalRecordType.ENTRY_DOCUMENT,
    testType: TestType.EKG,
    status: TestStatus.PENDING,
    version: 1,
    isLatestVersion: true,
    results: {}
  });

  // Group records by type and test
  const groupRecords = (records: MedicalRecord[]): Record<MedicalRecordType, MedicalRecordGroup[]> => {
    const grouped: Record<MedicalRecordType, MedicalRecordGroup[]> = {
      [MedicalRecordType.ENTRY_DOCUMENT]: [],
      [MedicalRecordType.ENTRY_CORRECTION]: [],
      [MedicalRecordType.PRE_CEREMONY]: [],
      [MedicalRecordType.IN_CEREMONY]: [],
      [MedicalRecordType.POST_CEREMONY]: [],
      [MedicalRecordType.ADDITIONAL]: []
    };

    records.forEach(record => {
      const type = record.recordType;
      const testType = record.testType;

      let group = grouped[type].find(g => g.testType === testType);
      if (!group) {
        group = {
          type,
          testType,
          records: [],
          requiresAction: false
        };
        grouped[type].push(group);
      }

      group.records.push(record);

      // Set latest record
      if (record.isLatestVersion) {
        group.latestRecord = record;
        if (record.status === TestStatus.NEEDS_CORRECTION || record.status === TestStatus.PENDING) {
          group.requiresAction = true;
          group.actionMessage = record.status === TestStatus.NEEDS_CORRECTION
            ? 'Correction needed'
            : 'Awaiting review';
        }
      }
    });

    // Sort records within each group by version
    Object.values(grouped).forEach(groups => {
      groups.forEach(group => {
        group.records.sort((a, b) => (b.version || 0) - (a.version || 0));
      });
    });

    return grouped;
  };

  const groupedRecords = groupRecords(records);

  // Add new record
  const handleAddRecord = () => {
    setFormData({
      recordType: activeTab,
      testType: TestType.EKG,
      status: TestStatus.PENDING,
      version: 1,
      isLatestVersion: true,
      testDate: moment().format('YYYY-MM-DD'),
      results: {}
    });
    setEditingRecord(null);
    setIsModalOpen(true);
  };

  // Save record
  const handleSaveRecord = async () => {
    try {
      // Here you would save to your API
      console.log('Saving record:', formData);

      // For now, just add to local state
      const newRecord: MedicalRecord = {
        ...formData as MedicalRecord,
        _id: Date.now().toString(),
        clientId,
        retreatId,
        uploadDate: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      };

      if (editingRecord) {
        setRecords(records.map(r => r._id === editingRecord._id ? newRecord : r));
      } else {
        // If adding new version, mark previous as not latest
        if (formData.previousVersionId) {
          setRecords(prev => prev.map(r =>
            r._id === formData.previousVersionId
              ? { ...r, isLatestVersion: false }
              : r
          ));
        }
        setRecords([...records, newRecord]);
      }

      message.success('Medical record saved successfully');
      setIsModalOpen(false);
      setFormData({
        recordType: activeTab,
        testType: TestType.EKG,
        status: TestStatus.PENDING,
        version: 1,
        isLatestVersion: true,
        results: {}
      });
    } catch (error) {
      console.error('Error saving record:', error);
      message.error('Failed to save medical record');
    }
  };

  // Render record card
  const renderRecordCard = (record: MedicalRecord, isLatest: boolean = false) => (
    <div
      key={record._id}
      className={`border rounded-lg p-4 mb-3 ${isLatest ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}`}
    >
      <div className="flex justify-between items-start mb-2">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-semibold">{getTestTypeLabel(record.testType)}</span>
            {isLatest && <Tag color="blue">Latest</Tag>}
            <Tag color={getStatusColor(record.status)}>
              {record.status.replace('_', ' ').toUpperCase()}
            </Tag>
            {record.version > 1 && (
              <span className="text-sm text-gray-500">v{record.version}</span>
            )}
          </div>
          <div className="text-sm text-gray-600 mt-1">
            Test Date: {moment(record.testDate).format('MM/DD/YYYY')}
          </div>
        </div>

        <div className="flex gap-2">
          <Button size="small" icon={<FiEye />} onClick={() => {/* View logic */}}>
            View
          </Button>
          {isLatest && record.status === TestStatus.NEEDS_CORRECTION && (
            <Button
              size="small"
              type="primary"
              icon={<FiUpload />}
              onClick={() => {
                setFormData({
                  ...record,
                  version: (record.version || 1) + 1,
                  previousVersionId: record._id,
                  status: TestStatus.PENDING
                });
                setIsModalOpen(true);
              }}
            >
              Upload Correction
            </Button>
          )}
        </div>
      </div>

      {/* Results Display */}
      {record.results && (
        <div className="mt-3 p-3 bg-gray-50 rounded">
          {record.testType === TestType.BLOOD_PRESSURE && (
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Systolic:</span>
                <span className="ml-2 font-medium">{record.results.systolic}</span>
              </div>
              <div>
                <span className="text-gray-600">Diastolic:</span>
                <span className="ml-2 font-medium">{record.results.diastolic}</span>
              </div>
              <div>
                <span className="text-gray-600">Heart Rate:</span>
                <span className="ml-2 font-medium">{record.results.heartRate}</span>
              </div>
            </div>
          )}

          {record.results.value && record.testType !== TestType.BLOOD_PRESSURE && (
            <div className="text-sm">
              <span className="text-gray-600">Result:</span>
              <span className="ml-2 font-medium">{record.results.value}</span>
            </div>
          )}

          {record.results.abnormalities && record.results.abnormalities.length > 0 && (
            <div className="mt-2">
              <span className="text-sm text-red-600">
                Abnormalities: {record.results.abnormalities.join(', ')}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Notes */}
      {(record.notes || record.reviewerNotes || record.correctionRequested) && (
        <div className="mt-3 space-y-2 text-sm">
          {record.notes && (
            <div>
              <span className="text-gray-600">Notes:</span> {record.notes}
            </div>
          )}
          {record.reviewerNotes && (
            <div>
              <span className="text-gray-600">Reviewer Notes:</span> {record.reviewerNotes}
            </div>
          )}
          {record.correctionRequested && (
            <div className="text-red-600">
              <FiAlertCircle className="inline mr-1" />
              Correction Required: {record.correctionRequested}
            </div>
          )}
        </div>
      )}

      {/* Metadata */}
      <div className="mt-3 flex gap-4 text-xs text-gray-500">
        {record.takenBy && <span>Taken by: {record.takenBy}</span>}
        {record.reviewedBy && <span>Reviewed by: {record.reviewedBy}</span>}
        {record.measurementTime && <span>Time: {record.measurementTime}</span>}
      </div>
    </div>
  );

  // Render record type section
  const renderRecordSection = (type: MedicalRecordType) => {
    const groups = groupedRecords[type];

    if (groups.length === 0) {
      return (
        <div className="text-center py-8 text-gray-500">
          <p>No {getRecordTypeLabel(type).toLowerCase()} records yet</p>
          <Button
            type="primary"
            icon={<FiPlus />}
            className="mt-4"
            onClick={handleAddRecord}
          >
            Add {getRecordTypeLabel(type)} Record
          </Button>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {groups.map(group => (
          <Collapse key={`${group.type}-${group.testType}`} defaultActiveKey={group.requiresAction ? ['1'] : []}>
            <Panel
              header={
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="font-medium">{getTestTypeLabel(group.testType)}</span>
                    {group.requiresAction && (
                      <Badge status="error" text={group.actionMessage} />
                    )}
                    {group.latestRecord && (
                      <Tag color={getStatusColor(group.latestRecord.status)}>
                        {group.latestRecord.status.replace('_', ' ').toUpperCase()}
                      </Tag>
                    )}
                  </div>
                  <span className="text-sm text-gray-500">
                    {group.records.length} version{group.records.length !== 1 ? 's' : ''}
                  </span>
                </div>
              }
              key="1"
            >
              {group.records.map((record, idx) =>
                renderRecordCard(record, idx === 0 && record.isLatestVersion)
              )}
            </Panel>
          </Collapse>
        ))}
      </div>
    );
  };

  return (
    <div className="medical-records-manager">
      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-2">Medical Records - {clientName}</h2>
        <div className="flex gap-4 text-sm text-gray-600">
          <span>Client ID: {clientId}</span>
          {retreatId && <span>Retreat ID: {retreatId}</span>}
        </div>
      </div>

      <Tabs
        activeKey={activeTab}
        onChange={(key) => setActiveTab(key as MedicalRecordType)}
        tabBarExtraContent={
          <Button type="primary" icon={<FiPlus />} onClick={handleAddRecord}>
            Add Record
          </Button>
        }
      >
        <Tabs.TabPane
          tab={
            <span>
              Entry Documents
              {groupedRecords[MedicalRecordType.ENTRY_DOCUMENT].some(g => g.requiresAction) &&
                <Badge dot className="ml-2" />
              }
            </span>
          }
          key={MedicalRecordType.ENTRY_DOCUMENT}
        >
          {renderRecordSection(MedicalRecordType.ENTRY_DOCUMENT)}
        </Tabs.TabPane>

        <Tabs.TabPane
          tab={
            <span>
              Entry Corrections
              {groupedRecords[MedicalRecordType.ENTRY_CORRECTION].some(g => g.requiresAction) &&
                <Badge dot className="ml-2" />
              }
            </span>
          }
          key={MedicalRecordType.ENTRY_CORRECTION}
        >
          {renderRecordSection(MedicalRecordType.ENTRY_CORRECTION)}
        </Tabs.TabPane>

        <Tabs.TabPane tab="Pre-Ceremony" key={MedicalRecordType.PRE_CEREMONY}>
          {renderRecordSection(MedicalRecordType.PRE_CEREMONY)}
        </Tabs.TabPane>

        <Tabs.TabPane tab="In-Ceremony" key={MedicalRecordType.IN_CEREMONY}>
          {renderRecordSection(MedicalRecordType.IN_CEREMONY)}
        </Tabs.TabPane>

        <Tabs.TabPane tab="Post-Ceremony" key={MedicalRecordType.POST_CEREMONY}>
          {renderRecordSection(MedicalRecordType.POST_CEREMONY)}
        </Tabs.TabPane>

        <Tabs.TabPane tab="Additional" key={MedicalRecordType.ADDITIONAL}>
          {renderRecordSection(MedicalRecordType.ADDITIONAL)}
        </Tabs.TabPane>
      </Tabs>

      {/* Add/Edit Modal */}
      <Modal
        title={editingRecord ? 'Edit Medical Record' : 'Add Medical Record'}
        open={isModalOpen}
        onOk={handleSaveRecord}
        onCancel={() => {
          setIsModalOpen(false);
          setEditingRecord(null);
        }}
        width={700}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Record Type</label>
              <Select
                value={formData.recordType}
                onChange={(value) => setFormData({ ...formData, recordType: value })}
                className="w-full"
              >
                {Object.values(MedicalRecordType).map(type => (
                  <Option key={type} value={type}>{getRecordTypeLabel(type)}</Option>
                ))}
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Test Type</label>
              <Select
                value={formData.testType}
                onChange={(value) => setFormData({ ...formData, testType: value })}
                className="w-full"
              >
                {Object.values(TestType).map(type => (
                  <Option key={type} value={type}>{getTestTypeLabel(type)}</Option>
                ))}
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Test Date</label>
              <DatePicker
                value={formData.testDate ? moment(formData.testDate) : null}
                onChange={(date) => setFormData({ ...formData, testDate: date?.format('YYYY-MM-DD') })}
                className="w-full"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Status</label>
              <Select
                value={formData.status}
                onChange={(value) => setFormData({ ...formData, status: value })}
                className="w-full"
              >
                {Object.values(TestStatus).map(status => (
                  <Option key={status} value={status}>
                    {status.replace('_', ' ').toUpperCase()}
                  </Option>
                ))}
              </Select>
            </div>
          </div>

          {/* Test-specific fields */}
          {formData.testType === TestType.BLOOD_PRESSURE && (
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Systolic</label>
                <InputNumber
                  value={formData.results?.systolic}
                  onChange={(value) => setFormData({
                    ...formData,
                    results: { ...formData.results, systolic: value || undefined }
                  })}
                  className="w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Diastolic</label>
                <InputNumber
                  value={formData.results?.diastolic}
                  onChange={(value) => setFormData({
                    ...formData,
                    results: { ...formData.results, diastolic: value || undefined }
                  })}
                  className="w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Heart Rate</label>
                <InputNumber
                  value={formData.results?.heartRate}
                  onChange={(value) => setFormData({
                    ...formData,
                    results: { ...formData.results, heartRate: value || undefined }
                  })}
                  className="w-full"
                />
              </div>
            </div>
          )}

          {formData.recordType === MedicalRecordType.IN_CEREMONY && (
            <div>
              <label className="block text-sm font-medium mb-1">Measurement Time</label>
              <Select
                value={formData.measurementTime}
                onChange={(value) => setFormData({ ...formData, measurementTime: value })}
                className="w-full"
                placeholder="Select measurement time"
              >
                <Option value="pre-dose">Pre-dose</Option>
                <Option value="30min">30 min post</Option>
                <Option value="1hr">1 hour post</Option>
                <Option value="2hr">2 hours post</Option>
                <Option value="3hr">3 hours post</Option>
                <Option value="4hr">4 hours post</Option>
                <Option value="peak">Peak</Option>
                <Option value="post-peak">Post-peak</Option>
              </Select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1">Notes</label>
            <TextArea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              placeholder="Enter any notes or observations..."
            />
          </div>

          {formData.status === TestStatus.NEEDS_CORRECTION && (
            <div>
              <label className="block text-sm font-medium mb-1 text-red-600">
                Correction Required
              </label>
              <TextArea
                value={formData.correctionRequested}
                onChange={(e) => setFormData({ ...formData, correctionRequested: e.target.value })}
                rows={2}
                placeholder="Describe what corrections are needed..."
                className="border-red-500"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1">File Attachments</label>
            <Upload.Dragger
              multiple
              beforeUpload={() => false}
              onChange={(info) => {
                // Handle file upload
                console.log('Files:', info.fileList);
              }}
            >
              <p className="ant-upload-drag-icon">
                <FiUpload className="text-3xl text-gray-400 mx-auto" />
              </p>
              <p className="ant-upload-text">Click or drag files to upload</p>
              <p className="ant-upload-hint">
                Support for PDF, images (JPG, PNG), and documents
              </p>
            </Upload.Dragger>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default MedicalRecordsManager;