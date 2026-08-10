import { Routes, Route } from "react-router-dom";
import { lazy, Suspense } from "react";
// LandingV2 stays eager: it's the `/` money page and pulls no chain SDKs, so
// keeping it in the entry chunk gives instant first paint with no lazy roundtrip.
import LandingV2 from "./pages/LandingV2.tsx";

const AgentHome = lazy(() => import("./pages/AgentHome.tsx"));
const LandingV3 = lazy(() => import("./pages/LandingV3.tsx"));
const Builders = lazy(() => import("./pages/Builders.tsx"));
const Verify = lazy(() => import("./pages/Verify.tsx"));
const Home = lazy(() => import("./pages/Home.tsx"));
const Agents = lazy(() => import("./pages/Agents.tsx"));
const Comprovante = lazy(() => import("./pages/Comprovante.tsx"));
const Checkout = lazy(() => import("./pages/Checkout.tsx"));
const Sub = lazy(() => import("./pages/Sub.tsx"));
const Login = lazy(() => import("./pages/Login.tsx"));
const Signup = lazy(() => import("./pages/Signup.tsx"));
const Dashboard = lazy(() => import("./pages/Dashboard.tsx"));
const DashboardOverview = lazy(() => import("./pages/DashboardOverview.tsx"));
const DashboardOrders = lazy(() => import("./pages/DashboardOrders.tsx"));
const DashboardSubscriptions = lazy(() => import("./pages/DashboardSubscriptions.tsx"));
const DashboardSettings = lazy(() => import("./pages/DashboardSettings.tsx"));
const Demo = lazy(() => import("./pages/Demo.tsx"));
const Preview = lazy(() => import("./pages/Preview.tsx"));
const X402Demo = lazy(() => import("./pages/X402Demo.tsx"));
const AnchorDemo = lazy(() => import("./pages/AnchorDemo.tsx"));
const WithdrawDemo = lazy(() => import("./pages/WithdrawDemo.tsx"));
const BioTest = lazy(() => import("./pages/BioTest.tsx"));
const PayDemo = lazy(() => import("./pages/PayDemo.tsx"));
const Cobrar = lazy(() => import("./pages/Cobrar.tsx"));
const Account = lazy(() => import("./pages/Account.tsx"));
const Cash = lazy(() => import("./pages/Cash.tsx"));
const Gate = lazy(() => import("./pages/Gate.tsx"));
const Store = lazy(() => import("./pages/Store.tsx"));
const PolicySubscribe = lazy(() => import("./pages/PolicySubscribe.tsx"));
const Docs = lazy(() => import("./pages/Docs.tsx"));
const Security = lazy(() => import("./pages/Security.tsx"));
const Manifesto = lazy(() => import("./pages/Manifesto.tsx"));
const Investors = lazy(() => import("./pages/Investors.tsx"));
const Conformidade = lazy(() => import("./pages/Conformidade.tsx"));
const PixPay = lazy(() => import("./pages/PixPay.tsx"));
const Vault = lazy(() => import("./pages/Vault.tsx"));
const Familia = lazy(() => import("./pages/Familia.tsx"));
const ZkRedirect = lazy(() => import("./pages/ZkRedirect.tsx"));
const Receber = lazy(() => import("./pages/Receber.tsx"));
const Empresas = lazy(() => import("./pages/Empresas.tsx"));
const Privacy = lazy(() => import("./pages/Privacy.tsx"));
const EnterpriseGated = lazy(() => import("./pages/EnterpriseGated.tsx"));
const BusinessLanding = lazy(() => import("./pages/enterprise/BusinessLanding"));

export default function App() {
  return (
    <Suspense fallback={null}>
      <Routes>
        <Route path="/" element={<LandingV2 />} />
        <Route path="/v3" element={<LandingV3 />} />
        <Route path="/zk" element={<ZkRedirect />} />
        <Route path="/cofrinho-landing" element={<LandingV2 />} />
        <Route path="/receber" element={<Receber />} />
        {import.meta.env.VITE_PAGFINANCE_ENABLED === "1" && <Route path="/pix-pay" element={<PixPay />} />}
        {import.meta.env.VITE_ENTERPRISE_ENABLED === "1" && (
          <Route path="/enterprise" element={
            import.meta.env.VITE_PRIVY_APP_ID
              ? <EnterpriseGated />
              : <BusinessLanding />
          } />
        )}
        {import.meta.env.VITE_DEFINDEX_ENABLED === "1" && <Route path="/cofre" element={<Vault />} />}
        <Route path="/familia" element={<Familia />} />
        <Route path="/empresas" element={<Empresas />} />
        <Route path="/b2b" element={<Empresas />} />
        <Route path="/v1" element={<AgentHome />} />
        <Route path="/builders" element={<Builders />} />
        <Route path="/v2" element={<LandingV2 />} />
        <Route path="/human" element={<Home />} />
        <Route path="/verify" element={<Verify />} />
        <Route path="/agents" element={<Agents />} />
        <Route path="/comprovante/:txhash" element={<Comprovante />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/checkout/:order_id" element={<Checkout />} />
        <Route path="/sub/:id" element={<Sub />} />
        <Route path="/demo" element={<Demo />} />
        <Route path="/preview" element={<Preview />} />
        <Route path="/x402-demo" element={<X402Demo />} />
        <Route path="/anchor-demo" element={<AnchorDemo />} />
        <Route path="/withdraw-demo" element={<WithdrawDemo />} />
        <Route path="/bio" element={<BioTest />} />
        <Route path="/pay" element={<PayDemo />} />
        <Route path="/cobrar" element={<Cobrar />} />
        <Route path="/account" element={<Account />} />
        <Route path="/buy" element={<Cash />} />
        <Route path="/comprar" element={<Cash />} />
        <Route path="/cash" element={<Cash />} />
        <Route path="/pix" element={<Cash />} />
        <Route path="/gate" element={<Gate />} />
        <Route path="/loja" element={<Store />} />
        <Route path="/s/:subId" element={<PolicySubscribe />} />
        <Route path="/docs" element={<Docs />} />
        <Route path="/docs/*" element={<Docs />} />
        <Route path="/seguranca" element={<Security />} />
        <Route path="/security" element={<Security />} />
        <Route path="/manifesto" element={<Manifesto />} />
        <Route path="/investors" element={<Investors />} />
        <Route path="/investidores" element={<Investors />} />
        <Route path="/pitch" element={<Investors />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/privacidade" element={<Privacy />} />
        <Route path="/conformidade" element={<Conformidade />} />
        <Route path="/compliance" element={<Conformidade />} />
        <Route path="/dashboard" element={<Dashboard />}>
          <Route index element={<DashboardOverview />} />
          <Route path="orders" element={<DashboardOrders />} />
          <Route path="subscriptions" element={<DashboardSubscriptions />} />
          <Route path="settings" element={<DashboardSettings />} />
        </Route>
        <Route path="*" element={<div className="p-8">not found</div>} />
      </Routes>
    </Suspense>
  );
}
