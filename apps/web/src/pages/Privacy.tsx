// /privacy — política de privacidade. Audiência primária: reviewer da Shopify
// App Store (campo obrigatório do listing) + merchants e usuários. Em inglês
// por isso. HONESTO: descreve só o que o produto realmente coleta e faz.
// Estilo documento, paleta da landing, sem marketing.

import { Link } from "react-router-dom";
import { Logo } from "../components/Logo.tsx";

const CONTACT_EMAIL = "manuel@bluewaveai.online";
const EFFECTIVE_DATE = "August 3, 2026";

const SECTIONS: [string, string[]][] = [
  [
    "What Slippay is",
    [
      "Slippay is non-custodial payment software. Money moves on the Stellar network between wallets controlled by our users. Slippay never holds, stores, or has access to user funds.",
      "This policy covers the Slippay web app (app.slippay.cc) and the Slippay app for Shopify.",
    ],
  ],
  [
    "Data we collect",
    [
      "Account data: the email address you sign up with, and the public part of your passkey (Face ID / fingerprint credential). We never see or store your biometrics; those stay on your device.",
      "Payment data: order identifiers, amounts, the Stellar addresses involved, and transaction hashes. Transactions on the Stellar network are public by design.",
      "Merchant data: your Stellar receive address, API credentials we issue to you, and webhook configuration.",
      "We do not collect browsing profiles, we do not run advertising trackers, and we do not sell data to anyone.",
    ],
  ],
  [
    "Data from Shopify stores",
    [
      "When a store installs the Slippay app for Shopify, we receive the store's domain, an API access token scoped to reading and writing orders, and order webhooks (order id, order number, amount, currency).",
      "We use this data for one purpose: matching a USDC payment to the Shopify order it pays for, marking that order as paid, and recording the transaction hash on the order as proof.",
      "We do not read products, inventory, marketing data, or anything beyond the order scope. Customer details included in Shopify's order payload are not used and not shared.",
    ],
  ],
  [
    "GDPR and data removal",
    [
      "The Shopify app implements Shopify's mandatory privacy webhooks: customers/data_request, customers/redact, and shop/redact. When a store uninstalls and Shopify sends shop/redact, we delete that store's stored data.",
      "For any other removal request, email us and we will delete your account data. Note that transactions already recorded on the Stellar network are public and permanent; that is a property of the network, not something any company can undo.",
    ],
  ],
  [
    "Where data lives and how long",
    [
      "Operational data is stored on servers we operate. We keep it while your account or store connection is active, and delete it on uninstall or on request as described above.",
      "For larger currency conversions, identity checks (KYC) are performed by our licensed foreign-exchange partner under their own privacy policy. Slippay is not a bank and does not perform KYC itself.",
    ],
  ],
  [
    "Contact",
    [
      `Questions or requests about your data: ${CONTACT_EMAIL}. We answer within 7 days.`,
    ],
  ],
];

export default function Privacy() {
  return (
    <div className="min-h-screen bg-[#f1eee7] text-[#0a0a0a] overflow-x-hidden">
      <header className="px-6 md:px-12 py-7 flex items-center justify-between border-b border-[#0a0a0a]/10">
        <Link to="/"><Logo /></Link>
        <nav className="flex items-center gap-8 text-[10px] uppercase tracking-[0.22em] text-[#0a0a0a]/55">
          <Link to="/" className="hover:text-[#0a0a0a]">Home</Link>
        </nav>
      </header>

      <main className="max-w-[760px] mx-auto px-6 md:px-12 pt-14 md:pt-20 pb-24">
        <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-[#A16207] mb-6">privacy policy</div>
        <h1 className="text-[32px] leading-[1.05] md:text-[44px] font-semibold tracking-[-0.04em]">
          Privacy policy
        </h1>
        <p className="mt-4 text-sm text-[#0a0a0a]/50">Effective {EFFECTIVE_DATE}</p>

        {SECTIONS.map(([title, paragraphs]) => (
          <section key={title} className="mt-12">
            <h2 className="text-xl md:text-2xl font-semibold tracking-[-0.02em]">{title}</h2>
            {paragraphs.map((p, i) => (
              <p key={i} className="mt-4 text-[15px] md:text-base text-[#0a0a0a]/70 leading-relaxed">{p}</p>
            ))}
          </section>
        ))}
      </main>

      <footer className="border-t border-[#0a0a0a]/10 px-6 md:px-12 py-8 text-xs text-[#0a0a0a]/45">
        slippay. · non-custodial by design
      </footer>
    </div>
  );
}
