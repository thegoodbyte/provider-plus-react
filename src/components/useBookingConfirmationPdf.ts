import { useCallback, useEffect, useState } from 'react';
import { message } from 'antd';
import { bookingsApi } from '../services/api';
import { createBookingConfirmationPdf } from './BookingConfirmationPDF';
import { BookingConfirmationLanguage } from './bookingConfirmationWorkflow';
export const useBookingConfirmationPdf = (bookingId: string, booking: any, language: BookingConfirmationLanguage) => {
  const [generating, setGenerating] = useState(false); const [previewing, setPreviewing] = useState(false); const [previewUrl, setPreviewUrl] = useState(''); const [previewFileName, setPreviewFileName] = useState('');
  const store = useCallback((blob: Blob, name: string) => bookingsApi.storeConfirmationPdf(bookingId, language, blob, name), [bookingId, language]);
  const download = useCallback(async () => { if (!booking) return; setGenerating(true); try { const result = await createBookingConfirmationPdf({ booking, language }); await store(result.blob, result.fileName); result.pdf.save(result.fileName); } catch { message.error('Could not generate the booking PDF. Please try again.'); } finally { setGenerating(false); } }, [booking, language, store]);
  const preview = useCallback(async () => { if (!booking) return; setPreviewing(true); try { if (previewUrl) URL.revokeObjectURL(previewUrl); const result = await createBookingConfirmationPdf({ booking, language }); await store(result.blob, result.fileName); setPreviewUrl(URL.createObjectURL(result.blob)); setPreviewFileName(result.fileName); } catch { message.error('Could not open the booking PDF preview. Please try downloading it instead.'); } finally { setPreviewing(false); } }, [booking, language, previewUrl, store]);
  const close = useCallback(() => { setPreviewUrl(''); setPreviewFileName(''); }, []);
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);
  return { generating, previewing, previewUrl, previewFileName, download, preview, close, store };
};
