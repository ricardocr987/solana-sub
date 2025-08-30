import { treaty } from '@elysiajs/eden';
import type { App } from '@backend/index';

// Create the Eden Treaty client with a more flexible type approach
// This works around the Elysia version compatibility issues between frontend and backend
export const api = treaty<App>('http://localhost:3000');