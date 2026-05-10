import { z } from "zod";

const brlAmount = z.string().regex(/^\d{1,9}\.\d{2}$/, "must be string with 2 decimals");

export const SubscriptionStatusSchema = z.enum([
  "active", "paused", "cancelled", "expired",
]);

export const AssetCodeSchema = z.enum(["USDC", "PYUSD"]);

export const CreateSubscriptionInputSchema = z.object({
  external_ref: z.string().max(120).optional(),
  buyer_stellar_address: z.string().length(56).optional(),
  buyer_email: z.string().email().optional(),
  asset_code: AssetCodeSchema.default("USDC"),
  brl_amount: brlAmount.refine(v => parseFloat(v) > 0, "must be > 0"),
  period_seconds: z.number().int().min(86400).max(31_536_000),  // 1 day to 1 year
  max_periods: z.number().int().min(1).max(120).optional(),
  expires_at: z.string().datetime().optional(),
  webhook_url: z.string().url().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const UpdateSubscriptionInputSchema = z.object({
  status: SubscriptionStatusSchema.optional(),
  webhook_url: z.string().url().nullable().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type CreateSubscriptionInput = z.infer<typeof CreateSubscriptionInputSchema>;
export type UpdateSubscriptionInput = z.infer<typeof UpdateSubscriptionInputSchema>;
export type SubscriptionStatus = z.infer<typeof SubscriptionStatusSchema>;
export type AssetCode = z.infer<typeof AssetCodeSchema>;
