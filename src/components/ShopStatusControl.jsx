import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase.js";
import { useLang } from "../lib/i18n.jsx";

const PRESETS = [
  { key: "normal",    labelKey: "sc.normal",    patch: { status: "normal",    accepting_orders: true,  min_prep_minutes: 10, max_prep_minutes: 15 } },
  { key: "busy",      labelKey: "sc.busy",      patch: { status: "busy",      accepting_orders: true,  min_prep_minutes: 20, max_prep_minutes: 30 } },
  { key: "very_busy", labelKey: "sc.veryBusy", patch: { status: "very_busy", accepting_orders: true,  min_prep_minutes: 30, max_prep_minutes: 45 } },
  { key: "paused",    labelKey: "sc.pause", patch: { status: "paused", accepting_orders: false } },
  { key: "closed",    labelKey: "sc.closeShop",   patch: { status: "closed", accepting_orders: false } },
];

export default function ShopStatusControl() {
  const { t } = useLang();
  const [s, setS] = useState(null);
  const [msg, setMsg] = useState("");
  const [products, setProducts] = useState([]);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState("");

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("shop_status").select("*").eq("id", 1).single();
      setS(data); setMsg(data?.message || "");
      const { data: prods } = await supabase.from("menu_products").select("id, name, available").order("base");
      setProducts(prods || []);
    })();
  }, []);

  const apply = async (patch) => {
    setBusy(true); setSaved("");
    const { error } = await supabase.from("shop_status").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", 1);
    setBusy(false);
    if (error) { alert(error.message || "Update failed"); return; }
    const { data } = await supabase.from("shop_status").select("*").eq("id", 1).single();
    setS(data); setSaved("1"); setTimeout(() => setSaved(""), 2000);
  };

  const saveMsg = () => apply({ message: msg.trim() || null });

  const toggleProduct = async (id, next) => {
    setProducts((ps) => ps.map((p) => (p.id === id ? { ...p, available: next } : p)));
    const { error } = await supabase.from("menu_products").update({ available: next }).eq("id", id);
    if (error) { alert(error.message || "Update failed"); }
  };

  if (!s) return <div className="sc-wrap">{t("sc.loading")}</div>;

  return (
    <div className="sc-wrap">
      <div className="sc-now">
        {t("sc.current")} <b>{s.status}</b>{s.accepting_orders ? ` · ${t("sc.accepting")} · ~${s.min_prep_minutes}–${s.max_prep_minutes} ${t("min")}` : ` · ${t("sc.notAccepting")}`}
        {saved && <span className="sc-saved">{t("sc.updated")}</span>}
      </div>

      <div className="sc-grid">
        {PRESETS.map((p) => (
          <button key={p.key} className={"sc-btn" + (s.status === p.key ? " on" : "")} disabled={busy} onClick={() => apply(p.patch)}>
            {t(p.labelKey)}
          </button>
        ))}
      </div>

      <label className="sc-lbl">{t("sc.msgLabel")}</label>
      <div className="sc-msgrow">
        <input className="sc-input" placeholder={t("sc.msgPh")} value={msg} onChange={(e) => setMsg(e.target.value)} />
        <button className="sc-save" disabled={busy} onClick={saveMsg}>{t("sc.save")}</button>
      </div>

      <div className="sc-avail">
        <div className="sc-avail-head">{t("sc.availHead")}</div>
        {products.map((p) => (
          <div key={p.id} className="sc-prow">
            <span className={"sc-pname" + (p.available ? "" : " off")}>{p.name}</span>
            <button className={"sc-toggle" + (p.available ? " on" : "")} onClick={() => toggleProduct(p.id, !p.available)}>
              {p.available ? t("sc.available") : t("sc.soldout")}
            </button>
          </div>
        ))}
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
        .sc-avail{margin-top:1.6rem;border-top:1px solid rgba(48,66,54,.1);padding-top:1.2rem;}
        .sc-avail-head{font-weight:700;font-size:.95rem;margin-bottom:.7rem;}
        .sc-prow{display:flex;align-items:center;justify-content:space-between;padding:.5rem 0;border-bottom:1px solid rgba(48,66,54,.06);}
        .sc-pname{font-size:.9rem;font-weight:500;}
        .sc-pname.off{color:#b06a6a;text-decoration:line-through;}
        .sc-toggle{border:1.5px solid rgba(48,66,54,.14);background:#FCFBF7;padding:.35rem .8rem;border-radius:999px;font-size:.8rem;font-weight:600;color:#8a988a;cursor:pointer;font-family:inherit;}
        .sc-toggle.on{background:#DDE8D8;color:#4c7a3f;border-color:#a9bfa0;}
      `}</style>
    </div>
  );
}
