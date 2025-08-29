# Elysia Eden Integration

This monorepo is set up with Elysia Eden for end-to-end type safety between the frontend and backend.

## Setup

### 1. Install Dependencies

First, install the required dependencies in the root directory:

```bash
bun install
```

This will install:
- `@elysiajs/eden` in the frontend
- `elysia` in both frontend and backend
- Set up the monorepo workspace structure

### 2. Backend Configuration

The backend exports its app type in `backend/src/index.ts`:

```typescript
export type App = typeof app;
```

This allows the frontend to have full type safety when calling backend endpoints.

### 3. Frontend Configuration

The frontend uses Eden Treaty to create a type-safe API client:

```typescript
import { treaty } from '@elysiajs/eden'
import type { App } from '@backend/index'

const api = treaty<App>('http://localhost:3000')
```

## Usage

### Basic API Calls

```typescript
// Call the root endpoint
const { data, error } = await api.get()

// Call subscription endpoint
const { data, error } = await api.subscription.transaction.post({
  account: 'wallet-address',
  amount: '49'
})

// Call confirm endpoint
const { data, error } = await api.confirm.transactions.post({
  transactions: ['signature'],
  payments: [/* payment data */]
})
```

### Error Handling

Eden provides structured error handling:

```typescript
const { data, error } = await api.subscription.transaction.post(request)

if (error) {
  // Handle validation or server errors
  const errorMessage = typeof error.value === 'string' ? error.value : 'Unknown error'
  throw new Error(errorMessage)
}

// Use the data
console.log(data)
```

### Type Safety

All API calls are fully typed based on your backend schema:

- Request bodies are validated against your Elysia validation schemas
- Response types are automatically inferred
- Path parameters are type-safe
- Auto-completion works for all endpoints

## File Structure

```
solana-sub/
├── backend/
│   └── src/
│       ├── index.ts          # Exports App type
│       ├── api/
│       │   ├── subscription.ts
│       │   └── confirm.ts
│       └── package.json
├── frontend/
│   └── src/
│       ├── hooks/
│       │   └── useSubscription.ts  # Uses Eden Treaty
│       ├── components/
│       │   └── SubscriptionModal.tsx
│       └── package.json
├── package.json              # Monorepo root
└── tsconfig.base.json       # Path aliases
```

## Path Aliases

The monorepo uses TypeScript path aliases for clean imports:

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@backend/*": ["./backend/src/*"],
      "@frontend/*": ["./frontend/src/*"]
    }
  }
}
```

This allows you to import backend types in the frontend:

```typescript
import type { App } from '@backend/index'
```

## Testing the Integration

Use the `EdenExample` component to test the API integration:

```typescript
import { EdenExample } from './examples/EdenExample'

// In your app
<EdenExample />
```

This component provides buttons to test all the backend endpoints and displays the results.

## Benefits

1. **Type Safety**: Full TypeScript support across the full stack
2. **Auto-completion**: IDE support for all API endpoints
3. **Validation**: Automatic request/response validation
4. **No Code Generation**: Pure TypeScript inference
5. **Real-time Updates**: Types update automatically when backend changes

## Troubleshooting

### Type Inference Issues

1. Make sure both frontend and backend use the same Elysia version
2. Ensure the backend exports the `App` type correctly
3. Check that path aliases are properly configured
4. Verify TypeScript strict mode is enabled

### Import Errors

1. Run `bun install` in the root directory
2. Check that `@elysiajs/eden` is installed in frontend
3. Verify the backend is running on the expected port
4. Ensure the monorepo workspace structure is correct

## Next Steps

1. Start the backend: `cd backend && bun run dev` (runs on port 3000)
2. Start the frontend: `cd frontend && bun run dev` (runs on port 8080)
3. Test the integration using the `EdenExample` component
4. Integrate the `SubscriptionModal` into your app
5. Customize the API calls based on your specific needs

## Port Configuration

- **Frontend**: Port 8080 (development server)
- **Backend**: Port 3000 (API server)
- **Direct URLs**: Components use `http://localhost:3000` directly for backend calls
