import { useCallback, useEffect, useState } from "react";
import { Logo } from "../components/Logo.tsx";
import { loadAccount, type Account } from "../lib/account.ts";
import {
  cancelRecovery, getGuardianState, removeGuardian, setGuardian,
  type GuardianState,
} from "../lib/guardian.ts";
import { hexToBytesSafe } from "../lib/passkeyHex.ts";

const RELAYER_BASE = (import.meta.env.VITE_RELAYER_BASE as string | undefined)
  ?? "https://api.slippay.cc/api/v1/relayer";

// Proteção de família — the guardian surface, in the mother's words. Zero
// jargon: no "multisig", no "rotation", no addresses beyond a paste field.
export default function Familia() {
  const [acct] = useState<Account | null>(() => loadAccount());
  const [state, setState] = useState<GuardianState | null>(null);
  const [guardianInput, setGuardianInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!acct) return;
    setState(await getGuardianState(acct));
  }, [acct]);
  useEffect(() => { void refresh(); }, [refresh]);

  async function run(action: () => Promise<string>) {
    setError(null); setTxHash(null); setBusy(true);
    try {
      const info = await fetch(`${RELAYER_BASE}/info`).then((r) => r.json()).catch(() => ({}));
      if (!info.sponsor) throw new Error("Sistema acordando. Tente de novo em instantes.");
      setTxHash(await action());
      await refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "erro desconhecido"); }
    finally { setBusy(false); }
  }

  const credId = acct?.credIdHex ? hexToBytesSafe(acct.credIdHex) : undefined;
  const sponsorOf = (info: { sponsor?: string }) => info.sponsor as string;

  async function doSet() {
    const g = guardianInput.trim();
    if (!g) { setError("cole o endereço da conta da pessoa de confiança"); return; }
    await run(async () => {
      const info = await fetch(`${RELAYER_BASE}/info`).then((r) => r.json());
      return setGuardian(acct!, RELAYER_BASE, sponsorOf(info), credId, g);
    });
  }
  async function doRemove() {
    await run(async () => {
      const info = await fetch(`${RELAYER_BASE}/info`).then((r) => r.json());
      return removeGuardian(acct!, RELAYER_BASE, sponsorOf(info), credId);
    });
  }
  async function doCancel() {
    await run(async () => {
      const info = await fetch(`${RELAYER_BASE}/info`).then((r) => r.json());
      return cancelRecovery(acct!, RELAYER_BASE, sponsorOf(info), credId);
    });
  }

  return (
    <div className="min-h-screen bg-[#f1eee7] text-[#0a0a0a] flex flex-col">
      <header className="max-w-[1400px] w-full mx-auto px-8 md:px-12 py-8 flex items-center justify-between">
        <Logo />
        <div className="text-[10px] uppercase tracking-[0.18em] text-[#0a0a0a]/55">Proteção de família</div>
      </header>

      <main className="flex-1 flex items-center">
        <div className="max-w-[1400px] w-full mx-auto px-8 md:px-12 grid md:grid-cols-12 gap-8 md:gap-16 py-16 md:py-24">
          <div className="md:col-span-3 text-xs uppercase tracking-[0.18em] text-[#0a0a0a]/55">
            <span className="inline-block w-3 h-3 bg-[#b5e853] mr-2 align-middle" />
            001. Sua família protegida
          </div>

          <div className="md:col-span-9 max-w-xl">
            {!acct || (state && !state.supported) ? (
              // No passkey account here, or an account from before the
              // guardian wallet — honest holding state, never a broken button.
              <>
                <p className="text-sm text-[#0a0a0a]/70 mb-2 leading-relaxed">
                  A proteção de família está chegando pra sua conta: você escolhe
                  alguém de confiança e, se um dia você não puder usar a conta,
                  essa pessoa recupera o seu dinheiro pra família. Sem cartório.
                </p>
                <div className="mt-6 text-[10px] uppercase tracking-[0.18em] text-[#0a0a0a]/45">Chegando</div>
              </>
            ) : state === null ? (
              <div className="text-sm text-[#0a0a0a]/50">Carregando…</div>
            ) : state.recoveryStartedAt !== null ? (
              // Active recovery — the contest banner. The single most
              // important screen in the whole feature (threat #2/#3).
              <>
                <div className="border-l-2 border-red-700 pl-4 mb-8">
                  <div className="text-xs uppercase tracking-[0.18em] text-red-700 mb-2">Atenção</div>
                  <p className="text-sm leading-relaxed">
                    Alguém pediu para recuperar a sua conta. Se foi você que pediu
                    (por exemplo, num aparelho novo), não precisa fazer nada. Se
                    você não reconhece esse pedido, toque abaixo — só o seu rosto
                    ou digital cancela.
                  </p>
                </div>
                <button onClick={doCancel} disabled={busy}
                  className="w-full bg-[#0a0a0a] text-[#f1eee7] py-5 text-sm uppercase tracking-[0.18em] hover:bg-[#1a1a1a] disabled:opacity-50">
                  {busy ? "Cancelando..." : "Não fui eu — cancelar agora"}
                </button>
              </>
            ) : state.guardian === null ? (
              // No guardian yet — the explainer + setup.
              <>
                <p className="text-sm text-[#0a0a0a]/70 mb-6 leading-relaxed">
                  Escolha alguém de confiança. Se você ficar 6 meses sem usar a
                  conta, essa pessoa pode recuperar o seu dinheiro pra família.
                  Sem cartório, sem inventário. Você pode trocar ou tirar quando
                  quiser, com um toque.
                </p>
                <p className="text-xs text-[#0a0a0a]/55 mb-4 leading-relaxed">
                  Importante: essa pessoa nunca consegue mexer no seu dinheiro.
                  E qualquer pedido de recuperação avisa você e espera 30 dias —
                  um toque seu cancela tudo.
                </p>
                <input type="text" value={guardianInput}
                  onChange={(e) => setGuardianInput(e.target.value)} disabled={busy}
                  placeholder="cole aqui o endereço da conta da pessoa"
                  className="w-full bg-transparent border-b border-[#0a0a0a]/30 text-sm font-mono py-3 disabled:opacity-60" />
                <button onClick={doSet} disabled={busy || !guardianInput.trim()}
                  className="mt-6 w-full bg-[#0a0a0a] text-[#f1eee7] py-5 text-sm uppercase tracking-[0.18em] hover:bg-[#1a1a1a] disabled:opacity-50">
                  {busy ? "Protegendo..." : "Proteger minha conta"}
                </button>
              </>
            ) : (
              // Guardian set — steady state.
              <>
                <div className="text-xs uppercase tracking-[0.18em] text-[#0a0a0a]/55 mb-2">Pessoa de confiança</div>
                <div className="text-sm font-mono break-all mb-2">{state.guardian}</div>
                <p className="text-xs text-[#0a0a0a]/55 mb-8 leading-relaxed">
                  Se a sua conta ficar 6 meses parada, essa pessoa pode pedir a
                  recuperação. Você é avisada e tem 30 dias pra cancelar com um
                  toque. Ela nunca consegue mexer no seu dinheiro.
                </p>
                <div className="flex gap-2 text-sm uppercase tracking-[0.18em]">
                  <button onClick={doRemove} disabled={busy}
                    className="flex-1 py-3 border border-[#0a0a0a]/20 text-[#0a0a0a]/60 hover:border-[#0a0a0a] hover:text-[#0a0a0a] disabled:opacity-50">
                    {busy ? "..." : "Tirar proteção"}
                  </button>
                </div>
              </>
            )}

            {txHash && (
              <div className="mt-6 border-l-2 border-[#b5e853] pl-4">
                <div className="text-[10px] uppercase tracking-[0.18em] flex items-center gap-2">
                  <span className="inline-block w-1.5 h-1.5 bg-[#b5e853]" /> Confirmado · comprovante público
                </div>
                <a className="text-xs font-mono mt-2 block break-all hover:opacity-60"
                   href={`https://stellar.expert/explorer/${acct?.network === "PUBLIC" ? "public" : "testnet"}/tx/${txHash}`}
                   target="_blank" rel="noreferrer">{txHash}</a>
              </div>
            )}
            {error && <div className="mt-6 text-xs uppercase tracking-[0.18em] text-red-700 border-l-2 border-red-700 pl-3">{error}</div>}
          </div>
        </div>
      </main>

      <footer className="border-t border-[#0a0a0a]/10">
        <div className="max-w-[1400px] mx-auto px-8 md:px-12 py-6 text-[10px] uppercase tracking-[0.18em] text-[#0a0a0a]/55">
          Quem você escolhe nunca move o seu dinheiro · todo pedido avisa você e espera 30 dias
        </div>
      </footer>
    </div>
  );
}
