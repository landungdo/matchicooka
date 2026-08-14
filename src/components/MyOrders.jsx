import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase.js";
import { useAuth } from "../lib/AuthContext.jsx";
import { vnd, summaryLines } from "../data/menu.js";
import { dateTimeLabel } from "../lib/time.js";
import { X } from "lucide-react";

const STATUS = {
  received:  { label: "Received",              color: "#9B8068", note: "We've got your order." },
  making:    { label: "Making your drink",     color: "#6F8F62", note: "Sit tight, it's being whisked." },
  ready:     { label: "Ready — come pick up ☕", color: "#4c7a3f", note: "Your matcha is ready at the counter!" },
  cancelled: { label: "Cancelled",             color: "#b06a6a", note: "This order was cancelled." },
};

export default function MyOrders({ onClose }) {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [items, setItems] = useState({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data: os } = await supabase
      .from("orders").select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    setOrders(os || []);
    setLoading(false);
    const ids = (os || []).map((o) => o.id);
    if (ids.length) {
      const { data: its } = await supabase.from("order_items").select("*").in("order_id", ids);
      const g = {}; (its || []).forEach((it) => { (g[it.order_id] ||= []).push(it); }); setItems(g);
    } else setItems({});
  }, [user.id]);

  useEffect(() => {
    load();
    const ch = supabase.channel("myorders:" + user.id)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `user_id=eq.${user.id}` }, () => load())
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [load, user.id]);

  return (
    <div className="mo-overlay" onClick={onClose}>
      <div className="mo-panel" onClick={(e) => e.stopPropagation()}>
        <header className="mo-head">
          <h2>My Orders</h2>
          <button className="mo-close" onClick={onClose} aria-label="Close"><X size={20} /></button>
        </header>

        <div className="mo-body">
          {loading && <div className="mo-empty">Loading…</div>}
          {!loading && orders.length === 0 && <div className="mo-empty">No orders yet. Build your first matcha! 🍵</div>}

          {orders.map((o) => {
            const st = STATUS[o.status] || STATUS.received;
            return (
              <div key={o.id} className={"mo-order" + (o.status === "ready" ? " ready" : "")}>
                <div className="mo-order-top">
                  <span className="mo-no">{o.order_no || "—"}</span>
                  <span className="mo-badge" style={{ background: st.color }}>{st.label}</span>
                </div>
                <div className="mo-note">{st.note}</div>
                <div className="mo-items">
                  {(items[o.id] || []).map((it) => (
                    <div key={it.id} className="mo-item">
                      <span className="mo-qty">{it.qty}×</span>
                      <div>
                        <div className="mo-item-name">{it.product_name}</div>
                        <div className="mo-item-lines">{summaryLines(it.config).join(" · ")}</div>
                      </div>
                      <span className="mo-item-price">{vnd(it.price * it.qty)}</span>
                    </div>
                  ))}
                </div>
                <div className="mo-order-foot">
                  <span className="mo-time">{dateTimeLabel(o.created_at)}</span>
                  <span className="mo-total">{vnd(o.subtotal)}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <style>{`
        .mo-overlay{position:fixed;inset:0;z-index:88;background:rgba(48,66,54,.35);backdrop-filter:blur(4px);
          display:grid;place-items:center;padding:1rem;font-family:Inter,system-ui,sans-serif;color:#304236;}
        .mo-panel{width:min(480px,96vw);height:min(680px,90vh);background:#FCFBF7;border-radius:24px;
          display:flex;flex-direction:column;overflow:hidden;box-shadow:0 30px 70px rgba(48,66,54,.35);}
        .mo-head{display:flex;align-items:center;justify-content:space-between;padding:1.1rem 1.3rem;background:#DDE8D8;}
        .mo-head h2{font-family:'Fraunces',Georgia,serif;font-weight:600;font-size:1.4rem;margin:0;}
        .mo-close{border:none;background:none;color:#5b6b5f;cursor:pointer;padding:4px;border-radius:8px;}
        .mo-close:hover{background:rgba(48,66,54,.1);}
        .mo-body{flex:1;overflow-y:auto;padding:1.1rem;display:flex;flex-direction:column;gap:.9rem;}
        .mo-empty{margin:auto;text-align:center;color:#8a988a;font-size:.95rem;padding:2rem;}
        .mo-order{border:1px solid rgba(48,66,54,.1);border-radius:16px;padding:1rem;background:#fff;}
        .mo-order.ready{border-color:#6F8F62;box-shadow:0 0 0 2px rgba(111,143,98,.18);}
        .mo-order-top{display:flex;align-items:center;justify-content:space-between;}
        .mo-no{font-family:'Fraunces',Georgia,serif;font-weight:700;font-size:1.1rem;color:#6F8F62;}
        .mo-badge{color:#fff;font-size:.72rem;font-weight:600;padding:.28rem .65rem;border-radius:999px;}
        .mo-note{font-size:.8rem;color:#8a988a;margin:.35rem 0 .7rem;}
        .mo-items{display:flex;flex-direction:column;gap:.45rem;margin-bottom:.7rem;}
        .mo-item{display:flex;align-items:flex-start;gap:.6rem;}
        .mo-qty{font-weight:700;color:#6F8F62;}
        .mo-item-name{font-weight:600;font-size:.9rem;}
        .mo-item-lines{font-size:.74rem;color:#8a988a;line-height:1.4;}
        .mo-item-price{margin-left:auto;font-weight:600;font-size:.86rem;}
        .mo-order-foot{display:flex;align-items:center;justify-content:space-between;border-top:1px solid rgba(48,66,54,.08);padding-top:.6rem;}
        .mo-time{font-size:.75rem;color:#9aa89a;}
        .mo-total{font-weight:700;font-size:1rem;}
      `}</style>
    </div>
  );
}
