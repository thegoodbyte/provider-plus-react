import { defineConfig } from "@playwright/test";
process.env.WORK_MODES_FIXTURE ||= "../ppvc-835-validation/fixture.json";
export default defineConfig({
  testDir: "./e2e",
  testMatch: "work-modes-persistence.spec.ts",
  workers: 1,
  retries: 0,
  timeout: 60000,
  use: {
    baseURL: "http://127.0.0.1:4854",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  reporter: [["list"]],
  outputDir: "../ppvc-835-validation/browser-artifacts",
});
