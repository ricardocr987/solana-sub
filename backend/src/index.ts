import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import confirm from "./api/confirm";
import subscription from "./api/subscription";

const app = new Elysia()
  .use(cors({
    origin: ['http://localhost:8080', 'http://127.0.0.1:8080'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  }))
  .get("/", () => "Hello Elysia")
  .use(subscription)
  .use(confirm)
  .listen(3000);

export type App = typeof app;

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
);
