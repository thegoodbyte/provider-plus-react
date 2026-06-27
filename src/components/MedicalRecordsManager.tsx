import React, { useState, useEffect, useCallback } from 'react';
import {
  MedicalRecord,
  MedicalRecordType,
  TestType,
  TestStatus,
  MedicalRecordGroup
} from '../types/medical';
import { MedicalArtifact } from '../types';
import { medicalArtifactsApi } from '../services/api';
import { Eye as FiEye, Upload as FiUpload, AlertCircle as FiAlertCircle, Plus as FiPlus } from 'lucide-react';
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

const recordTypeToDocumentStage = (type?: MedicalRecordType): MedicalArtifact['documentStage'] => {
  if (type === MedicalRecordType.PRE_CEREMONY) return 'pre_ceremony';
  if (type === MedicalRecordType.IN_CEREMONY) return 'in_ceremony';
  if (type === MedicalRecordType.POST_CEREMONY) return 'post_ceremony';
  if (type === MedicalRecordType.ADDITIONAL) return 'additional';
  return 'entry';
};

const artifactToRecordType = (artifact: MedicalArtifact): MedicalRecordType => {
  if (artifact.purpose === 'correction') return MedicalRecordType.ENTRY_CORRECTION;
  if (artifact.documentStage === 'pre_ceremony') return MedicalRecordType.PRE_CEREMONY;
  if (artifact.documentStage === 'in_ceremony') return MedicalRecordType.IN_CEREMONY;
  if (artifact.documentStage === 'post_ceremony') return MedicalRecordType.POST_CEREMONY;
  if (artifact.documentStage === 'additional') return MedicalRecordType.ADDITIONAL;
  return MedicalRecordType.ENTRY_DOCUMENT;
};

const testTypeToDocumentType = (type?: TestType): MedicalArtifact['documentType'] => {
  if (type === TestType.EKG) return 'EKG';
  if (type === TestType.LIVER_PANEL || type === TestType.BLOOD_TEST) return 'Liver';
  if (type === TestType.BLOOD_PRESSURE || type === TestType.HEART_RATE) return 'BP';
  return 'other';
};

const artifactToTestType = (artifact: MedicalArtifact): TestType => {
  if (artifact.artifactType === 'ekg' || artifact.artifactType === 'ceremony_ekg' || artifact.documentType === 'EKG') return TestType.EKG;
  if (artifact.artifactType === 'liver_panel' || artifact.documentType === 'Liver') return TestType.LIVER_PANEL;
  if (artifact.artifactType === 'blood_pressure' || artifact.documentType === 'BP') return TestType.BLOOD_PRESSURE;
  return TestType.OTHER;
};

const getArtifactTypeForRecord = (recordType?: MedicalRecordType, testType?: TestType): NonNullable<MedicalArtifact['artifactType']> => {
  if (testType === TestType.EKG) {
    return recordType === MedicalRecordType.ENTRY_DOCUMENT || recordType === MedicalRecordType.ENTRY_CORRECTION ? 'ekg' : 'ceremony_ekg';
  }
  if (testType === TestType.LIVER_PANEL || testType === TestType.BLOOD_TEST) return 'liver_panel';
  if (testType === TestType.BLOOD_PRESSURE || testType === TestType.HEART_RATE) return 'blood_pressure';
  return 'other';
};

const artifactStatusToTestStatus = (status?: MedicalArtifact['status']): TestStatus => {
  if (status === 'approved') return TestStatus.APPROVED;
  if (status === 'rejected') return TestStatus.REJECTED;
  if (status === 'needs_resubmission') return TestStatus.NEEDS_CORRECTION;
  return TestStatus.PENDING;
};

const testStatusToArtifactStatus = (status?: TestStatus): MedicalArtifact['status'] => {
  if (status === TestStatus.APPROVED) return 'approved';
  if (status === TestStatus.REJECTED) return 'rejected';
  if (status === TestStatus.NEEDS_CORRECTION) return 'needs_resubmission';
  return 'pending_review';
};

