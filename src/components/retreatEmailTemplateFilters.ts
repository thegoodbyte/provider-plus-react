import { EmailTemplate } from '../types';

export type RetreatEmailTemplateLanguage = 'all' | 'en' | 'cz' | 'pl';

export const normalizeTemplateLanguage = (language?: string): Exclude<RetreatEmailTemplateLanguage, 'all'> => {
  const normalized = String(language || 'en').trim().toLowerCase();
  return normalized === 'cs' || normalized === 'cz' ? 'cz' : normalized === 'pl' ? 'pl' : 'en';
};

export const filterRetreatEmailTemplates = (templates: EmailTemplate[], language: RetreatEmailTemplateLanguage) =>
  language === 'all' ? templates : templates.filter((template) => normalizeTemplateLanguage(template.language) === language);
