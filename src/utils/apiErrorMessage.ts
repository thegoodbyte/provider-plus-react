/** User-facing feedback only: transport and infrastructure diagnostics stay out of the UI. */
export const apiErrorMessage = (error: any, fallback: string): string => {
  const status = error?.response?.status;
  const value = error?.response?.data?.message;
  const text = (Array.isArray(value) ? value.filter(item => typeof item === 'string').join(' ') : typeof value === 'string' ? value : '').trim();
  const technical = /Request failed with status code|AxiosError|Network Error|ECONN|ETIMEDOUT|stack trace|\bat .+\(.+:\d+|MongoServerError|E11000|SELECT .+ FROM|s3.*(?:bucket|credential)|secret|access.?token|passwordHash/i.test(text);
  if ((status === 400 || status === 409) && /\bemail\b.*already (?:registered|exists)|duplicate email/i.test(text)) return 'Duplicate email';
  if (status === 403) return 'You do not have permission to perform this action.';
  if (status === 503 && /^(Outbound email is disabled in this environment\.|email resource is disabled or in capture mode)$/.test(text)) return 'Email sending is disabled for this environment.';
  if (status === 429) return 'Too many requests. Please wait a moment before continuing.';
  if (text && !technical && !/^(Bad Request|Internal Server Error|Service Unavailable|Unauthorized|Not Found)$/i.test(text) && (!status || status < 500)) return text;
  // Ambiguous writes must be checked before repeating them, particularly payments and emails.
  const method = String(error?.config?.method || '').toLowerCase();
  const url = String(error?.config?.url || '');
  if ((!error?.response || status >= 500) && method && method !== 'get' && /\/files|\/upload/.test(url)) return 'Upload could not be confirmed. Refresh the document list before uploading again.';
  if ((!error?.response || status >= 500) && method && method !== 'get' && /communications.*send|payments|payment-requests|payouts/.test(url)) {
    return /communications/.test(url) ? 'Email delivery could not be confirmed. Check sent messages before sending again.' : 'The payment update could not be confirmed. Check payment history before making another change.';
  }
  if (!error?.response && (error?.request || error?.code === 'ERR_NETWORK' || error?.code === 'ECONNABORTED')) return `${fallback.replace(/\s*(Please )?try again\.?$/i, '')} Check your connection.`;
  if (status >= 500) return `${fallback.replace(/\s*(Please )?try again\.?$/i, '')} The service is temporarily unavailable.`;
  return fallback.replace(/\s*(Please )?try again\.?$/i, '');
};
