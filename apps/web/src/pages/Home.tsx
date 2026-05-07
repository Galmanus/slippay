import { Link } from "react-router-dom";

export default function Home() {
  return (
    <div className="min-h-screen bg-[#0a0e1a] text-zinc-100">
      <header className="max-w-6xl mx-auto px-6 py-6 flex items-center justify-between">
        <div className="font-semibold tracking-tight text-lg">slippay</div>
        <nav className="flex items-center gap-6 text-sm">
          <a href="#how" className="text-zinc-400 hover:text-zinc-100">how it works</a>
          <a href="#stack" className="text-zinc-400 hover:text-zinc-100">stack</a>
          <Link to="/login" className="text-zinc-400 hover:text-zinc-100">log in</Link>
          <Link to="/signup"
            className="bg-[#b5e853] text-[#0a0e1a] font-semibold px-4 py-1.5 rounded hover:bg-[#c4f56a]">
            sign up
          </Link>
        </nav>
      </header>

      <section className="max-w-6xl mx-auto px-6 pt-24 pb-32">
        <div className="text-xs uppercase tracking-[0.2em] text-[#b5e853] mb-8">
          confidential · pre-launch · 2026
        </div>
        <h1 className="text-6xl md:text-8xl font-semibold leading-[0.95] tracking-tight max-w-4xl">
          USDC checkout for brazilian e-commerce.
        </h1>
        <p className="text-xl md:text-2xl text-zinc-400 mt-12 max-w-2xl leading-relaxed">
          non-custodial payment gateway built on Stellar.
          settles in ~5 seconds.
          merchants never wait, buyers never give up custody.
        </p>
        <div className="mt-16 flex flex-col sm:flex-row gap-4">
          <Link to="/signup"
            className="bg-[#b5e853] text-[#0a0e1a] font-semibold px-8 py-4 rounded hover:bg-[#c4f56a] text-center">
            start accepting USDC
          </Link>
          <Link to="/login"
            className="border border-zinc-700 hover:border-zinc-500 text-zinc-300 px-8 py-4 rounded text-center">
            merchant log in
          </Link>
        </div>
      </section>

      <section className="border-t border-zinc-900">
        <div className="max-w-6xl mx-auto px-6 py-24">
          <div className="grid md:grid-cols-3 gap-px bg-zinc-900">
            <div className="bg-[#0a0e1a] p-8">
              <div className="text-[#b5e853] text-3xl font-semibold tabular-nums">~5s</div>
              <div className="text-sm text-zinc-500 mt-1">settlement on Stellar</div>
              <p className="text-zinc-400 text-sm mt-4 leading-relaxed">
                no batch windows, no T+1, no T+2. confirmation lands in the next ledger.
              </p>
            </div>
            <div className="bg-[#0a0e1a] p-8">
              <div className="text-[#b5e853] text-3xl font-semibold tabular-nums">0%</div>
              <div className="text-sm text-zinc-500 mt-1">platform custody</div>
              <p className="text-zinc-400 text-sm mt-4 leading-relaxed">
                payments move directly from buyer wallet to merchant wallet. private keys never leave the user.
              </p>
            </div>
            <div className="bg-[#0a0e1a] p-8">
              <div className="text-[#b5e853] text-3xl font-semibold tabular-nums">1%</div>
              <div className="text-sm text-zinc-500 mt-1">platform fee</div>
              <p className="text-zinc-400 text-sm mt-4 leading-relaxed">
                charged in the same atomic transaction as the merchant payment. either both succeed, or neither does.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section id="how" className="border-t border-zinc-900">
        <div className="max-w-6xl mx-auto px-6 py-24">
          <div className="text-xs uppercase tracking-[0.2em] text-zinc-500 mb-4">how it works</div>
          <h2 className="text-4xl md:text-5xl font-semibold tracking-tight max-w-3xl">
            four moving parts. one atomic transaction.
          </h2>

          <div className="mt-16 grid md:grid-cols-2 gap-12">
            <div>
              <div className="text-[#b5e853] font-semibold text-sm">01.</div>
              <div className="text-xl font-semibold mt-2">merchant calls POST /v1/orders</div>
              <p className="text-zinc-400 mt-3 leading-relaxed">
                BRL amount goes in. checkout URL, memo hash, and USDC amount come back.
                rate locked at order creation.
              </p>
            </div>
            <div>
              <div className="text-[#b5e853] font-semibold text-sm">02.</div>
              <div className="text-xl font-semibold mt-2">buyer connects wallet, signs once</div>
              <p className="text-zinc-400 mt-3 leading-relaxed">
                Freighter, Lobstr, xBull, Albedo, or Hana. one signature covers
                the merchant payment AND the platform fee in a single Stellar transaction.
              </p>
            </div>
            <div>
              <div className="text-[#b5e853] font-semibold text-sm">03.</div>
              <div className="text-xl font-semibold mt-2">listener confirms on-chain</div>
              <p className="text-zinc-400 mt-3 leading-relaxed">
                Horizon stream watches the merchant address, matches by memo, validates the amount,
                writes status=paid to the database within the next ledger close.
              </p>
            </div>
            <div>
              <div className="text-[#b5e853] font-semibold text-sm">04.</div>
              <div className="text-xl font-semibold mt-2">webhook fires, signed with HMAC</div>
              <p className="text-zinc-400 mt-3 leading-relaxed">
                merchant endpoint receives an order.paid event with x-slippay-signature.
                exponential retry: 1m, 5m, 30m, 2h, 12h, 24h, then dead.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section id="stack" className="border-t border-zinc-900">
        <div className="max-w-6xl mx-auto px-6 py-24">
          <div className="text-xs uppercase tracking-[0.2em] text-zinc-500 mb-4">tech</div>
          <h2 className="text-4xl md:text-5xl font-semibold tracking-tight max-w-3xl">
            built for the regulatory window that just opened.
          </h2>
          <p className="text-zinc-400 mt-8 max-w-2xl leading-relaxed">
            BCB Resoluções 519/520/521 (effective February 2026) created the first complete
            framework for virtual-asset service providers in Brazil. SlipPay operates as a
            technology provider — atomic settlement, no custody, no money transmission —
            partnering with licensed VASPs for the regulated layer.
          </p>

          <div className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div className="border border-zinc-800 rounded p-4">
              <div className="text-zinc-500 text-xs uppercase tracking-wider">chain</div>
              <div className="mt-1 font-semibold">Stellar</div>
            </div>
            <div className="border border-zinc-800 rounded p-4">
              <div className="text-zinc-500 text-xs uppercase tracking-wider">asset</div>
              <div className="mt-1 font-semibold">USDC (Circle)</div>
            </div>
            <div className="border border-zinc-800 rounded p-4">
              <div className="text-zinc-500 text-xs uppercase tracking-wider">wallets</div>
              <div className="mt-1 font-semibold">Freighter, Lobstr, +3</div>
            </div>
            <div className="border border-zinc-800 rounded p-4">
              <div className="text-zinc-500 text-xs uppercase tracking-wider">finality</div>
              <div className="mt-1 font-semibold">~5 seconds</div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-zinc-900">
        <div className="max-w-6xl mx-auto px-6 py-32 text-center">
          <h2 className="text-5xl md:text-7xl font-semibold tracking-tight max-w-3xl mx-auto leading-[0.95]">
            ready when your store is.
          </h2>
          <p className="text-zinc-400 mt-8 max-w-xl mx-auto">
            sign up, drop your stellar receive address, copy your API key.
            first order in under five minutes.
          </p>
          <Link to="/signup"
            className="inline-block mt-12 bg-[#b5e853] text-[#0a0e1a] font-semibold px-10 py-4 rounded hover:bg-[#c4f56a]">
            create merchant account
          </Link>
        </div>
      </section>

      <footer className="border-t border-zinc-900">
        <div className="max-w-6xl mx-auto px-6 py-8 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-zinc-600">
          <div>© 2026 slippay · pre-launch · confidential</div>
          <div className="flex gap-6">
            <a href="#" className="hover:text-zinc-400">terms</a>
            <a href="#" className="hover:text-zinc-400">privacy</a>
            <a href="#" className="hover:text-zinc-400">docs</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
