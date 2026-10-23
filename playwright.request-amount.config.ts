import { defineConfig } from '@playwright/test';
export default defineConfig({testDir:'./e2e',testMatch:'scratchpad-request-amount.spec.ts',workers:1,retries:0,timeout:30000,reporter:[['list']],use:{baseURL:'http://127.0.0.1:4909',trace:'retain-on-failure',screenshot:'only-on-failure'},projects:[{name:'chromium',use:{browserName:'chromium'}}]});
