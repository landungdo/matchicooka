import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase.js";

const PRESETS = [
  { key: "normal",    label: "Normal",    patch: { status: "normal",    accepting_orders: true,  min_prep_minutes: 10, max_prep_minutes: 15 } },
  { key: "busy",      label: "Busy",      patch: { status: "busy",      accepting_orders: true,  min_prep_minutes: 20, max_prep_minutes: 30 } },
  { key: "very_busy", label: "Very busy", patch: { status: "very_busy", accepting_orders: true,  min_prep_minutes: 30, max_prep_minutes: 45 } },
  { key: "paused",    label: "Pause orders", patch: { status: "paused", accepting_orders: false } },
  { key: "closed",    label: "Close shop",   patch: { status: "closed", accepting_orders: false } },
];

export default function ShopStatusControl() {
  const [s, setS] = useState(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState("");

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("shop_status").select("*").eq("id", 1).single();
      setS(data); setMsg(data?.message || "");
    })();
  }, []);

  const apply = async (patch) => {
    setBusy(true); setSaved("");
    const { error } = await supabase.from("shop_status").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", 1);
    setBusy(false);
    if (error) { alert(error.message || "Update failed"); return; }
    const { data } = await supabase.from("shop_status").select("*").eq("id", 1).single();
    setS(data); setSaved("Updated ✓"); setTimeout(() => setSaved(""), 2000);
  };

  const saveMsg = () => apply({ message: msg.trim() || null });

  if (!s) return <div className="sc-wrap">Loading…</div>;

  return (
    <div className="sc-wrap">
      <div className="sc-now">
        Current: <b>{s.status}</b>{s.accepting_orders ? ` · accepting · ~${s.min_prep_minutes}–${s.max_prep_minutes} min` : " · not accepting orders"}
        {saved && <span className="sc-saved">{saved}</span>}
      </div>

      <div className="sc-grid">
        {PRESETS.map((p) => (
          <button key={p.key} className={"sc-btn" + (s.status === p.key ? " on" : "")} disabled={busy} onClick={() => apply(p.patch)}>
            {p.label}
          </button>
        ))}
      </div>

      <label className="sc-lbl">Message to customers (optional)</label>
      <div className="sc-msgrow">
        <input className="sc-input" placeholder="e.g. Busy right now, thanks for waiting 🍵" value={msg} onChange={(e) => setMsg(e.target.value)} />
        <button className="sc-save" disabled={busy} onClick={saveMsg}>Save</button>
      </div>

      <style>{`
        .sc-wrap{flex:1;overflow-y:auto;padding:1.4rem;font-family:Inter,system-ui,sans-serif;color:#304236;}
        .sc-now{background:#F8F5ED;padding:.8rem 1rem;border-radius:12px;font-size:.9rem;margin-bottom:1.2rem;}
        .sc-now b{text-transform:capitalize;}
        .sc-saved{color:#4c7a3f;font-weight:600;margin-left:.6rem;}
        .sc-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:.6rem;margin-bottom:1.4rem;}
        .sc-btn{border:1.5px solid rgba(48,66,54,.14);background:#FCFBF7;padding:.8rem;border-radius:14px;
          font-weight:600;font-size:.9rem;color:#304236;cursor:pointer;font-family:inherit;transition:all .15s;}
        .sc-btn:hover{border-color:#6F8F62;}
        .sc-btn.on{background:#6F8F62;color:#fff;border-color:#6F8F62;}
        .sc-btn:disabled{opacity:.5;cursor:not-allowed;}
        .sc-lbl{display:block;font-size:.8rem;color:#8a988a;margin-bottom:.4rem;font-weight:600;}
        .sc-msgrow{display:flex;gap:.5rem;}
        .sc-input{flex:1;padding:.7rem .9rem;border-radius:12px;border:1.5px solid rgba(48,66,54,.14);
          background:#F8F5ED;font-family:inherit;font-size:.9rem;color:#304236;}
        .sc-input:focus{outline:none;border-color:#6F8F62;}
        .sc-save{border:none;background:#6F8F62;color:#fff;font-weight:600;padding:.7rem 1.2rem;border-radius:12px;cursor:pointer;font-family:inherit;}
        .sc-save:disabled{opacity:.5;}
      `}</style>
    </div>
  );
}
