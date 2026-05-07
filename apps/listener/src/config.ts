function need(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`missing env ${name}`);
  return v;
}
export const config = {
  supabaseUrl: need("SUPABASE_URL"),
  supabaseServiceRoleKey: need("SUPABASE_SERVICE_ROLE_KEY"),
  network: (process.env.STELLAR_NETWORK ?? "TESTNET").toUpperCase() as "TESTNET" | "PUBLIC",
  merchantPollMs: Number(process.env.MERCHANT_POLL_MS ?? "30000"),
};
