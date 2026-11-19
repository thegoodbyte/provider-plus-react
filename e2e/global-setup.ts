import type { FullConfig } from '@playwright/test';

export default function setup(config: FullConfig) {
  if (process.env.SCRATCHPAD_FIXTURE_PATH && config.workers !== 1) {
    throw new Error('The shared scratchpad fixture resets its database. Run with --workers=1, or provide independently isolated fixtures before increasing concurrency.');
  }
}
