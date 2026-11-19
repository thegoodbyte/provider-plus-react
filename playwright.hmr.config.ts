import config from "./playwright.smoke.config";
export default { ...config, testMatch: "**/migration.hmr.ts" };
