import { Routes, Route, Navigate } from "react-router-dom";
import Home from "./pages/Home.tsx";
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
import Store from "./pages/Store.tsx";
import Docs from "./pages/Docs.tsx";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/checkout/:order_id" element={<Checkout />} />
      <Route path="/demo" element={<Demo />} />
      <Route path="/preview" element={<Preview />} />
      <Route path="/x402-demo" element={<X402Demo />} />
      <Route path="/anchor-demo" element={<AnchorDemo />} />
      <Route path="/loja" element={<Store />} />
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
