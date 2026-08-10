import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.tsx";
import { AuthProvider } from "./lib/auth.tsx";
import { ChainProvider } from "./components/ChainProvider.tsx";
// Space Grotesk is only used by LandingV3 — imported there, not here, so it
// stays out of the entry CSS.
import "@fontsource/space-mono/400.css";
import "@fontsource/space-mono/700.css";
// Inter Tight dropped: no font-family in src references it (checked 10/08).
// Inter
import "@fontsource/inter/300.css";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
// DM Sans
import "@fontsource/dm-sans/400.css";
import "@fontsource/dm-sans/500.css";
import "@fontsource/dm-sans/600.css";
import "@fontsource/dm-sans/700.css";
import "@fontsource/dm-sans/800.css";
// JetBrains Mono
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/500.css";
import "@fontsource/jetbrains-mono/600.css";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <ChainProvider>
          <App />
        </ChainProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
