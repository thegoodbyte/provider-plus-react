export const PAYMENT_SHARE_KEY = 'payment_request_share';
export const SHARE_LANGUAGES = ['en', 'pl', 'cz'] as const;
export type ShareLanguage = typeof SHARE_LANGUAGES[number];
export const shareLanguage = (value: unknown): ShareLanguage => {
    const lang = String(value || '').toLowerCase().split(/[-_]/)[0];
    return lang === 'pl' ? 'pl' : lang === 'cz' || lang === 'cs' ? 'cz' : 'en';
};
export const defaultShareMessages: Record<ShareLanguage, string> = {
    en: 'Hello {{firstName}},\n\nYou can view your payment request {{invoiceNumber}} here:\n{{paymentUrl}}\n\nThank you,\nIboga Spirit',
    pl: 'Dzień dobry {{firstName}},\n\nTutaj znajdziesz swoją prośbę o płatność {{invoiceNumber}}:\n{{paymentUrl}}\n\nDziękujemy,\nIboga Spirit',
    cz: 'Dobrý den {{firstName}},\n\nZde si můžete prohlédnout svou žádost o platbu {{invoiceNumber}}:\n{{paymentUrl}}\n\nDěkujeme,\nIboga Spirit',
};
export const sharePlaceholders = ['firstName', 'invoiceNumber', 'requestedAmount', 'currency', 'paymentUrl'];
export function shareTemplateError(body: string) {
    if (!body.trim())
        return 'Enter a message.';
    if (body.length > 10000)
        return 'Keep the message within 10,000 characters.';
    if (!body.includes('{{paymentUrl}}'))
        return 'Include {{paymentUrl}} so the message contains the private link.';
    if ((body.match(/{{\s*([^{}]+)\s*}}/g) || []).some(token => !sharePlaceholders.includes(token.slice(2, -2).trim())))
        return 'Use only the supported placeholders shown below.';
    if (body.replace(/{{\s*([^{}]+)\s*}}/g, '').includes('{{') || body.replace(/{{\s*([^{}]+)\s*}}/g, '').includes('}}'))
        return 'Close each placeholder with matching double braces.';
    return '';
}
export const canSharePaymentRequest = (r: any) => Boolean(r?.publicHash && r?.status !== 'cancelled' && !r?.publicLinkRevokedAt);
export function localizedShareUrl(request: any, language: ShareLanguage) {
    if (!canSharePaymentRequest(request))
        return '';
    const hash = encodeURIComponent(request.publicHash);
    if (request.context === 'standalone_service')
        return `https://ibogaspirit.cz/clients/payment/services/${hash}?lang=${language}`;
    if (language === 'en')
        return `https://www.ibogaready.com/payment/${hash}`;
    return `https://ibogaspirit.${language === 'pl' ? 'pl' : 'cz'}/clients/payment/request/${hash}?lang=${language}`;
}
export function selectShareTemplate(templates: any[], language: ShareLanguage) {
    const matches = templates.filter(t => t.templateKey === PAYMENT_SHARE_KEY && (String(t.language || 'en').toLowerCase().split(/[-_]/)[0] === language || language === 'cz' && String(t.language).toLowerCase().split(/[-_]/)[0] === 'cs'));
    const active = matches.filter(t => t.active !== false).sort((a, b) => Number(b.display_id || 0) - Number(a.display_id || 0) || String(b.createdAt || '').localeCompare(String(a.createdAt || '')) || String(b._id).localeCompare(String(a._id)));
    return { template: active[0], inactive: matches.length > 0 && active.length === 0 };
}
export function renderShareMessage(body: string, request: any, language: ShareLanguage) {
    const client = typeof request.clientId === 'object' ? request.clientId : {};
    const rawAmount = Number(request.requestedAmount ?? request.amountPaid ?? 0);
    const values: Record<string, string> = {
        firstName: client?.firstName || request.serviceDocument?.client?.name || '',
        invoiceNumber: String(request.invoiceNumber || request.display_id || ''),
        requestedAmount: Number.isFinite(rawAmount) ? rawAmount.toLocaleString(language === 'cz' ? 'cs-CZ' : language) : '',
        currency: request.currency || 'EUR', paymentUrl: localizedShareUrl(request, language),
    };
    return body.replace(/{{\s*([^{}]+)\s*}}/g, (_, key) => values[key.trim()] ?? '');
}
