import React, { useEffect, useState } from 'react';
import { Client, EmailTemplate } from '../types';
import { clientsApi, communicationsApi } from '../services/api';
import EmailComposeModal, { EmailComposeInitialValues } from './EmailComposeModal';
import { apiErrorMessage } from '../utils/apiErrorMessage';
import { callTimeInput, callTimeToIso } from './screeningCallTime';

const templateKey = 'screening_call_preparation';
const field = 'w-full rounded-md border border-gray-300 px-3 py-2';
const languageFor = (client: Client): 'en' | 'cz' | 'pl' => {
  const language = String(client.preferredLanguage || client.language || 'en').toLowerCase();
  return language === 'pl' ? 'pl' : ['cs','cz'].includes(language) ? 'cz' : 'en';
};
export default function ScreeningCallPanel({ client, onSaved }: { client: Client; onSaved: (client: Client) => void }) {
  const defaultZone = client.screeningCallTimeZone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Prague';
  const [timeZone,setTimeZone] = useState(defaultZone);
  const [dateTime,setDateTime] = useState('');
  const [original,setOriginal] = useState({dateTime:'',timeZone:defaultZone});
  const [saving,setSaving] = useState(false);
  const [preparing,setPreparing] = useState(false);
  const [error,setError] = useState('');
  const [message,setMessage] = useState('');
  const [composer,setComposer] = useState<EmailComposeInitialValues | null>(null);
  useEffect(() => {
    const zone = client.screeningCallTimeZone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Prague';
    setTimeZone(zone);
    try {
      const value = callTimeInput(client.screeningCallAt,zone);
      setDateTime(value);setOriginal({dateTime:value,timeZone:zone});
    } catch {
      setError('The saved call time or timezone is invalid. Choose a valid timezone and call time, then save.');
      setDateTime('');setOriginal({dateTime:'',timeZone:zone});
    }
  },[client._id,client.screeningCallAt,client.screeningCallTimeZone]);
  const dirty = dateTime !== original.dateTime || timeZone !== original.timeZone;
  const save = async () => {
    setSaving(true);setError('');setMessage('');
    try {
      let screeningCallAt: string | null;
      try { screeningCallAt = callTimeToIso(dateTime,timeZone); }
      catch (cause) {
        setError(cause instanceof RangeError ? 'Enter a valid IANA timezone, for example Europe/Prague or America/New_York.' : (cause as Error).message);
        return;
      }
      const response = await clientsApi.update(client._id!,{screeningCallAt,screeningCallTimeZone:timeZone});
      onSaved(response.data);
      setOriginal({dateTime,timeZone});
      setMessage(screeningCallAt ? 'Screening call saved. No email has been sent.' : 'Screening call cleared. No email has been sent.');
    } catch (cause) { setError(cause instanceof RangeError ? 'Enter a valid IANA timezone, for example Europe/Prague or America/New_York.' : apiErrorMessage(cause,'Could not save the screening call. Your changes are retained.')); }
    finally { setSaving(false); }
  };
  const prepare = async () => {
    setPreparing(true);setError('');setMessage('');
    try {
      const language = languageFor(client);
      const {data:templates} = await communicationsApi.getTemplates();
      const template = templates.find((item: EmailTemplate) => item.templateKey === templateKey && item.active !== false && item.language === language);
      if (!template?._id) { setError('The before-call template is unavailable. Check that the API deployment has installed the email templates.'); return; }
      const {data:preview} = await communicationsApi.previewEmail({templateId:template._id,clientId:client._id,relatedEntityType:'client',relatedEntityId:client._id});
      setComposer({to:client.email,clientId:client._id,relatedEntityType:'client',relatedEntityId:client._id,templateId:preview.templateId || template._id,templateKey,requestedLanguage:language,resolvedLanguage:language,subject:preview.subject,bodyText:preview.bodyText,bodyHtml:preview.bodyHtml});
    } catch (cause) { setError(apiErrorMessage(cause,'Could not prepare the before-call email. Please retry.')); }
    finally { setPreparing(false); }
  };
  return <section aria-label="Screening call" className="mb-5 rounded-lg border border-gray-200 bg-gray-50 p-4">
    <h3 className="font-semibold">Scheduled screening call</h3>
    <p className="mt-1 text-sm text-gray-600">Set the call time for the client's before-call email. Date and time use the timezone below.</p>
    <div className="mt-3 grid gap-3 sm:grid-cols-2">
      <label>Call date and time<input className={field} type="datetime-local" value={dateTime} disabled={saving || preparing} onChange={e=>{setDateTime(e.target.value);setMessage('');}} /></label>
      <label>Call timezone<input className={field} list="screening-call-timezones" value={timeZone} disabled={saving || preparing} onChange={e=>{setTimeZone(e.target.value);setMessage('');}} /><datalist id="screening-call-timezones">{['Europe/Prague','Europe/Warsaw','Europe/London','America/New_York','UTC'].map(zone=><option key={zone} value={zone}/>)}</datalist></label>
    </div>
    {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
    {message && <p role="status" className="mt-3 text-sm text-green-800">{message}</p>}
    {!dateTime && <p className="mt-2 text-sm text-gray-600">No call is scheduled. The email will say the call time is not confirmed.</p>}
    {dirty && <p className="mt-2 text-sm text-amber-800">Save the call details before preparing the email.</p>}
    {!client.email && <p className="mt-2 text-sm text-amber-800">Add the client's email address before preparing an invitation.</p>}
    <div className="mt-3 flex flex-wrap gap-3">
      <button type="button" className="rounded-md bg-blue-600 px-4 py-2 text-white disabled:opacity-50" disabled={saving || preparing || !dirty} onClick={save}>{saving ? 'Saving call…' : 'Save call details'}</button>
      <button type="button" className="rounded-md border border-gray-300 bg-white px-4 py-2 disabled:opacity-50" disabled={saving || preparing || dirty || !client.email} onClick={prepare}>{preparing ? 'Preparing email…' : 'Prepare before-call email'}</button>
    </div>
    <p className="mt-3 text-xs text-gray-500">Review the email preview before sending. The logo loads from a hosted image; questionnaires and login links remain available if images are blocked.</p>
    {composer && <EmailComposeModal title="Before our screening call" initialValues={composer} onClose={()=>setComposer(null)} onSent={()=>{setComposer(null);setMessage('Message submitted. Review Emails for delivery status.');}} />}
  </section>;
}
