import { expect, test } from '@playwright/test';

for (const count of [1, 30]) {
  test(`overview for ${count} bookings makes one summary request and loads only selected details`, async ({ page }) => {
    const calls: string[] = [];
    await page.addInitScript(() => {
      localStorage.setItem('token', 'e2e-token');
      localStorage.setItem('user', JSON.stringify({ id: 'admin', role: 'admin', email: 'admin@example.test' }));
    });
    await page.route('**/*', async route => {
      const request = route.request();
      if (!['xhr', 'fetch'].includes(request.resourceType())) return route.continue();
      const url = new URL(request.url());
      const path = url.pathname.replace(/^\/api(?=\/)/, '');
      calls.push(path + url.search);
      let data: any = [];
      if (path === '/retreats') data = [{ _id: 'r1', name: 'Batch retreat', startDate: '2030-10-01' }];
      if (path === '/booking-flow/retreats/r1/workflow-summary') data = { unavailable: [], rows: Array.from({ length: count }, (_, index) => ({
        _id: `b${index}`, clientId: `c${index}`, retreatId: 'r1', bookingNumber: index + 1,
        clientName: `Batch Client ${index}`, clientEmail: `client${index}@example.test`, depositPaid: true,
        medicalRequirements: [{ type: 'ekg', label: 'EKG', state: 'approved' }, { type: 'liver_panel', label: 'Liver Panel', state: 'approved' }],
        reminders: [], readinessScore: 4, readinessState: 'ready', nextAction: 'Ready for retreat', missingItems: [], unavailable: [],
      })) };
      if (path === '/payments/by-client-and-retreat') data = [{ _id: 'p1', amount: 100, currency: 'EUR', paymentMethod: 'bank_transfer', status: 'completed' }];
      if (path === '/users/navigation-permissions') data = {};
      return route.fulfill({ json: data });
    });
    await page.goto('/admin/workflow');
    const dashboard = page.locator('.workflow-dashboard');
    await expect(dashboard.getByText('4/4 checkpoints complete')).toBeVisible();
    await expect(dashboard.locator('.workflow-booking-row')).toHaveCount(count);
    expect(calls.filter(path => path.includes('/workflow-summary'))).toHaveLength(1);
    expect(calls.filter(path => /\/(client-requirements|client-medical|medical-artifacts|medical-review-requests|payments|bookings|requirements|reminders)(\/|\?|$)/.test(path))).toEqual([]);
    await dashboard.getByRole('button', { name: 'payments', exact: true }).click();
    await expect(dashboard.getByRole('cell', { name: 'bank transfer' })).toBeVisible();
    expect(calls.filter(path => path.startsWith('/payments/'))).toEqual(['/payments/by-client-and-retreat?clientId=c0&retreatId=r1']);
    if (count > 1) {
      await dashboard.locator('.workflow-booking-row').last().click();
      await expect(dashboard.getByText('4/4 checkpoints complete')).toBeVisible();
      expect(calls.filter(path => path.includes('/workflow-summary'))).toHaveLength(1);
      await dashboard.getByRole('button', { name: 'payments', exact: true }).click();
      await expect(dashboard.getByRole('cell', { name: 'bank transfer' })).toBeVisible();
      expect(calls.filter(path => path.startsWith('/payments/'))).toHaveLength(2);
      expect(calls).toContain(`/payments/by-client-and-retreat?clientId=c${count - 1}&retreatId=r1`);
    }
  });
}
