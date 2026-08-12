export type BookingConfirmationLanguage = 'pl' | 'cz' | 'en';
export const confirmationLanguage = (client: any): BookingConfirmationLanguage => {
  const value = String(client?.language || client?.preferredLanguage || '').trim().toUpperCase();
  if (['CZ', 'CS', 'CZECH', 'CESKY', 'ČESKY'].includes(value)) return 'cz';
  if (['PL', 'POLISH', 'POLSKI', 'POLSKA'].includes(value)) return 'pl';
  return 'en';
};
export const confirmationReason = (booking: any) => (booking?.bookingConfirmationHistory || []).length ? 'Updated booking confirmation' : 'Original booking confirmation';
export const confirmationAction = (booking: any): 'created' | 'updated' => (booking?.bookingConfirmationHistory || []).length ? 'updated' : 'created';
export const fileSize = (bytes: number) => { if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'; const units = ['B', 'KB', 'MB', 'GB']; const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1); return `${(bytes / Math.pow(1024, index)).toFixed(index ? 1 : 0)} ${units[index]}`; };
export const sentEmailReceipt = (email: any) => [`Email ${email?.status || 'queued'}.`, email?.display_id ? `Log #${email.display_id}` : '', email?.gmailMessageId ? `Gmail message ID: ${email.gmailMessageId}` : '', email?.cc?.length ? `CC: ${email.cc.join(', ')}` : 'CC: none', email?.attachments?.length ? `Attachments: ${email.attachments.length}` : '', email?.errorMessage ? `Error: ${email.errorMessage}` : ''].filter(Boolean).join('\n');
export const sendFailureDetails = (error: any, pdfBytes = 0, payloadBytes = 0) => { const data = error?.response?.data || {}; return [data.message || error?.message || 'Unable to send booking confirmation email.', error?.response?.status ? `Status: ${error.response.status}` : '', pdfBytes ? `PDF attachment size: ${fileSize(pdfBytes)}` : '', payloadBytes ? `Request payload size: ${fileSize(payloadBytes)}` : '', data.limitBytes ? `API limit: ${fileSize(Number(data.limitBytes))}` : '', data.receivedBytes ? `Received by API: ${fileSize(Number(data.receivedBytes))}` : ''].filter(Boolean).join('\n'); };
export const blobBase64 = (blob: Blob) => new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onloadend = () => resolve(String(reader.result || '').split(',')[1] || ''); reader.onerror = reject; reader.readAsDataURL(blob); });
export const historyReason = (explicit: string | undefined, current: string | undefined, booking: any) => String(explicit || current || confirmationReason(booking)).trim() || confirmationReason(booking);
