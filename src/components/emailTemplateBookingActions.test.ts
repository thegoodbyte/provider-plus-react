import { buildTemplateBookingActionPayload, normalizeTemplateBookingStepKeys } from './emailTemplateBookingActions';

describe('email template booking actions', () => {
  it('merges legacy and multi-action configuration without duplicates', () => {
    expect(normalizeTemplateBookingStepKeys(
      ['contract_sent', 'medical_form_sent', 'contract_sent'],
      'contract_sent',
    )).toEqual(['contract_sent', 'medical_form_sent']);
  });

  it('preserves the first action for backward compatibility while sending all actions', () => {
    expect(buildTemplateBookingActionPayload(['questionnaire_sent', 'medications_form_sent'])).toEqual({
      bookingFlowStepKey: 'questionnaire_sent',
      bookingFlowStepKeys: ['questionnaire_sent', 'medications_form_sent'],
    });
  });

  it('sends an empty multi-action list when no actions are configured', () => {
    expect(buildTemplateBookingActionPayload([], '')).toEqual({
      bookingFlowStepKey: undefined,
      bookingFlowStepKeys: [],
    });
  });
});
