import { Link } from "react-router-dom";

export default function BusinessLanding() {
  return (
    <div style={{ background: "#f1eee7", minHeight: "100vh", color: "#0a0a0a", fontFamily: "inherit" }}>
      {/* Header */}
      <header style={{ padding: "24px 32px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid rgba(10,10,10,0.08)" }}>
        <Link to="/" style={{ fontFamily: "var(--font-display, serif)", fontSize: "1.25rem", fontWeight: 700, letterSpacing: "-0.02em", color: "#0a0a0a", textDecoration: "none" }}>
          slippay.
        </Link>
        <span style={{ fontSize: "0.7rem", letterSpacing: "0.12em", textTransform: "uppercase", background: "#FDDA24", color: "#0a0a0a", padding: "4px 10px", fontWeight: 700 }}>
          EM PILOTO PRIVADO
        </span>
      </header>

      {/* Hero */}
      <main style={{ maxWidth: 720, margin: "0 auto", padding: "80px 32px 64px" }}>
        <p style={{ fontSize: "0.7rem", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 24, opacity: 0.5 }}>
          SLIPPAY FOR BUSINESS
        </p>
        <h1 style={{ fontSize: "clamp(2rem, 5vw, 3.5rem)", fontWeight: 700, lineHeight: 1.08, letterSpacing: "-0.03em", marginBottom: 24 }}>
          Tesouraria em dólar para importação e exportação
        </h1>
        <p style={{ fontSize: "1.1rem", lineHeight: 1.6, opacity: 0.7, marginBottom: 56, maxWidth: 540 }}>
          Conta da empresa, câmbio R$↔USD e rendimento — sem custódia. Sua empresa controla, ninguém mais.
        </p>

        {/* Bullets */}
        <ul style={{ listStyle: "none", padding: 0, margin: "0 0 56px", display: "flex", flexDirection: "column", gap: 16 }}>
          {[
            "Conta corporativa — a empresa é dona das chaves",
            "Câmbio R$↔USD via parceiro licenciado",
            "Envie e receba dólares (USDC) em segundos",
            "O dólar parado rende — variável, sem garantia",
          ].map((item) => (
            <li key={item} style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
              <span style={{ width: 6, height: 6, background: "#FDDA24", borderRadius: "50%", marginTop: 8, flexShrink: 0 }} />
              <span style={{ fontSize: "1rem", lineHeight: 1.5 }}>{item}</span>
            </li>
          ))}
        </ul>

        {/* CTA */}
        <a
          href="mailto:comex@slippay.cc?subject=Slippay%20for%20business%20—%20acesso"
          style={{
            display: "inline-block",
            background: "#0a0a0a",
            color: "#f1eee7",
            padding: "16px 32px",
            fontSize: "0.85rem",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            fontWeight: 700,
            textDecoration: "none",
          }}
        >
          Solicitar acesso
        </a>

        {/* Disclaimer */}
        <p style={{ marginTop: 40, fontSize: "0.75rem", opacity: 0.4, lineHeight: 1.6, maxWidth: 480 }}>
          Produto em fase piloto. Rendimento é variável e não há garantia de retorno. Câmbio operado por parceiro licenciado pelo Banco Central.
        </p>
      </main>
    </div>
  );
}
