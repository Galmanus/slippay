import type { Context, Next } from "hono";
import { ZodError } from "zod";

export async function errorMiddleware(c: Context, next: Next) {
  try {
    await next();
  } catch (e) {
    if (e instanceof ZodError) {
      return c.json({ error: "validation_error", issues: e.issues }, 400);
    }
    console.error("api_error", e);
    return c.json({ error: "internal_error" }, 500);
  }
}
