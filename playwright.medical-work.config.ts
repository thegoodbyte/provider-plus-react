import {defineConfig} from '@playwright/test';
process.env.MEDICAL_WORK_FIXTURE ||= '../ppvc-836-validation/fixture.json';
export default defineConfig({testDir:'./e2e',testMatch:'medical-work-mode.spec.ts',workers:1,retries:0,timeout:60000,use:{baseURL:'http://127.0.0.1:4864',trace:'retain-on-failure',screenshot:'only-on-failure'},reporter:[['list']],outputDir:'../ppvc-836-validation/browser-artifacts'});
