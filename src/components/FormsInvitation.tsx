import React, { useState } from 'react';
import { communicationsApi } from '../services/api';
import { apiErrorMessage } from '../utils/apiErrorMessage';
import EmailComposeModal, { EmailComposeInitialValues } from './EmailComposeModal';
import Toast from './Toast';
import { useToast } from '../hooks/useToast';

export const invitationLanguage = (value?: string): 'en' | 'cz' | 'pl' => {
  const language = String(value || '').toLowerCase();
  return ['cz', 'cs', 'czech'].includes(language) ? 'cz' : ['pl', 'polish'].includes(language) ? 'pl' : 'en';
};

export default function FormsInvitation({ client }: { client: any }) {
  const [preparing, setPreparing] = useState(false);
  const [draft, setDraft] = useState<EmailComposeInitialValues | null>(null);
  const { toast, showError, dismiss } = useToast();
  const prepare = async () => {
    setPreparing(true);
    try {
      const language = invitationLanguage(client.language);
      const response = await communicationsApi.getTemplates();
      const template = response.data.find((item: any) => item.templateKey === 'prospect_forms_invitation' && item.active !== false && invitationLanguage(item.language) === language);
      if (!template) { showError('The forms invitation template is unavailable for this language. Check Communications templates.'); return; }
      const preview = await communicationsApi.previewEmail({ templateId: template._id, clientId: client._id });
      setDraft({ to: client.email, clientId: client._id, relatedEntityType: 'client', relatedEntityId: client._id, templateId: template._id, templateKey: 'prospect_forms_invitation', requestedLanguage: language, resolvedLanguage: language, subject: preview.data.subject, bodyText: preview.data.bodyText, variables: preview.data.variables });
    } catch (error) { showError(apiErrorMessage(error, 'Could not prepare the forms invitation.')); }
    finally { setPreparing(false); }
  };
  return <>
    <button type="button" onClick={prepare} disabled={preparing || !client.email || !client.loginPin} className="rounded-md border border-blue-200 bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-700 disabled:opacity-50">{preparing ? 'Preparing invitation…' : 'Send forms invitation'}</button>
    {(!client.email || !client.loginPin) && <p className="text-sm text-gray-600">An email address and portal PIN are required.</p>}
    {draft && <EmailComposeModal title="Forms invitation" initialValues={draft} onClose={() => setDraft(null)} />}
    {toast && <Toast toast={toast} onDismiss={dismiss} />}
  </>;
}
