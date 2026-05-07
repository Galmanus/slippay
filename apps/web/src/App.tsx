import { Routes, Route } from "react-router-dom";
import Home from "./pages/Home.tsx";
import Checkout from "./pages/Checkout.tsx";
import Login from "./pages/Login.tsx";
import Signup from "./pages/Signup.tsx";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/checkout/:order_id" element={<Checkout />} />
      <Route path="*" element={<div className="p-8">not found</div>} />
    </Routes>
  );
}
