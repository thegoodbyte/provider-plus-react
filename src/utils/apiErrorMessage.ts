const collectMessages = (value: unknown): string[] => {
  if (typeof value === 'string') return value.trim() ? [value.trim()] : [];
  if (Array.isArray(value)) return value.flatMap(collectMessages);
  if (!value || typeof value !== 'object') return [];

  const record = value as Record<string, unknown>;
  const preferredKeys = ['message', 'details', 'errors', 'reason', 'error'];
  return preferredKeys.flatMap((key) => collectMessages(record[key]));
};

export const apiErrorMessage = (error: any, fallback: string) => {
  const responseData = error?.response?.data;
  const messages = collectMessages(responseData);
  if (!messages.length) messages.push(...collectMessages(error?.message));

  const usefulMessages = Array.from(new Set(messages)).filter((message) => {
    return !['bad request', 'request failed with status code 400'].includes(message.toLowerCase());
  });
  return usefulMessages.join(' · ') || messages[0] || fallback;
};
