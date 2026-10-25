import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'./e2e',testMatch:'medical-profile-documents.spec.ts',workers:1,retries:0,timeout:30000,use:{baseURL:process.env.PLAYWRIGHT_BASE_URL||'http://127.0.0.1:5010',trace:'retain-on-failure',screenshot:'only-on-failure'},projects:[{name:'chromium',use:{browserName:'chromium'}}]});
