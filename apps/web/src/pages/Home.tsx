import { Link } from "react-router-dom";

export default function Home() {
  return (
    <div className="min-h-screen bg-[#f1eee7] text-[#0a0a0a]">
      <header className="max-w-[1400px] mx-auto px-8 md:px-12 py-8 flex items-center justify-between">
        <div className="text-sm tracking-tight font-medium">slippay</div>
        <nav className="flex items-center gap-8 text-xs uppercase tracking-[0.18em]">
          <a href="#how" className="hover:opacity-60">How it works</a>
          <a href="#stack" className="hover:opacity-60">Stack</a>
          <Link to="/login" className="hover:opacity-60">Log in</Link>
          <Link to="/signup"
            className="bg-[#0a0a0a] text-[#f1eee7] px-5 py-2.5 hover:bg-[#1a1a1a]">
            Sign up
          </Link>
        </nav>
      </header>

      <section className="max-w-[1400px] mx-auto px-8 md:px-12 pt-20 md:pt-32 pb-32 md:pb-48 relative">
        <div className="text-[10px] uppercase tracking-[0.3em] text-[#0a0a0a]/55 mb-12 flex items-center gap-3">
          <span className="inline-block w-3 h-3 bg-[#b5e853]" />
          Confidential · Pre-launch · 2026
        </div>
        <h1 className="text-[14vw] md:text-[10vw] font-medium leading-[0.88] tracking-[-0.04em] max-w-[14ch]">
          USDC checkout for Brazilian e‑commerce.
        </h1>
        <div className="grid md:grid-cols-2 gap-12 md:gap-32 mt-20 md:mt-32">
          <div className="text-xs uppercase tracking-[0.18em] text-[#0a0a0a]/55">
            001. The thesis
          </div>
          <p className="text-2xl md:text-3xl leading-[1.3] tracking-tight max-w-[28ch]">
            Non-custodial payment gateway built on Stellar. Settles in roughly five seconds.
            Merchants never wait, buyers never give up custody.
          </p>
        </div>
        <div className="mt-20 md:mt-32 flex flex-col sm:flex-row gap-4">
          <Link to="/signup"
            className="bg-[#0a0a0a] text-[#f1eee7] px-10 py-5 text-sm uppercase tracking-[0.18em] hover:bg-[#1a1a1a] text-center">
            Start accepting USDC
          </Link>
          <Link to="/login"
            className="border border-[#0a0a0a] text-[#0a0a0a] px-10 py-5 text-sm uppercase tracking-[0.18em] hover:bg-[#0a0a0a] hover:text-[#f1eee7] text-center">
            Merchant log in
          </Link>
        </div>
      </section>

      <section className="border-t border-[#0a0a0a]/10">
        <div className="max-w-[1400px] mx-auto px-8 md:px-12 py-20 md:py-32">
          <div className="grid md:grid-cols-12 gap-8 md:gap-16 items-start">
            <div className="md:col-span-3 text-xs uppercase tracking-[0.18em] text-[#0a0a0a]/55">
              002. Numbers
            </div>
            <div className="md:col-span-9 grid grid-cols-1 md:grid-cols-3 gap-12 md:gap-8">
              <div>
                <div className="text-7xl md:text-8xl font-medium tabular-nums tracking-tighter">~5s</div>
                <div className="mt-6 text-xs uppercase tracking-[0.18em] text-[#0a0a0a]/55">Settlement</div>
                <p className="mt-4 text-sm leading-relaxed text-[#0a0a0a]/70 max-w-[28ch]">
                  No batch windows, no T+1, no T+2. Confirmation lands in the next ledger.
                </p>
              </div>
              <div>
                <div className="text-7xl md:text-8xl font-medium tabular-nums tracking-tighter">0%</div>
                <div className="mt-6 text-xs uppercase tracking-[0.18em] text-[#0a0a0a]/55">Custody</div>
                <p className="mt-4 text-sm leading-relaxed text-[#0a0a0a]/70 max-w-[28ch]">
                  Funds move from buyer wallet to merchant wallet. Private keys never leave the user.
                </p>
              </div>
              <div>
                <div className="text-7xl md:text-8xl font-medium tabular-nums tracking-tighter">1%</div>
                <div className="mt-6 text-xs uppercase tracking-[0.18em] text-[#0a0a0a]/55">Platform fee</div>
                <p className="mt-4 text-sm leading-relaxed text-[#0a0a0a]/70 max-w-[28ch]">
                  Charged in the same atomic transaction as the merchant payment. Either both succeed, or neither does.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="how" className="border-t border-[#0a0a0a]/10">
        <div className="max-w-[1400px] mx-auto px-8 md:px-12 py-20 md:py-32">
          <div className="grid md:grid-cols-12 gap-8 md:gap-16">
            <div className="md:col-span-3 text-xs uppercase tracking-[0.18em] text-[#0a0a0a]/55">
              003. How it works
            </div>
            <div className="md:col-span-9">
              <h2 className="text-5xl md:text-7xl font-medium tracking-[-0.03em] leading-[0.95] max-w-[18ch]">
                Four moving parts. One atomic transaction.
              </h2>
              <div className="mt-20 grid md:grid-cols-2 gap-x-16 gap-y-16">
                <Step n="001" title="Merchant calls POST /v1/orders"
                  body="BRL amount in. Checkout URL, memo hash, USDC amount out. Rate locked at order creation." />
                <Step n="002" title="Buyer connects wallet, signs once"
                  body="Freighter, Lobstr, xBull, Albedo, Hana. One signature covers merchant payment AND platform fee in a single Stellar transaction." />
                <Step n="003" title="Listener confirms on-chain"
                  body="Horizon stream watches the merchant address, matches by memo, validates the amount, writes status=paid within the next ledger close." />
                <Step n="004" title="Webhook fires, signed with HMAC"
                  body="Merchant endpoint receives an order.paid event with x-slippay-signature. Exponential retry: 1m, 5m, 30m, 2h, 12h, 24h, then dead." />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="stack" className="border-t border-[#0a0a0a]/10">
        <div className="max-w-[1400px] mx-auto px-8 md:px-12 py-20 md:py-32">
          <div className="grid md:grid-cols-12 gap-8 md:gap-16">
            <div className="md:col-span-3 text-xs uppercase tracking-[0.18em] text-[#0a0a0a]/55">
              004. Regulatory
            </div>
            <div className="md:col-span-9">
              <h2 className="text-5xl md:text-7xl font-medium tracking-[-0.03em] leading-[0.95] max-w-[20ch]">
                Built for the window that just opened.
              </h2>
              <p className="mt-12 text-xl leading-relaxed text-[#0a0a0a]/70 max-w-[60ch]">
                BCB Resoluções 519/520/521 (effective February 2026) created the first
                complete framework for virtual-asset service providers in Brazil. SlipPay
                operates as a technology provider — atomic settlement, no custody, no money
                transmission — partnering with licensed VASPs for the regulated layer.
              </p>

              <div className="mt-20 grid grid-cols-2 md:grid-cols-4 gap-px bg-[#0a0a0a]/10 border border-[#0a0a0a]/10">
                <Cell label="Chain" value="Stellar" />
                <Cell label="Asset" value="USDC (Circle)" />
                <Cell label="Wallets" value="5 supported" />
                <Cell label="Finality" value="~5 seconds" />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-[#0a0a0a]/10">
        <div className="max-w-[1400px] mx-auto px-8 md:px-12 py-32 md:py-48 relative">
          <span className="inline-block w-3 h-3 bg-[#b5e853] mb-12" />
          <h2 className="text-[14vw] md:text-[10vw] font-medium tracking-[-0.04em] leading-[0.88] max-w-[12ch]">
            Ready when your store is.
          </h2>
          <p className="mt-12 text-xl text-[#0a0a0a]/70 max-w-[40ch]">
            Sign up, drop your Stellar receive address, copy your API key.
            First order in under five minutes.
          </p>
          <Link to="/signup"
            className="inline-block mt-16 bg-[#0a0a0a] text-[#f1eee7] px-12 py-5 text-sm uppercase tracking-[0.18em] hover:bg-[#1a1a1a]">
            Create merchant account
          </Link>
        </div>
      </section>

      <footer className="border-t border-[#0a0a0a]/10">
        <div className="max-w-[1400px] mx-auto px-8 md:px-12 py-8 flex flex-col md:flex-row items-center justify-between gap-4 text-[10px] uppercase tracking-[0.18em] text-[#0a0a0a]/55">
          <div>© 2026 slippay · pre-launch · confidential</div>
          <div className="flex gap-8">
            <a href="#" className="hover:text-[#0a0a0a]">Terms</a>
            <a href="#" className="hover:text-[#0a0a0a]">Privacy</a>
            <a href="#" className="hover:text-[#0a0a0a]">Docs</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

function Step({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-[0.18em] text-[#0a0a0a]/55 tabular-nums">{n}.</div>
      <div className="mt-3 text-2xl tracking-tight font-medium leading-[1.2]">{title}</div>
      <p className="mt-4 text-base leading-relaxed text-[#0a0a0a]/70 max-w-[40ch]">{body}</p>
    </div>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-[#f1eee7] p-6">
      <div className="text-[10px] uppercase tracking-[0.18em] text-[#0a0a0a]/55">{label}</div>
      <div className="mt-2 text-base font-medium tracking-tight">{value}</div>
    </div>
  );
}
