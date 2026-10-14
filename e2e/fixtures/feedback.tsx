// Browser-only fixtures mount production components; Playwright owns every API response.
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '../../src/context/AuthContext';
import ApiErrorHandler from '../../src/components/ApiErrorHandler';
import ClientEditModal from '../../src/components/ClientEditModal';
import EmailComposeModal from '../../src/components/EmailComposeModal';
import BookingDocumentsUpload from '../../src/components/BookingDocumentsUpload';
import MedicalReviewWhatsAppForm from '../../src/components/MedicalReviewWhatsAppForm';
import PaymentRequestsGrid from '../../src/components/PaymentRequestsGrid';
import BookingEditorForm from '../../src/components/BookingEditorForm';
import { api } from '../../src/services/api';
import '../../src/index.css';
const client: any = { _id: 'c1', firstName: 'Synthetic', lastName: 'Guest', email: 'original@example.invalid', phone: '+420777123456', country: 'CZ', language: 'EN' };
const retreat: any = { _id: 'r1', name: 'Test retreat', startDate: '2026-11-01', endDate: '2026-11-08', capacity: 20, status: 'active' };
const booking: any = { _id: 'b1', clientId: client, retreatId: retreat, bookingNumber: 1201, bookingType: 'full_retreat', totalAmount: 1000, amountPaid: 0, currency: 'EUR', status: 'confirmed' };
function Fixture() {
 const [saved, setSaved] = useState(false);
 const mode = new URLSearchParams(location.search).get('case');
 if (saved) return <p role="status">Saved successfully.</p>;
 if (mode === 'modal') return <ClientEditModal client={client} onClose={() => setSaved(true)} onSave={() => setSaved(true)} />;
 if (mode === 'email') return <EmailComposeModal initialValues={{ to: 'recipient@example.invalid', subject: 'Test message', bodyText: 'Unsaved email draft' }} onClose={() => setSaved(true)} />;
 if (mode === 'documents') return <BookingDocumentsUpload bookingId="b1" clientId="c1" />;
 if (mode === 'review') return <MedicalReviewWhatsAppForm request={{ _id: 'mrr1', display_id: 1201, assignedToUserId: 'advisor', reviewNotes: 'Unsaved review notes' } as any} advisors={[{ _id: 'advisor', firstName: 'Test', lastName: 'Advisor', email: 'advisor@example.invalid' } as any]} onClose={() => setSaved(true)} onSaved={() => setSaved(true)} />;
 if (mode === 'payments') return <PaymentRequestsGrid />;
 if (mode === 'booking') return <BookingEditorForm mode="edit" bookingId="b1" initialBooking={booking} initialRetreats={[retreat]} onCancel={() => {}} onSaved={() => setSaved(true)} />;
 return <section><label>Unsaved draft<input aria-label="Unsaved draft" defaultValue="Notes to preserve" /></label><button onClick={() => { void api.get('/test-loading').catch(() => {}); }}>Load information</button></section>;
}
createRoot(document.getElementById('root')!).render(<BrowserRouter><AuthProvider><ApiErrorHandler><Fixture /></ApiErrorHandler></AuthProvider></BrowserRouter>);
