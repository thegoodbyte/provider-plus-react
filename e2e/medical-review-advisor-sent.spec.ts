import { test, expect } from './fixtures/medical-review-workspace';

for (const width of [1440, 390]) {
  test(`marking one medical review sent survives reload at ${width}px`, async ({
    page, request, reviewWorkspace: fixture,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    const reviews = fixture.models.MedicalReviewRequest;
    const selected = await reviews.findOne({ display_id: 9050 }).lean();
    const sibling = await reviews.findOne({ display_id: 9051 }).lean();
    const requestIds = [String(selected._id)];
    const endpoint = fixture.url + '/medical-review-requests/mark-advisor-sent';

    const denied = await request.post(endpoint, { data: { requestIds } });
    expect(denied.status()).toBe(401);
    expect(await reviews.findById(selected._id).lean()).toEqual(selected);

    const invalid = await request.post(endpoint, {
      headers: { Authorization: 'Bearer ' + fixture.tokens.admin },
      data: { requestIds: ['invalid-id'] },
    });
    expect(invalid.status()).toBe(400);

    await page.goto('/admin/medical-review-requests');
    const row = page.locator('.mrr-list-row').filter({
      has: page.getByRole('button', { name: '#9050', exact: true }),
    });
    await expect(row.getByText('Not sent', { exact: true })).toBeVisible();
    const markSentResponse = page.waitForResponse(response =>
      new URL(response.url()).pathname === '/medical-review-requests/mark-advisor-sent' &&
      response.request().method() === 'POST',
    );
    await row.getByRole('button', { name: 'Mark sent', exact: true }).click();
    const marked = await markSentResponse;
    expect(marked.status()).toBe(201);
    expect(await marked.json()).toEqual({ updated: 1 });

    const saved = await reviews.findById(selected._id).lean();
    expect(saved).toMatchObject({
      advisorDeliveryStatus: 'sent',
      advisorSentAt: expect.any(Date),
      advisorSentBy: 'admin@example.invalid',
      status: 'pending',
    });

    await expect(row.getByText('Sent', { exact: true })).toBeVisible();

    const retry = await request.post(endpoint, {
      headers: { Authorization: 'Bearer ' + fixture.tokens.staff },
      data: { requestIds: [...requestIds, ...requestIds] },
    });
    expect(retry.status()).toBe(201);
    expect(await retry.json()).toEqual({ updated: 1 });
    expect(await reviews.findById(selected._id).lean()).toMatchObject({
      advisorDeliveryStatus: 'sent',
      status: 'pending',
    });
    expect(await reviews.findById(sibling._id).lean()).toEqual(sibling);

    await page.reload();
    await expect(row.getByText('Sent', { exact: true })).toBeVisible();
    await expect(row.getByRole('button', { name: 'Mark sent', exact: true })).toHaveCount(0);
  });
}
