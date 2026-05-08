import { createClient } from "@supabase/supabase-js";
import { config } from "./config.js";

const SCHEMA = process.env.SLIPPAY_DB_SCHEMA ?? "public";

export const db = createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
  auth: { persistSession: false },
  db: { schema: SCHEMA },
});