const mapArtifactsToRecords = (artifacts: MedicalArtifact[]): MedicalRecord[] => {
  const mapped = artifacts.map((artifact) => ({
    _id: artifact._id,
    clientId: typeof artifact.clientId === 'string' ? artifact.clientId : artifact.clientId?._id || '',
    retreatId: typeof artifact.retreatId === 'string' ? artifact.retreatId : artifact.retreatId?._id,
    ceremonyId: artifact.ceremonyId,
    recordType: artifactToRecordType(artifact),
    testType: artifactToTestType(artifact),
    testDate: artifact.data?.testDate || artifact.receivedAt || artifact.createdAt || new Date(),
    uploadDate: artifact.receivedAt || artifact.createdAt || new Date(),
    version: artifact.version || 1,
    status: artifactStatusToTestStatus(artifact.status),
    results: artifact.data?.results || {},
    attachments: (artifact.files || []).map((file) => ({
      url: file.url || file.filePath || file.s3Key || '',
      filename: file.fileName || 'Medical file',
      uploadedAt: file.uploadedAt || artifact.receivedAt || new Date(),
      fileType: file.mimeType || '',
      size: file.size,
    })),
    notes: artifact.notes || artifact.description,
    correctionRequested: artifact.data?.correctionRequested,
    measurementTime: artifact.data?.measurementTime,
    takenBy: artifact.uploadedBy,
    previousVersionId: typeof artifact.replacesArtifactId === 'string' ? artifact.replacesArtifactId : artifact.replacesArtifactId?._id,
    isLatestVersion: true,
    createdAt: artifact.createdAt,
    updatedAt: artifact.updatedAt,
  }));

  const latestKeys = new Set<string>();
  return mapped.map((record) => {
    const key = `${record.recordType}:${record.testType}`;
    if (latestKeys.has(key)) return { ...record, isLatestVersion: false };
    latestKeys.add(key);
    return record;
  });
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
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

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

  const loadRecords = useCallback(async () => {
    if (!clientId) return;
    setLoading(true);
    try {
      const response = await medicalArtifactsApi.getAll({ clientId });
      setRecords(mapArtifactsToRecords(response.data || []));
    } catch (error) {
      console.error('Error loading medical artifacts:', error);
      message.error('Failed to load medical records');
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

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
    setSelectedFiles([]);
    setIsModalOpen(true);
  };

  // Save record
  const handleSaveRecord = async () => {
    try {
      setLoading(true);
      const recordType = formData.recordType || activeTab;
      const testType = formData.testType || TestType.EKG;
      const title = `${getRecordTypeLabel(recordType)} ${getTestTypeLabel(testType)}`;
      const artifactPayload = {
        clientId,
        ...(retreatId ? { retreatId } : {}),
        documentStage: recordTypeToDocumentStage(recordType),
        documentType: testTypeToDocumentType(testType),
        artifactType: getArtifactTypeForRecord(recordType, testType),
        contextType: 'client' as const,
        purpose: recordType === MedicalRecordType.ENTRY_CORRECTION ? 'correction' as const : 'general' as const,
        title,
        description: formData.notes || title,
        data: {
          testDate: formData.testDate,
          results: formData.results || {},
          measurementTime: formData.measurementTime,
          correctionRequested: formData.correctionRequested,
        },
        receivedAt: new Date().toISOString(),
        source: 'admin_upload' as const,
        version: formData.version || 1,
        status: testStatusToArtifactStatus(formData.status),
        notes: formData.notes,
        tags: [recordTypeToDocumentStage(recordType), testTypeToDocumentType(testType), testType].filter(Boolean),
      };

      if (editingRecord?._id) {
        await medicalArtifactsApi.update(editingRecord._id, artifactPayload);
        if (selectedFiles.length > 0) {
          await medicalArtifactsApi.uploadFiles(editingRecord._id, selectedFiles);
        }
      } else {
        const created = await medicalArtifactsApi.create({
          ...artifactPayload,
          replacesArtifactId: formData.previousVersionId,
        });
        if (created.data._id && selectedFiles.length > 0) {
          await medicalArtifactsApi.uploadFiles(created.data._id, selectedFiles);
        }
      }

      message.success('Medical record saved successfully');
      await loadRecords();
      setIsModalOpen(false);
      setSelectedFiles([]);
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
    } finally {
      setLoading(false);
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
          <Button size="small" icon={<FiEye />} onClick={() => record._id && window.open(`/medical-artifacts/${record._id}`, '_blank')}>
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
          {loading ? <div className="py-8 text-center text-gray-500">Loading medical records...</div> : renderRecordSection(MedicalRecordType.ENTRY_DOCUMENT)}
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
          {loading ? <div className="py-8 text-center text-gray-500">Loading medical records...</div> : renderRecordSection(MedicalRecordType.ENTRY_CORRECTION)}
        </Tabs.TabPane>

        <Tabs.TabPane tab="Pre-Ceremony" key={MedicalRecordType.PRE_CEREMONY}>
          {loading ? <div className="py-8 text-center text-gray-500">Loading medical records...</div> : renderRecordSection(MedicalRecordType.PRE_CEREMONY)}
        </Tabs.TabPane>

        <Tabs.TabPane tab="In-Ceremony" key={MedicalRecordType.IN_CEREMONY}>
          {loading ? <div className="py-8 text-center text-gray-500">Loading medical records...</div> : renderRecordSection(MedicalRecordType.IN_CEREMONY)}
        </Tabs.TabPane>

        <Tabs.TabPane tab="Post-Ceremony" key={MedicalRecordType.POST_CEREMONY}>
          {loading ? <div className="py-8 text-center text-gray-500">Loading medical records...</div> : renderRecordSection(MedicalRecordType.POST_CEREMONY)}
        </Tabs.TabPane>

        <Tabs.TabPane tab="Additional" key={MedicalRecordType.ADDITIONAL}>
          {loading ? <div className="py-8 text-center text-gray-500">Loading medical records...</div> : renderRecordSection(MedicalRecordType.ADDITIONAL)}
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
        confirmLoading={loading}
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
              fileList={selectedFiles.map((file, index) => ({
                uid: `${file.name}-${index}`,
                name: file.name,
                status: 'done',
              }))}
              onChange={(info) => {
                setSelectedFiles(info.fileList.flatMap((file) =>
                  file.originFileObj ? [file.originFileObj as File] : []
                ));
              }}
              onRemove={(file) => {
                setSelectedFiles((current) => current.filter((item) => item.name !== file.name));
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
