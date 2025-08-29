import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import confirm from "./api/confirm";
import subscription from "./api/subscription";
import user from "./api/user";

const app = new Elysia()
  .use(cors({
    origin: ['http://localhost:8080', 'http://127.0.0.1:8080'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  }))
  .onRequest((ctx) => {
    console.log('🚀 Request received:', ctx.request.method, ctx.request.url);
    
    // Log CORS-related headers
    const origin = ctx.request.headers.get('origin');
    const referer = ctx.request.headers.get('referer');
    const userAgent = ctx.request.headers.get('user-agent');
    
    console.log('🔒 CORS Debug Info:');
    console.log('  Origin:', origin);
    console.log('  Referer:', referer);
    console.log('  User-Agent:', userAgent);
    console.log('  Method:', ctx.request.method);
    console.log('  URL:', ctx.request.url);
    
    // Only log body for POST/PUT requests and if it exists
    if (['POST', 'PUT', 'PATCH'].includes(ctx.request.method) && ctx.request.body) {
      try {
        console.log('📦 Request body:', JSON.stringify(ctx.request.body, null, 2));
      } catch (error) {
        console.log('📦 Request body: [Unable to stringify]');
      }
    }
  })
  .mapResponse(({ response, set }) => {
    const isJson = typeof response === 'object'

    console.log('🚀 Response:', JSON.stringify(response, null, 2));
    const text = isJson
        ? JSON.stringify(response)
        : response?.toString() ?? ''

    set.headers['Content-Encoding'] = 'gzip'

    const encodedText = new TextEncoder().encode(text)
    const gzippedData = Bun.gzipSync(encodedText as Uint8Array<ArrayBuffer>)

    return new Response(
        gzippedData,
        {
            headers: {
                'Content-Type': `${
                    isJson ? 'application/json' : 'text/plain'
                }; charset=utf-8`
            }
        }
    )
  })
  .get("/", () => "Hello Elysia")
  .use(subscription)
  .use(confirm)
  .use(user)
  .listen(3000);

export type App = typeof app;

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
);
