// Wrapper so the Privy/viem stack (pulled eagerly by lib/enterpriseBase.tsx)
// only loads when /enterprise is visited, never in the entry chunk.
import EnterpriseBase from "./EnterpriseBase.tsx";
import { EnterpriseBaseProvider } from "../lib/enterpriseBase.tsx";

export default function EnterpriseGated() {
  return (
    <EnterpriseBaseProvider>
      <EnterpriseBase />
    </EnterpriseBaseProvider>
  );
}
