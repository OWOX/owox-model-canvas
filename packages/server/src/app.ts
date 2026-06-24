import Fastify from "fastify";
import cookie from "@fastify/cookie";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import { authRoutes } from "./routes/auth";
import { dataMartRoutes } from "./routes/datamarts";
import { metaRoutes } from "./routes/meta";
import { questionsRoutes } from "./routes/questions";

export function buildApp() {
  // trustProxy: Render terminates TLS and forwards via its load balancer, so
  // req.ip must be derived from X-Forwarded-For. Without this every client
  // looks like the proxy IP and the per-IP rate limiter throttles everyone
  // together.
  const app = Fastify({ logger: false, trustProxy: true });
  app.register(cookie);

  // Security headers. script-src stays 'self' plus the PostHog managed proxy
  // (mrph.owox.com) — that proxy serves both the recorder/array bundles
  // (upstream asset_host is null) and the ingestion endpoint, so it must be in
  // script-src and connect-src. 'self' remains the main XSS guard for the OWOX
  // key kept in localStorage; the Vite build itself has no inline scripts.
  // style-src needs 'unsafe-inline' because @xyflow/react positions nodes via
  // inline style attributes; without it the canvas breaks. worker-src allows
  // blob: because PostHog session replay runs its recorder in a web worker.
  const POSTHOG_PROXY = "https://mrph.owox.com";
  app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        baseUri: ["'self'"],
        scriptSrc: ["'self'", POSTHOG_PROXY],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "blob:"],
        fontSrc: ["'self'", "data:"],
        connectSrc: ["'self'", POSTHOG_PROXY],
        workerSrc: ["'self'", "blob:"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
        formAction: ["'self'"],
      },
    },
    // We load no cross-origin embedded resources; COEP only risks breakage.
    crossOriginEmbedderPolicy: false,
  });

  // Per-IP rate limiting. The global cap guards against single-source floods on
  // the 0.5-CPU instance; /api/auth/connect (the only endpoint that triggers an
  // outbound OWOX token exchange) is capped much tighter in routes/auth.ts.
  app.register(rateLimit, {
    global: true,
    max: Number(process.env.RATE_LIMIT_MAX) || 1000,
    timeWindow: process.env.RATE_LIMIT_WINDOW || "1 minute",
  });

  app.register(authRoutes);
  app.register(dataMartRoutes);
  app.register(metaRoutes);
  app.register(questionsRoutes);
  // Surface the real upstream error (OwoxClient throws with the OWOX status +
  // body) instead of Fastify's generic "Internal Server Error". Preserve any
  // explicit statusCode (e.g. the rate limiter's 429); default to 502 for
  // upstream OWOX failures, which carry no statusCode.
  app.setErrorHandler((err: Error & { statusCode?: number }, _req, reply) => {
    const code = err.statusCode && err.statusCode >= 400 ? err.statusCode : 502;
    reply.code(code).send({ error: err.message || "Upstream error" });
  });
  return app;
}
