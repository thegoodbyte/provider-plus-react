import { defineConfig } from '@playwright/test';
export default defineConfig({testDir:'./e2e',testMatch:['payment-from-sp.spec.ts','scratchpad-exact-date.spec.ts','scratchpad-request-amount.spec.ts'],workers:1,retries:0,timeout:45000,use:{baseURL:process.env.PLAYWRIGHT_BASE_URL||'http://127.0.0.1:4926',screenshot:'only-on-failure'},projects:[{name:'chromium',use:{browserName:'chromium'}}]});
