import React from 'react';
import { render, screen } from '@testing-library/react';
import { referralsApi, languagesApi } from '../services/api';
import ReferralNotificationSettingsPage from './ReferralNotificationSettingsPage';
jest.mock('../services/api', () => ({ referralsApi: { getNotificationSettings: jest.fn() }, languagesApi: { getActive: jest.fn() } }));
beforeEach(() => {
 (referralsApi.getNotificationSettings as jest.Mock).mockResolvedValue({data:{}});
 (languagesApi.getActive as jest.Mock).mockResolvedValue({data:[{code:'en',name:'English'},{code:'cz',name:'Czech'}]});
});
it('shows legacy Czech and disabled stored language without losing their values', async () => {
 render(<ReferralNotificationSettingsPage partners={[
  {_id:'one',name:'Czech partner',assignmentNotificationLanguage:'cs'},
  {_id:'two',name:'Polish partner',assignmentNotificationLanguage:'pl'},
 ] as any} onPartnerSaved={async()=>{}} />);
 expect(await screen.findByLabelText('Notification language for Czech partner')).toHaveValue('cz');
 expect(await screen.findByLabelText('Notification language for Polish partner')).toHaveValue('pl');
 expect(screen.getByRole('option',{name:'PL · current'})).toBeInTheDocument();
});
