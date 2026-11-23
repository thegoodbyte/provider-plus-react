import React, { useEffect, useRef, useState } from 'react';
import { communicationsApi } from '../services/api';
import { apiErrorMessage } from '../utils/apiErrorMessage';
import { canSharePaymentRequest, defaultShareMessages, localizedShareUrl, PAYMENT_SHARE_KEY, renderShareMessage, selectShareTemplate, shareLanguage, SHARE_LANGUAGES, ShareLanguage, sharePlaceholders, shareTemplateError } from './paymentRequestSharing';
export default function PaymentRequestShare({ request, initiallyOpen = false }: {
    request: any;
    initiallyOpen?: boolean;
}) {
    const savingFlight = useRef(false);
    const [open, setOpen] = useState(initiallyOpen), [language, setLanguage] = useState<ShareLanguage>(() => shareLanguage(request.clientId?.preferredLanguage || request.clientId?.preferred_language || request.clientId?.language)), [templates, setTemplates] = useState<any[]>([]), [loaded, setLoaded] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState(''), [retry, setRetry] = useState(0), [saving, setSaving] = useState(false), [editing, setEditing] = useState(false), [draft, setDraft] = useState('');
    useEffect(() => { if (!open || !canSharePaymentRequest(request))
        return; let active = true; setLoaded(false); setError(''); communicationsApi.getTemplates().then(({ data }) => { if (active) {
        if (!Array.isArray(data))
            throw Error('Invalid template response');
        setTemplates(data);
        setLoaded(true);
    } }).catch(e => { if (active)
        setError(apiErrorMessage(e, 'Could not load payment messages. Retry before copying a message.')); }); return () => { active = false; }; }, [open, retry]);
    useEffect(() => { setEditing(false); setNotice(''); }, [language, request._id]);
    const selected = selectShareTemplate(templates, language), body = selected.template?.bodyText ?? defaultShareMessages[language], validation = shareTemplateError(body), url = localizedShareUrl(request, language), available = canSharePaymentRequest(request), message = renderShareMessage(body, request, language);
    const copy = async (value: string) => { setNotice(''); try {
        await navigator.clipboard.writeText(value);
        setNotice('Copied.');
    }
    catch {
        setNotice('Clipboard unavailable. Select and copy the text below.');
    } };
    const save = async () => { if(savingFlight.current) return; const issue = shareTemplateError(draft); if (issue) {
        setError(issue);
        return;
    } savingFlight.current = true; setSaving(true); setError(''); try {
        const payload = { name: `Payment request sharing — ${language.toUpperCase()}`, subject: 'Payment request', bodyText: draft, bodyHtml: '', category: PAYMENT_SHARE_KEY, templateKey: PAYMENT_SHARE_KEY, language, active: true };
        const { data } = selected.template ? await communicationsApi.updateTemplate(selected.template._id, payload) : await communicationsApi.createTemplate(payload);
        if (!data?._id)
            throw Error('The saved message could not be confirmed. Reload templates before saving again.');
        setTemplates(current => [...current.filter(t => t._id !== data._id), data]);
        setEditing(false);
        setNotice('Message saved for ' + language.toUpperCase() + '.');
    }
    catch (e) {
        setError(apiErrorMessage(e, 'Could not save the message. Your edits are retained.'));
    }
    finally {
        savingFlight.current = false;
        setSaving(false);
    } };
    return <details open={open} onToggle={e => setOpen(e.currentTarget.open)} className="my-3 min-w-0 rounded-lg border border-slate-200 bg-white p-3"><summary className="cursor-pointer font-semibold">Share payment message</summary>{open && <div className="mt-3 space-y-3">
  <p className="break-words font-semibold">Request {request.invoiceNumber || request.display_id || '—'}{typeof request.clientId === 'object' && request.clientId ? ` · ${[request.clientId.firstName, request.clientId.lastName].filter(Boolean).join(' ')}${request.clientId.display_id ? ` · Client #${request.clientId.display_id}` : ''}` : request.serviceDocument?.client?.name ? ` · ${request.serviceDocument.client.name}` : ''}</p>
  <p className="text-sm text-slate-600">Copy a message to share manually. Copying does not send an email or change the payment request.</p>
  <label className="block text-sm">Message language<select aria-label="Payment message language" disabled={saving || editing} value={language} onChange={e => setLanguage(e.target.value as ShareLanguage)} className="ml-2 rounded border p-2">{SHARE_LANGUAGES.map(l => <option key={l} value={l}>{({ en: 'English', pl: 'Polish', cz: 'Czech' })[l]}</option>)}</select></label>
  {!available ? <p role="alert">The private link is inactive or unavailable. Review the payment request before sharing.</p> : <>
   <label className="block text-sm">Private payment link<input aria-label="Private payment link" readOnly value={url} onFocus={e => e.target.select()} className="mt-1 w-full min-w-0 rounded border p-2"/></label>
   <button type="button" onClick={() => copy(url)} className="rounded border px-3 py-2">Copy link only</button>
   {!loaded && !error && <p role="status">Loading payment message…</p>}
   {loaded && <>{selected.inactive ? <p role="alert">This language’s message is inactive. Activate it in Communications → Templates before copying.</p> : <><label className="block text-sm">Message preview<textarea aria-label="Payment message preview" readOnly value={message} rows={7} className="mt-1 w-full min-w-0 rounded border p-2" onFocus={e => e.target.select()}/></label>{validation && <p role="alert">{validation}</p>}<button type="button" disabled={Boolean(validation) || editing || saving} onClick={() => copy(message)} className="rounded bg-teal-800 px-3 py-2 text-white disabled:opacity-50">Copy message</button></>}
   {!editing ? <button type="button" className="ml-2 rounded border px-3 py-2" onClick={() => { setDraft(body); setEditing(true); setError(''); }}>Configure {language.toUpperCase()} message</button> : <div className="rounded border p-3"><label className="block">Message template<textarea aria-label="Payment message template" rows={7} value={draft} disabled={saving} onChange={e => setDraft(e.target.value)} className="mt-1 w-full min-w-0 rounded border p-2"/></label><p className="break-words text-xs">Supported: {sharePlaceholders.map(p => '{{' + p + '}}').join(', ')}. Include {'{{paymentUrl}}'}. Saves this language for all staff; other languages stay unchanged.</p><div className="mt-2 flex flex-wrap gap-2"><button type="button" disabled={saving} onClick={save} className="rounded bg-teal-800 px-3 py-2 text-white">{saving ? 'Saving…' : 'Save message'}</button><button type="button" disabled={saving} onClick={() => { setEditing(false); setError(''); }} className="rounded border px-3 py-2">Cancel message edits</button></div></div>}</>}
  </>}
  {error && <div role="alert"><p>{error}</p><button type="button" disabled={saving} onClick={() => setRetry(n => n + 1)} className="rounded border px-3 py-2">Reload message templates</button></div>}{notice && <p role="status">{notice}</p>}
 </div>}</details>;
}
