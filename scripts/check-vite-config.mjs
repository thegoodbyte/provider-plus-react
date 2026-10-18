import { loadConfigFromFile } from 'vite';
import { checkViteConfig } from '@ibogaspirit/frontend-tooling/check-config';
await checkViteConfig(loadConfigFromFile);
