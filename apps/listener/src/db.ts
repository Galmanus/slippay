import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { config } from "./config.js";

const SCHEMA = process.env.SLIPPAY_DB_SCHEMA ?? "public";

// Cast to the default-generic SupabaseClient so consumers (watchAccount,
// startWebhookWorker, reconcileMatch, etc.) receive a uniformly-typed
// client regardless of which schema we routed it at runtime.
export const db: SupabaseClient = createClient(
  config.supabaseUrl,
  config.supabaseServiceRoleKey,
  {
    auth: { persistSession: false },
    db: { schema: SCHEMA },
  },
) as unknown as SupabaseClient;
