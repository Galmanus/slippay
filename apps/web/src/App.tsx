import { Routes, Route, Navigate } from "react-router-dom";
import Home from "./pages/Home.tsx";
import Agents from "./pages/Agents.tsx";
import Checkout from "./pages/Checkout.tsx";
import Login from "./pages/Login.tsx";
import Signup from "./pages/Signup.tsx";
import Dashboard from "./pages/Dashboard.tsx";
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
import Store from "./pages/Store.tsx";
import PolicySubscribe from "./pages/PolicySubscribe.tsx";
import Docs from "./pages/Docs.tsx";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/agents" element={<Agents />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/checkout/:order_id" element={<Checkout />} />
      <Route path="/demo" element={<Demo />} />
      <Route path="/preview" element={<Preview />} />
      <Route path="/x402-demo" element={<X402Demo />} />
      <Route path="/anchor-demo" element={<AnchorDemo />} />
      <Route path="/withdraw-demo" element={<WithdrawDemo />} />
      <Route path="/bio" element={<BioTest />} />
      <Route path="/pay" element={<PayDemo />} />
      <Route path="/cobrar" element={<Cobrar />} />
      <Route path="/loja" element={<Store />} />
      <Route path="/s/:subId" element={<PolicySubscribe />} />
      <Route path="/docs" element={<Docs />} />
      <Route path="/docs/*" element={<Docs />} />
      <Route path="/dashboard" element={<Dashboard />}>
        <Route index element={<Navigate to="orders" replace />} />
        <Route path="orders" element={<DashboardOrders />} />
        <Route path="subscriptions" element={<DashboardSubscriptions />} />
        <Route path="settings" element={<DashboardSettings />} />
      </Route>
      <Route path="*" element={<div className="p-8">not found</div>} />
    </Routes>
  );
}
