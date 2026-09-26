import React from 'react';
import { render, screen } from '@testing-library/react';
import MedicalReviewTypeBadge from './MedicalReviewTypeBadge';
import { getMedicalDocumentType } from './MedicalDocumentTypeIcon';

describe('shared medical document types', () => {
  it.each([
    ['EKG', 'ceremony_ekg', 'ekg_review'],
    ['Liver', 'liver_panel', 'liver_panel_review'],
    ['BP', 'blood_pressure', 'blood_pressure_review'],
    ['meds', 'medications_form', 'medications_review'],
    ['health_questionnaire', 'questionnaire', 'questionnaire_review'],
    ['food_form', 'food_intake', 'food_intake_review'],
  ])('uses the same symbol and color for %s across documents, artifacts and MRRs', (...aliases) => {
    const first = getMedicalDocumentType(aliases[0]);
    aliases.forEach(alias => expect(getMedicalDocumentType(alias)).toEqual(first));
  });

  it('uses a specific document type when the artifact has a generic type', () => {
    expect(getMedicalDocumentType('other', 'BP')).toEqual(getMedicalDocumentType('blood_pressure'));
  });

  it('preserves custom type labels and safely handles missing and unknown types', () => {
    expect(getMedicalDocumentType('custom_scan').label).toBe('custom scan');
    expect(getMedicalDocumentType().label).toBe('Other');
    expect(getMedicalDocumentType('constructor').Icon).toBe(getMedicalDocumentType().Icon);
  });

  it('keeps a readable label next to the enlarged decorative icon', () => {
    const { container } = render(<MedicalReviewTypeBadge requestType="medications_review" />);
    expect(screen.getByText('Medications')).toBeInTheDocument();
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });
});
