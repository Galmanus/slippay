import { z } from "zod";
import { STELLAR_ADDRESS_LENGTH } from "../constants.ts";

const stellarAddress = z.string().length(STELLAR_ADDRESS_LENGTH).regex(/^G[A-Z0-9]{55}$/);
const httpsUrl = z.string().url().regex(/^https:\/\//);

export const CreateMerchantInputSchema = z.object({
  display_name: z.string().min(1).max(120),
  stellar_address: stellarAddress.optional(),
  webhook_url: httpsUrl.optional(),
});

export const PatchMerchantInputSchema = CreateMerchantInputSchema.partial();

export type CreateMerchantInput = z.infer<typeof CreateMerchantInputSchema>;
export type PatchMerchantInput = z.infer<typeof PatchMerchantInputSchema>;
