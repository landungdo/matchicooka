import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase.js";
import { useAuth } from "../lib/AuthContext.jsx";
import { vnd, summaryLines } from "../data/menu.js";
import { dateTimeLabel } from "../lib/time.js";
import StarRating from "./StarRating.jsx";
import { X } from "lucide-react";

const STATUS = {
  received:  { label: "Received",              color: "#9B8068", note: "We've got your order." },
  making:    { label: "Making your drink",     color: "#6F8F62", note: "Sit tight, it's being whisked." },
  ready:     { label: "Ready — come pick up ☕", color: "#4c7a3f", note: "Your matcha is ready at the counter!" },
  completed: { label: "Picked up",             color: "#7a8a72", note: "Enjoy! Thanks for your order." },
  cancelled: { label: "Cancelled",             color: "#b06a6a", note: "This order was cancelled." },
};
const ACTIVE = ["received", "making", "ready"];

/* ---- review panel (shown when an order is ready) ---- */
function ReviewPanel({ order, items, existing, onDone }) {
  const [ratings, setRatings] = useState(() =>
    Object.fromEntries(items.map((it) => [it.id, it.item_rating || 0])));
  const [comment, setComment] = useState(existing?.comment || "");
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const any = Object.values(ratings).some((v) => v > 0);

  const submit = async () => {
    setBusy(true); setErr("");
    const p_items = items.filter((it) => ratings[it.id] > 0).map((it) => ({ id: it.id, rating: ratings[it.id] }));
    const { error } = await supabase.rpc("submit_review", { p_order: order.id, p_comment: comment || null, p_items });
    setBusy(false);
    if (error) { setErr(error.message || "Couldn't submit review."); setConfirm(false); return; }
    onDone();
  };

  return (
    <div className="mo-review">
      <div className="mo-review-head">{existing ? "Your rating" : "Rate your order"}{existing && <span className="mo-reviewed">✓ submitted</span>}</div>
      {items.map((it) => (
        <div key={it.id} className="mo-rrow">
          <span className="mo-rname">{it.product_name}</span>
          <StarRating value={ratings[it.id]} onChange={(n) => setRatings((r) => ({ ...r, [it.id]: n }))} size={22} />
        </div>
      ))}
      <textarea className="mo-comment" placeholder="Anything to add? (optional)" value={comment}
                onChange={(e) => setComment(e.target.value)} rows={2} />
      {err && <div className="mo-rerr">{err}</div>}

      {!confirm ? (
        <button className="mo-rbtn" disabled={!any || busy} onClick={() => setConfirm(true)}>
          {existing ? "Update review" : "Submit review"}
        </button>
      ) : (
        <div className="mo-confirm">
          <span>Send this review?</span>
          <button className="mo-rbtn sm" disabled={busy} onClick={submit}>{busy ? "Sending…" : "Confirm"}</button>
          <button className="mo-rbtn sm ghost" disabled={busy} onClick={() => setConfirm(false)}>Cancel</button>
        </div>
      )}
    </div>
  );
}

export default function MyOrders({ onClose }) {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [items, setItems] = useState({});
  const [reviews, setReviews] = useState({});
  const [tab, setTab] = useState("active");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data: os } = await supabase
      .from("orders").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
    setOrders(os || []);
    setLoading(false);
    const ids = (os || []).map((o) => o.id);
    if (ids.length) {
      const { data: its } = await supabase.from("order_items").select("*").in("order_id", ids);
      const g = {}; (its || []).forEach((it) => { (g[it.order_id] ||= []).push(it); }); setItems(g);
      const { data: rv } = await supabase.from("reviews").select("*").in("order_id", ids);
      const rm = {}; (rv || []).forEach((r) => (rm[r.order_id] = r)); setReviews(rm);
    } else { setItems({}); setReviews({}); }
  }, [user.id]);

  const cancelOrder = async (id) => {
    const { error } = await supabase.rpc("cancel_my_order", { p_order: id });
    if (error) alert(error.message || "Couldn't cancel.");
    load();
  };

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

          {orders.length > 0 && (
            <div className="mo-tabs">
              <button className={"mo-tab" + (tab === "active" ? " on" : "")} onClick={() => setTab("active")}>Active</button>
              <button className={"mo-tab" + (tab === "past" ? " on" : "")} onClick={() => setTab("past")}>Past</button>
            </div>
          )}

          {orders.filter((o) => tab === "active" ? ACTIVE.includes(o.status) : !ACTIVE.includes(o.status)).map((o) => {
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
                {o.status === "received" && (
                  <button className="mo-cancel" onClick={() => cancelOrder(o.id)}>Cancel order</button>
                )}

                {o.status === "ready" && (items[o.id] || []).length > 0 && (
                  <ReviewPanel order={o} items={items[o.id]} existing={reviews[o.id]} onDone={load} />
                )}
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
        .mo-tabs{display:flex;gap:.4rem;background:#F0EBDF;padding:.3rem;border-radius:12px;}
        .mo-tab{flex:1;border:none;background:none;padding:.5rem;border-radius:9px;font-weight:600;font-size:.85rem;color:#8a988a;cursor:pointer;font-family:inherit;}
        .mo-tab.on{background:#FCFBF7;color:#6F8F62;box-shadow:0 2px 8px rgba(48,66,54,.08);}
        .mo-cancel{margin-top:.6rem;width:100%;border:1.5px solid rgba(176,106,106,.4);background:none;color:#b06a6a;
          border-radius:999px;padding:.55rem;font-weight:600;font-size:.84rem;cursor:pointer;font-family:inherit;}
        .mo-cancel:hover{background:#F7E3E3;}
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

        .mo-review{margin-top:.8rem;border-top:1px dashed rgba(48,66,54,.15);padding-top:.8rem;}
        .mo-review-head{font-weight:600;font-size:.9rem;margin-bottom:.5rem;display:flex;align-items:center;gap:.5rem;}
        .mo-reviewed{font-size:.72rem;color:#4c7a3f;background:#DDE8D8;padding:.15rem .5rem;border-radius:999px;font-weight:600;}
        .mo-rrow{display:flex;align-items:center;justify-content:space-between;gap:.5rem;margin-bottom:.4rem;}
        .mo-rname{font-size:.86rem;font-weight:500;}
        .mo-comment{width:100%;box-sizing:border-box;margin-top:.4rem;padding:.6rem .8rem;border-radius:12px;
          border:1.5px solid rgba(48,66,54,.14);background:#F8F5ED;font-family:inherit;font-size:.86rem;color:#304236;resize:vertical;}
        .mo-comment:focus{outline:none;border-color:#6F8F62;}
        .mo-rerr{color:#9B4444;font-size:.78rem;margin-top:.4rem;}
        .mo-rbtn{margin-top:.6rem;border:none;border-radius:999px;background:#6F8F62;color:#fff;font-weight:600;
          font-size:.86rem;padding:.55rem 1rem;cursor:pointer;font-family:inherit;}
        .mo-rbtn:disabled{opacity:.45;cursor:not-allowed;}
        .mo-rbtn.sm{padding:.4rem .8rem;font-size:.82rem;margin-top:0;}
        .mo-rbtn.ghost{background:#F0EBDF;color:#5b6b5f;}
        .mo-confirm{display:flex;align-items:center;gap:.5rem;margin-top:.6rem;font-size:.85rem;flex-wrap:wrap;}
      `}</style>
    </div>
  );
}
