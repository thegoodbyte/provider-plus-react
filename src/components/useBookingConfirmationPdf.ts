import { useCallback, useEffect, useState } from 'react';
import { message } from 'antd';
import { bookingsApi } from '../services/api';
import { createBookingConfirmationPdf } from './BookingConfirmationPDF';
import { BookingConfirmationLanguage } from './bookingConfirmationWorkflow';
export const useBookingConfirmationPdf = (bookingId: string, booking: any, language: BookingConfirmationLanguage) => {
  const [generating, setGenerating] = useState(false); const [previewing, setPreviewing] = useState(false); const [previewPhase, setPreviewPhase] = useState<'loading' | 'generating' | null>(null); const [previewUrl, setPreviewUrl] = useState(''); const [previewFileName, setPreviewFileName] = useState('');
  const store = useCallback((blob: Blob, name: string) => bookingsApi.storeConfirmationPdf(bookingId, language, blob, name), [bookingId, language]);
  const download = useCallback(async () => { if (!booking) return; setGenerating(true); try { const result = await createBookingConfirmationPdf({ booking, language }); await store(result.blob, result.fileName); result.pdf.save(result.fileName); } catch { message.error('Could not generate the booking PDF. Please try again.'); } finally { setGenerating(false); } }, [booking, language, store]);
  const preview = useCallback(async () => {
    if (!booking) return;
    setPreviewing(true);
    setPreviewPhase('loading');
    try {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      const freshBooking = (await bookingsApi.getOneFresh(bookingId)).data as any;
      const stored = freshBooking?.bookingConfirmationPdfs?.[language];
      const bookingUpdatedAt = +new Date(freshBooking?.updatedAt || 0);
      const generatedAt = +new Date(stored?.generatedAt || 0);
      let blob: Blob;
      let fileName: string;
      if (stored?.s3Key && generatedAt >= bookingUpdatedAt) {
        const response = await bookingsApi.getConfirmationPdf(bookingId, language);
        blob = response.data as Blob;
        fileName = stored.fileName || `booking-confirmation-${freshBooking?.bookingNumber || bookingId}.pdf`;
      } else {
        setPreviewPhase('generating');
        const result = await createBookingConfirmationPdf({ booking: freshBooking, language });
        await store(result.blob, result.fileName);
        blob = result.blob;
        fileName = result.fileName;
      }
      setPreviewUrl(URL.createObjectURL(blob));
      setPreviewFileName(fileName);
    } catch { message.error('Could not open the booking PDF preview. Please try downloading it instead.'); }
    finally { setPreviewing(false); setPreviewPhase(null); }
  }, [booking, bookingId, language, previewUrl, store]);
  const close = useCallback(() => { setPreviewUrl(''); setPreviewFileName(''); }, []);
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);
  return { generating, previewing, previewPhase, previewUrl, previewFileName, download, preview, close, store };
};
