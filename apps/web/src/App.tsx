import { Routes, Route } from "react-router-dom";
import AgentHome from "./pages/AgentHome.tsx";
import LandingV2 from "./pages/LandingV2.tsx";
import Cockpit from "./pages/Cockpit.tsx";
import Verify from "./pages/Verify.tsx";
import Home from "./pages/Home.tsx";
import Agents from "./pages/Agents.tsx";
import Comprovante from "./pages/Comprovante.tsx";
import Checkout from "./pages/Checkout.tsx";
import Sub from "./pages/Sub.tsx";
import Login from "./pages/Login.tsx";
import Signup from "./pages/Signup.tsx";
import Dashboard from "./pages/Dashboard.tsx";
import DashboardOverview from "./pages/DashboardOverview.tsx";
import DashboardOrders from "./pages/DashboardOrders.tsx";
import DashboardSubscriptions from "./pages/DashboardSubscriptions.tsx";
import DashboardSettings from "./pages/DashboardSettings.tsx";
import Demo from "./pages/Demo.tsx";
import Preview from "./pages/Preview.tsx";
import X402Demo from "./pages/X402Demo.tsx";
import AnchorDemo from "./pages/AnchorDemo.tsx";
import WithdrawDemo from "./pages/WithdrawDemo.tsx";
import BioTest from "./pages/BioTest.tsx";
import PayDemo from "./pages/PayDemo.tsx";
import Cobrar from "./pages/Cobrar.tsx";
import Account from "./pages/Account.tsx";
import Gate from "./pages/Gate.tsx";
import Store from "./pages/Store.tsx";
import PolicySubscribe from "./pages/PolicySubscribe.tsx";
import Docs from "./pages/Docs.tsx";
import Security from "./pages/Security.tsx";
import Manifesto from "./pages/Manifesto.tsx";
import Investidores from "./pages/Investidores.tsx";
import Conformidade from "./pages/Conformidade.tsx";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingV2 />} />
      <Route path="/v1" element={<AgentHome />} />
      <Route path="/v2" element={<LandingV2 />} />
      <Route path="/cockpit" element={<Cockpit />} />
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
      <Route path="/gate" element={<Gate />} />
      <Route path="/loja" element={<Store />} />
      <Route path="/s/:subId" element={<PolicySubscribe />} />
      <Route path="/docs" element={<Docs />} />
      <Route path="/docs/*" element={<Docs />} />
      <Route path="/seguranca" element={<Security />} />
      <Route path="/security" element={<Security />} />
      <Route path="/manifesto" element={<Manifesto />} />
      <Route path="/investidores" element={<Investidores />} />
      <Route path="/pitch" element={<Investidores />} />
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
  );
}
