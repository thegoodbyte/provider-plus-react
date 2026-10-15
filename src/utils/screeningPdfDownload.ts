// Chrome's PDF viewer may read a blob again long after the initial preview.
// Keep download URLs until the owning document leaves; BFCache restores keep them valid.
const downloadUrls = new Set<string>();
window.addEventListener('pagehide', (event: PageTransitionEvent) => {
  if (event.persisted) return;
  for (const url of downloadUrls) URL.revokeObjectURL(url);
  downloadUrls.clear();
});

export function saveScreeningPdf(response: { data: Blob; headers?: any }, clientId: string) {
  if (!(response.data instanceof Blob) || response.data.size === 0) throw new Error('The screening PDF is empty.');
  const disposition = String(response.headers?.['content-disposition'] || '');
  const encoded = disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  const plain = disposition.match(/filename="?([^";]+)"?/i)?.[1];
  let name = plain || 'screening-' + clientId + '.pdf';
  if (encoded) { try { name = decodeURIComponent(encoded); } catch { /* Use the plain/fallback filename. */ } }
  name = name.split('').map(c => '<>:"/\\|?*'.includes(c) || c.charCodeAt(0) < 32 ? '_' : c).join('').trim();
  if (!name.toLowerCase().endsWith('.pdf')) name += '.pdf';
  const url = URL.createObjectURL(response.data);
  downloadUrls.add(url);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  try { link.click(); } finally { link.remove(); }
}
