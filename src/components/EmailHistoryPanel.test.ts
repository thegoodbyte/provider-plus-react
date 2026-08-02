import { getInboundEmailLanguage, getSentEmailLanguage, normalizeEmailLanguage } from './emailLanguage';

describe('EmailHistoryPanel language filtering', () => {
  it('normalizes supported language variants', () => {
    expect(normalizeEmailLanguage('EN-us')).toBe('en');
    expect(normalizeEmailLanguage('cz')).toBe('cs');
    expect(normalizeEmailLanguage('pl_PL')).toBe('pl');
    expect(normalizeEmailLanguage()).toBe('unknown');
  });

  it('uses the sent email template language', () => {
    expect(getSentEmailLanguage({
      subject: 'Dobrý den', bodyText: '', to: ['client@example.com'],
      templateId: { name: 'Welcome', subject: '', bodyText: '', language: 'cz' },
    })).toBe('cs');
  });

  it('uses a case-insensitive Content-Language header for received email', () => {
    expect(getInboundEmailLanguage({
      gmailMessageId: 'message-1', threadId: 'thread-1', status: 'received',
      headers: { 'Content-Language': 'pl-PL' },
    })).toBe('pl');
  });
});
