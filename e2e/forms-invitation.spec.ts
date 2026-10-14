import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
const defaults = JSON.parse(fs.readFileSync(path.resolve('../api/src/communications/seeds/email-templates.json'), 'utf8')).filter((item: any) => item.templateKey === 'prospect_forms_invitation');
const client = { firstName: 'Synthetic', email: 'prospect@example.test', loginPin: '654321' };
const links = { clientPortal: 'https://ibogaready.com/login', questionnaire: 'https://ibogaready.com/workflow?step=screening_questionnaire', healthQuestionnaire: 'https://ibogaready.com/workflow?step=questionnaire' };
const interpolate = (text: string) => text.replace(/\{\{([^}]+)\}\}/g, (_, key) => key.trim().split('.').reduce((value: any, part: string) => value?.[part], { client, links }) || '');
for (const width of [1440,390]) for (const language of ['en','cz','pl']) {
 test(`forms invitation ${language}/${width} previews and explicitly sends`, async ({ page, baseURL }) => {
  await page.setViewportSize({ width, height: 1000 });
  let sends = 0;
  await page.route('**/*', async route => {
   if (!['xhr','fetch'].includes(route.request().resourceType())) return route.continue();
   const url = new URL(route.request().url());
   const reply = (data: any) => route.fulfill({ json: data, headers: { 'Access-Control-Allow-Origin': baseURL!, 'Access-Control-Allow-Credentials': 'true' } });
   if (url.pathname === '/communications/templates') return reply(defaults.map((item: any) => ({ ...item, _id: item.language })));
   if (url.pathname === '/communications/settings') return reply({ senderName: 'Test team', senderEmail: 'team@example.test', autoCcEnabled: false });
   if (url.pathname === '/communications/preview') {
    const payload = route.request().postDataJSON();
    const template = defaults.find((item: any) => item.language === payload.templateId);
    return reply({ subject: interpolate(template.subject), bodyText: interpolate(template.bodyText), variables: { client, links } });
   }
   if (url.pathname === '/communications/send') {
    sends++;
    const payload = route.request().postDataJSON();
    expect(payload.to).toBe(client.email); expect(payload.templateId).toBe(language);
    expect(payload.bodyText).toContain(client.loginPin); expect(payload.bodyText).toContain(links.questionnaire); expect(payload.bodyText).toContain(links.healthQuestionnaire);
    return reply({ _id: 'sent-1', status: 'sent', provider: 'development_capture' });
   }
   return reply([]);
  });
  await page.goto(`/e2e/fixtures/forms-invitation.html?language=${language}`);
  await page.getByRole('button', { name: 'Send forms invitation', exact: true }).click();
  const body = page.locator('textarea').first();
  await expect(body).toHaveValue(interpolate(defaults.find((item: any) => item.language === language).bodyText));
  expect(sends).toBe(0);
  await page.screenshot({ path: `../ppvc-805-validation/invitation-${language}-${width}.png`, fullPage: true });
  await page.getByRole('button', { name: 'Send Email', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('development inbox');
  expect(sends).toBe(1);
 });
}
