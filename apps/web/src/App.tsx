import { Routes, Route } from "react-router-dom";
import Home from "./pages/Home.tsx";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="*" element={<div className="p-8">not found</div>} />
    </Routes>
  );
}
