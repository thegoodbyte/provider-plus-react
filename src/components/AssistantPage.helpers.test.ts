import { getAssistantIntroMessage, getAssistantQuickQuestions } from './AssistantPage.helpers';

describe('AssistantPage helpers', () => {
  it('includes contract in retreat quick questions', () => {
    expect(getAssistantQuickQuestions('retreat')).toEqual([
      'Who is missing contract?',
      'Who is missing EKG?',
      'Who is missing liver?',
      'Who has no MRR?',
      'Who is medically approved?',
      'What steps are missing?',
    ]);
  });

  it('provides a booking-specific prompt set', () => {
    expect(getAssistantQuickQuestions('booking')).toEqual([
      'What steps are missing?',
      'Which documents are still pending?',
      'Which approvals are blocking this booking?',
      'What is the balance due?',
    ]);
  });

  it('uses a retreat intro that references contract, EKG, liver, and MRRs', () => {
    expect(getAssistantIntroMessage('retreat')).toContain('missing contract');
    expect(getAssistantIntroMessage('retreat')).toContain('EKG');
    expect(getAssistantIntroMessage('retreat')).toContain('liver');
    expect(getAssistantIntroMessage('retreat')).toContain('MRR');
  });
});
