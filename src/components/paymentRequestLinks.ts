export const getIbogaReadyPaymentUrl = (request: any) => (
  request?.publicHash ? `https://www.ibogaready.com/payment/${request.publicHash}` : ''
);

export const getPolishWebsitePaymentUrl = (request: any) => (
  request?.publicHash ? `https://ibogaspirit.pl/clients/payment/request/${request.publicHash}?lang=pl` : ''
);

export const getPreferredPaymentUrl = (request: any) => {
  const client = typeof request?.clientId === 'object' ? request.clientId : {};
  const language = String(client?.preferredLanguage || client?.preferred_language || client?.language || '').toLowerCase();
  return language === 'pl' ? getPolishWebsitePaymentUrl(request) : getIbogaReadyPaymentUrl(request);
};

