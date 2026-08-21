import { getBookingStepType, inferBookingStepType } from './bookingStepTypes';
import { isConfiguredRequirementStep } from './bookingStepRows';

describe('booking step types', () => {
  it.each([
    ['address_sent', 'notification_sent'],
    ['medical_labs_requested', 'request_sent'],
    ['payment_request_sent', 'request_sent'],
    ['questionnaire_received', 'submission_received'],
    ['food_form_received', 'submission_received'],
    ['ekg_mrr_sent', 'review_requested'],
    ['liver_review_result', 'review_completed'],
    ['payment_received', 'payment_received'],
    ['food_matrix_made', 'internal_task'],
  ])('classifies %s as %s', (key, expected) => {
    expect(inferBookingStepType(key)).toBe(expected);
  });

  it('prefers a persisted type over key inference', () => {
    expect(getBookingStepType('notification_sent', 'ekg_received').value).toBe('notification_sent');
  });

  it('keeps questionnaire and food receipt as requirements for legacy records', () => {
    expect(isConfiguredRequirementStep('questionnaire_received')).toBe(true);
    expect(isConfiguredRequirementStep('food_form_received')).toBe(true);
  });
});
