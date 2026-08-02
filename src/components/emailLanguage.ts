import { InboundEmail, SentEmail } from '../types';

export const LANGUAGE_LABELS: Record<string, string> = { en: 'English', cs: 'Czech', pl: 'Polish', unknown: 'Unknown' };

export const normalizeEmailLanguage = (value?: string) => {
  const language = String(value || '').trim().toLowerCase().split(/[,_-]/)[0];
  if (language === 'cz' || language === 'cs') return 'cs';
  if (language === 'en' || language === 'pl') return language;
  return language || 'unknown';
};

const headerValue = (headers: Record<string, string> | undefined, name: string) => {
  const key = Object.keys(headers || {}).find((item) => item.toLowerCase() === name.toLowerCase());
  return key ? headers?.[key] : undefined;
};

export const getSentEmailLanguage = (email: SentEmail) => normalizeEmailLanguage(
  (typeof email.templateId === 'object' ? email.templateId.language : undefined)
  || (email as any).language
  || email.variablesSnapshot?.language
  || email.variablesSnapshot?.client?.language,
);

export const getInboundEmailLanguage = (email: InboundEmail) => normalizeEmailLanguage(
  (email as any).language
  || headerValue(email.headers, 'content-language')
  || email.aiClassification?.language,
);

export const emailLanguageLabel = (language: string) => LANGUAGE_LABELS[language] || language.toUpperCase();
