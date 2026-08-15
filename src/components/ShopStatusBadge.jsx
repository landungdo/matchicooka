import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase.js";

const MAP = {
  normal:    { label: "Open",      color: "#4c7a3f", dot: "#7ed07e" },
  busy:      { label: "Busy",      color: "#9B8068", dot: "#e0b44b" },
  very_busy: { label: "Very busy", color: "#b0763f", dot: "#e08a3f" },
  paused:    { label: "Paused",    color: "#8a8a8a", dot: "#bbb" },
  closed:    { label: "Closed",    color: "#5b6b5f", dot: "#888" },
};

export default function ShopStatusBadge() {
  const [s, setS] = useState(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase.from("shop_status").select("*").eq("id", 1).single();
      if (active) setS(data);
    })();
    const ch = supabase.channel("shop-status")
      .on("postgres_changes", { event: "*", schema: "public", table: "shop_status" },
        (p) => setS(p.new))
      .subscribe();
    return () => { active = false; supabase.removeChannel(ch); };
  }, []);

  if (!s) return null;
  const m = MAP[s.status] || MAP.normal;
  const eta = s.accepting_orders && s.status !== "closed"
    ? ` · ~${s.min_prep_minutes}–${s.max_prep_minutes} min` : "";

  return (
    <div className="ssb" style={{ color: m.color }} title={s.message || ""}>
      <span className="ssb-dot" style={{ background: m.dot }} />
      {m.label}{eta}
      {s.message ? <span className="ssb-msg">· {s.message}</span> : null}
      <style>{`
        .ssb{position:fixed;top:12px;left:50%;transform:translateX(-50%);z-index:60;
          display:inline-flex;align-items:center;gap:.4rem;background:rgba(252,251,247,.92);backdrop-filter:blur(8px);
          border:1px solid rgba(48,66,54,.1);padding:.4rem .9rem;border-radius:999px;font-size:.82rem;font-weight:600;
          font-family:Inter,system-ui,sans-serif;box-shadow:0 4px 14px rgba(48,66,54,.12);max-width:92vw;
          white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
        .ssb-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0;}
        .ssb-msg{font-weight:500;opacity:.8;margin-left:.2rem;}
      `}</style>
    </div>
  );
}
