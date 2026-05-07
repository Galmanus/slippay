import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "../lib/auth.tsx";

export default function Signup() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const nav = useNavigate();
  return (
    <main className="max-w-sm mx-auto p-8">
      <h1 className="text-2xl font-semibold mb-6">sign up</h1>
      <form onSubmit={async (e) => {
        e.preventDefault(); setErr(null); setLoading(true);
        const { data, error } = await supabase.auth.signUp({ email, password });
        setLoading(false);
        if (error) { setErr(error.message); return; }
        if (data.session) nav("/dashboard");
        else setErr("check your email to confirm");
      }} className="space-y-3">
        <input value={email} onChange={e => setEmail(e.target.value)} type="email" placeholder="email" required className="w-full bg-zinc-900 rounded px-3 py-2" />
        <input value={password} onChange={e => setPassword(e.target.value)} type="password" placeholder="password" required minLength={8} className="w-full bg-zinc-900 rounded px-3 py-2" />
        <button disabled={loading} className="w-full bg-emerald-500 disabled:opacity-50 text-black py-2 rounded font-semibold">{loading ? "..." : "sign up"}</button>
        {err && <div className="text-amber-400 text-sm">{err}</div>}
      </form>
      <Link to="/login" className="text-sm text-zinc-400 mt-4 block">already have an account? log in</Link>
    </main>
  );
}
