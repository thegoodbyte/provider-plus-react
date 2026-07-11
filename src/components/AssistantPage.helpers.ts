export type AssistantMode = 'retreat' | 'booking';

export const getAssistantIntroMessage = (mode: AssistantMode) => (
  mode === 'retreat'
    ? 'Select a retreat and ask me who is missing contract, EKG, liver, who has no MRR, who is medically approved, or what steps are blocking this retreat.'
    : 'Select a booking and ask me about missing steps, approvals, documents, or balance.'
);

export const getAssistantQuickQuestions = (mode: AssistantMode) => (
  mode === 'retreat'
    ? [
      'Who is missing contract?',
      'Who is missing EKG?',
      'Who is missing liver?',
      'Who has no MRR?',
      'Who is medically approved?',
      'What steps are missing?',
    ]
    : [
      'What steps are missing?',
      'Which documents are still pending?',
      'Which approvals are blocking this booking?',
      'What is the balance due?',
    ]
);
