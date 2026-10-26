import { defineConfig } from '@playwright/test';
const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:4937';
export default defineConfig({testDir:'./e2e',testMatch:'mrr-follow-up-and-client-header.spec.ts',workers:1,retries:0,timeout:30000,reporter:[['list']],use:{baseURL,trace:'retain-on-failure',screenshot:'only-on-failure',storageState:{cookies:[],origins:[{origin:baseURL,localStorage:[{name:'token',value:'e2e-token'},{name:'user',value:JSON.stringify({id:'admin-e2e',email:'admin@example.com',role:'admin'})}]}]}},projects:[{name:'chromium',use:{browserName:'chromium'}}]});
