import { treaty } from '@elysiajs/eden';
import type { App } from '@backend/index';

// Create the Eden Treaty client using backend types
export const api = treaty<App>('http://localhost:3000');