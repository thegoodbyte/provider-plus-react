import React from 'react';
import { MailSettings } from '../types';
import { resolveDecisionTemplates } from './medicalDecisionTemplates';

type Props = {
  settings: MailSettings | null;
  onChange: React.Dispatch<React.SetStateAction<MailSettings | null>>;
};

export default function MedicalDecisionTemplateEditors({ settings, onChange }: Props) {
  return <>
    <p className="text-sm text-gray-600">These templates are used when a medical review needs more information or is declined. Sending follows the email master switch, the corresponding notification switch above, and Email safety settings. Saving templates does not send an email or resend earlier decisions.</p>
    {([
      ['medicalReviewNeedsInfoTemplates', 'Needs more information'],
      ['medicalReviewDeclinedTemplates', 'Declined'],
    ] as const).map(([key, title]) => {
      const templates = resolveDecisionTemplates(key, settings?.[key]);
      return <section key={key} aria-label={`${title} email templates`} className="space-y-3">
        <h3 className="font-semibold text-gray-900">{title} email templates</h3>
        <p className="text-xs text-gray-500">Placeholders: {'{{client.firstName}}'}, {'{{document.type}}'}, {'{{document.stage}}'}, {'{{review.number}}'}, {'{{links.clientPortal}}'}. Keep reviewer notes and medical findings in IbogaReady.</p>
        <div className="grid gap-4 lg:grid-cols-3">
          {([['en', 'English'], ['cs', 'Czech'], ['pl', 'Polish']] as const).map(([language, label]) => {
            const template = templates[language];
            const update = (field: 'subject' | 'body', value: string) => onChange(previous => ({
              ...(previous || {}),
              [key]: { ...previous?.[key], [language]: { ...resolveDecisionTemplates(key, previous?.[key])[language], [field]: value } },
            }));
            return <div key={language} className="min-w-0 space-y-2 rounded-md border p-3">
              <h4 className="font-semibold">{label}</h4>
              <label className="block text-sm">Subject
                <input aria-label={`${title} ${label} subject`} className="mt-1 w-full rounded-md border px-3 py-2 text-sm" value={template.subject} onChange={event => update('subject', event.target.value)} />
              </label>
              <label className="block text-sm">Body
                <textarea aria-label={`${title} ${label} body`} className="mt-1 min-h-64 w-full rounded-md border px-3 py-2 text-sm" value={template.body} onChange={event => update('body', event.target.value)} />
              </label>
            </div>;
          })}
        </div>
      </section>;
    })}
  </>;
}
