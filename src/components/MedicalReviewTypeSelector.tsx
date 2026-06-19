import React, { useState } from 'react';
import {
  MedicalEventType,
  MedicalType,
  MedicalReviewType,
  getMedicalEventTypeLabel,
  getMedicalTypeLabel,
  getMedicalReviewTypeLabel,
  getReviewTypesByEventType
} from '../types/medical-enhanced';
import { Select, Tag, Divider, Space } from 'antd';

const { Option, OptGroup } = Select;

interface MedicalReviewTypeSelectorProps {
  value?: MedicalReviewType | MedicalReviewType[];
  onChange?: (value: MedicalReviewType | MedicalReviewType[]) => void;
  mode?: 'single' | 'multiple';
  placeholder?: string;
  className?: string;
  showQuickOptions?: boolean;
}

const MedicalReviewTypeSelector: React.FC<MedicalReviewTypeSelectorProps> = ({
  value,
  onChange,
  mode = 'single',
  placeholder = 'Select review type',
  className,
  showQuickOptions = true
}) => {
  const [selectedTiming, setSelectedTiming] = useState<MedicalEventType | null>(null);

  // Quick access options matching your screenshot
  const quickOptions = [
    { value: 'ekg_only', label: 'EKG', timing: MedicalEventType.ENTRY, test: MedicalType.EKG },
    { value: 'liver_only', label: 'Liver', timing: MedicalEventType.ENTRY, test: MedicalType.LIVER_PANEL },
    { value: 'both_entry', label: 'Both', timing: MedicalEventType.ENTRY, tests: [MedicalType.EKG, MedicalType.LIVER_PANEL] }
  ];

  // Organized review types by timing
  const reviewTypesByTiming = {
    [MedicalEventType.ENTRY]: [
      MedicalReviewType.ENTRY_EKG_REVIEW,
      MedicalReviewType.ENTRY_LIVER_REVIEW,
      MedicalReviewType.ENTRY_COMBINED_REVIEW
    ],
    [MedicalEventType.PRE_CEREMONY]: [
      MedicalReviewType.PRE_CEREMONY_EKG_REVIEW,
      MedicalReviewType.PRE_CEREMONY_BP_REVIEW,
      MedicalReviewType.PRE_CEREMONY_VITALS_REVIEW
    ],
    [MedicalEventType.IN_CEREMONY]: [
      MedicalReviewType.IN_CEREMONY_BP_MONITORING,
      MedicalReviewType.IN_CEREMONY_VITALS_MONITORING
    ],
    [MedicalEventType.POST_CEREMONY]: [
      MedicalReviewType.POST_CEREMONY_EKG_REVIEW,
      MedicalReviewType.POST_CEREMONY_BP_REVIEW,
      MedicalReviewType.POST_CEREMONY_COMPLETE_REVIEW
    ],
    [MedicalEventType.ADDITIONAL]: [
      MedicalReviewType.MEDICATIONS_REVIEW,
      MedicalReviewType.QUESTIONNAIRE_REVIEW,
      MedicalReviewType.FOOD_INTAKE_REVIEW,
      MedicalReviewType.MEDICAL_QUESTION,
      MedicalReviewType.GENERAL_CLEARANCE
    ]
  };

  const handleQuickSelect = (quickValue: string) => {
    switch (quickValue) {
      case 'ekg_only':
        onChange?.(MedicalReviewType.ENTRY_EKG_REVIEW);
        break;
      case 'liver_only':
        onChange?.(MedicalReviewType.ENTRY_LIVER_REVIEW);
        break;
      case 'both_entry':
        onChange?.(MedicalReviewType.ENTRY_COMBINED_REVIEW);
        break;
      default:
        onChange?.(quickValue as MedicalReviewType);
    }
  };

  const renderDropdownContent = () => {
    return (
      <div style={{ padding: '8px 0' }}>
        {showQuickOptions && (
          <>
            <div style={{ padding: '4px 12px', fontSize: '12px', color: '#666', fontWeight: 'bold' }}>
              QUICK SELECT
            </div>
            {quickOptions.map(option => (
              <div
                key={option.value}
                onClick={() => handleQuickSelect(option.value)}
                style={{
                  padding: '8px 12px',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#f5f5f5';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                {option.label}
              </div>
            ))}
            <Divider style={{ margin: '8px 0' }} />
          </>
        )}

        {Object.entries(reviewTypesByTiming).map(([timing, types]) => (
          <div key={timing}>
            <div style={{
              padding: '4px 12px',
              fontSize: '12px',
              color: '#666',
              fontWeight: 'bold',
              backgroundColor: '#fafafa'
            }}>
              {getMedicalEventTypeLabel(timing as MedicalEventType).toUpperCase()}
            </div>
            {types.map(type => (
              <div
                key={type}
                onClick={() => onChange?.(type)}
                style={{
                  padding: '8px 12px 8px 24px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#f5f5f5';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <span>{getMedicalReviewTypeLabel(type)}</span>
                {value === type && <span style={{ color: '#1890ff' }}>✓</span>}
              </div>
            ))}
          </div>
        ))}
      </div>
    );
  };

  return (
    <Select
      value={value}
      onChange={onChange}
      mode={mode === 'multiple' ? 'multiple' : undefined}
      placeholder={placeholder}
      className={className}
      style={{ width: '100%' }}
      dropdownRender={() => renderDropdownContent()}
      open={undefined} // Control this if needed
    >
      {/* Quick options */}
      {showQuickOptions && (
        <OptGroup label="Quick Select">
          <Option value="ekg_only">EKG</Option>
          <Option value="liver_only">Liver</Option>
          <Option value="both_entry">Both</Option>
        </OptGroup>
      )}

      {/* Organized by timing */}
      {Object.entries(reviewTypesByTiming).map(([timing, types]) => (
        <OptGroup key={timing} label={getMedicalEventTypeLabel(timing as MedicalEventType)}>
          {types.map(type => (
            <Option key={type} value={type}>
              {getMedicalReviewTypeLabel(type)}
            </Option>
          ))}
        </OptGroup>
      ))}
    </Select>
  );
};

export default MedicalReviewTypeSelector;