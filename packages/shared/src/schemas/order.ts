import { z } from "zod";

const brlAmount = z.string().regex(/^\d{1,9}\.\d{2}$/, "must be string with 2 decimals");

export const CreateOrderInputSchema = z.object({
  brl_amount: brlAmount.refine(v => parseFloat(v) > 0, "must be > 0"),
  external_ref: z.string().max(120).optional(),
  expires_in_minutes: z.number().int().min(5).max(1440).optional(),
});

export const OrderStatusSchema = z.enum([
  "pending","paid","underpaid","expired","cancelled","dead",
]);

export type CreateOrderInput = z.infer<typeof CreateOrderInputSchema>;
