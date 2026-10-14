import React from 'react';
import { createRoot } from 'react-dom/client';
import FormsInvitation from '../../src/components/FormsInvitation';
import '../../src/index.css';
const language = new URLSearchParams(location.search).get('language') || 'en';
createRoot(document.getElementById('root')!).render(<FormsInvitation client={{ _id: '507f1f77bcf86cd799439011', firstName: 'Synthetic', email: 'prospect@example.test', loginPin: '654321', language }} />);
