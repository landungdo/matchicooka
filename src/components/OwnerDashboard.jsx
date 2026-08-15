import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "../lib/supabase.js";
import { useAuth } from "../lib/AuthContext.jsx";
import { BUNNY_SVG } from "../data/assets.js";
import { vnd, summaryLines } from "../data/menu.js";
import MessageList from "./MessageList.jsx";
import StarRating from "./StarRating.jsx";
import ShopStatusControl from "./ShopStatusControl.jsx";
import { X, Send, ShoppingBag, MessageSquare, Store } from "lucide-react";

const STATUS_LABEL = { received: "New", making: "Making", ready: "Ready", completed: "Picked up", cancelled: "Cancelled" };
const STATUS_COLOR = { received: "#9B8068", making: "#6F8F62", ready: "#4c7a3f", completed: "#7a8a72", cancelled: "#b06a6a" };
const timeVN = (iso) =>
  new Date(iso).toLocaleString("en-GB", { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" });

/* ---------------- Orders tab ---------------- */
function OrdersTab() {
  const [orders, setOrders] = useState([]);
  const [itemsByOrder, setItemsByOrder] = useState({});
  const [names, setNames] = useState({});
  const [reviews, setReviews] = useState({});
  const [q, setQ] = useState("");
  const [statusF, setStatusF] = useState("all");
  const [busyId, setBusyId] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data: os } = await supabase.from("orders").select("*").order("created_at", { ascending: false });
    const rows = os || [];
    setOrders(rows);
    setLoading(false);
    const oids = rows.map((o) => o.id);
    if (oids.length) {
      const { data: its } = await supabase.from("order_items").select("*").in("order_id", oids);
      const grp = {};
      (its || []).forEach((it) => { (grp[it.order_id] ||= []).push(it); });
      setItemsByOrder(grp);
      const { data: rv } = await supabase.from("reviews").select("*").in("order_id", oids);
      const rm = {}; (rv || []).forEach((r) => (rm[r.order_id] = r)); setReviews(rm);
    } else { setItemsByOrder({}); setReviews({}); }
    const uids = [...new Set(rows.map((o) => o.user_id))];
    if (uids.length) {
      const { data: profs } = await supabase.from("profiles").select("id, display_name").in("id", uids);
      const map = {}; (profs || []).forEach((p) => (map[p.id] = p.display_name)); setNames(map);
    }
  }, []);

  useEffect(() => {
    load();
    const ch = supabase.channel("owner-orders")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "order_items" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "reviews" }, () => load())
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [load]);

  const setStatus = async (id, next) => {
    setBusyId(id);
    const { error } = await supabase.rpc("transition_order_status", { p_order: id, p_next: next });
    setBusyId(null);
    if (error) { alert(error.message || "Couldn't update the order."); }
    load(); // reload authoritative state (also arrives via realtime)
  };

  if (loading) return <div className="od-empty">Loading orders…</div>;

  const ql = q.trim().toLowerCase();
  const filtered = orders.filter((o) => {
    if (statusF !== "all" && o.status !== statusF) return false;
    if (!ql) return true;
    const hay = ((o.order_no || "") + " " + (names[o.user_id] || "") + " " + (o.phone || "")).toLowerCase();
    return hay.includes(ql);
  });

  return (
    <div className="od-orders">
      <div className="od-toolbar">
        <input className="od-search" placeholder="Search order code, name or phone…" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="od-chips">
          {[["all", "All"], ["received", "New"], ["making", "Making"], ["ready", "Ready"], ["completed", "Picked up"], ["cancelled", "Cancelled"]].map(([v, l]) => (
            <button key={v} className={"od-chip" + (statusF === v ? " on" : "")} onClick={() => setStatusF(v)}>{l}</button>
          ))}
        </div>
      </div>
      {orders.length === 0 && <div className="od-empty">No orders yet. New orders appear here in real time.</div>}
      {orders.length > 0 && filtered.length === 0 && <div className="od-empty">No matching orders.</div>}
      {filtered.map((o) => (
        <div key={o.id} className="od-order">
          <div className="od-order-top">
            <div>
              <span className="od-no">{o.order_no || "—"}</span>
              <span className="od-cust">{names[o.user_id] || "Guest"}</span>
              <span className="od-time">{timeVN(o.created_at)}</span>
            </div>
            <div className="od-badges">
              {reviews[o.id] && (
                <span className="od-review-badge"><StarRating value={reviews[o.id].rating} size={13} readOnly /> {reviews[o.id].rating}.0</span>
              )}
              <span className="od-badge" style={{ background: STATUS_COLOR[o.status] }}>{STATUS_LABEL[o.status]}</span>
            </div>
          </div>
          {(o.phone || o.note) && (
            <div className="od-contact">
              {o.phone && <span className="od-phone">☎ {o.phone}</span>}
              {o.note && <span className="od-ordernote">“{o.note}”</span>}
            </div>
          )}

          <div className="od-items">
            {(itemsByOrder[o.id] || []).map((it) => (
              <div key={it.id} className="od-item">
                <span className="od-qty">{it.qty}×</span>
                <div>
                  <div className="od-item-name">{it.product_name}</div>
                  <div className="od-item-lines">{summaryLines(it.config).join(" · ")}</div>
                </div>
                <span className="od-item-price">{vnd(it.price * it.qty)}</span>
              </div>
            ))}
          </div>

          {reviews[o.id]?.comment && <div className="od-review-comment">“{reviews[o.id].comment}”</div>}

          <div className="od-order-foot">
            <span className="od-total">{vnd(o.subtotal)}</span>
            <div className="od-actions">
              {o.status === "received" && <button className="od-btn go" disabled={busyId===o.id} onClick={() => setStatus(o.id, "making")}>Start making</button>}
              {o.status === "making" && <button className="od-btn go" disabled={busyId===o.id} onClick={() => setStatus(o.id, "ready")}>Mark ready</button>}
              {o.status === "ready" && <button className="od-btn go" disabled={busyId===o.id} onClick={() => setStatus(o.id, "completed")}>Picked up</button>}
              {(o.status === "received" || o.status === "making" || o.status === "ready") && (
                <button className="od-btn cancel" disabled={busyId===o.id} onClick={() => setStatus(o.id, "cancelled")}>Cancel</button>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ---------------- Messages tab ---------------- */
function MessagesTab({ ownerId }) {
  const [rooms, setRooms] = useState([]);
  const [names, setNames] = useState({});
  const [sel, setSel] = useState(null);
  const [msgs, setMsgs] = useState([]);
  const [text, setText] = useState("");
  const endRef = useRef(null);

  const loadRooms = useCallback(async () => {
    const { data } = await supabase.from("messages").select("room_user_id, created_at").order("created_at", { ascending: false });
    const seen = new Set(); const list = [];
    (data || []).forEach((m) => { if (!seen.has(m.room_user_id)) { seen.add(m.room_user_id); list.push(m.room_user_id); } });
    setRooms(list);
    if (list.length) {
      const { data: profs } = await supabase.from("profiles").select("id, display_name").in("id", list);
      const map = {}; (profs || []).forEach((p) => (map[p.id] = p.display_name)); setNames(map);
    }
  }, []);

  useEffect(() => {
    loadRooms();
    const ch = supabase.channel("owner-rooms")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, () => loadRooms())
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [loadRooms]);

  useEffect(() => {
    if (!sel) return;
    let active = true;
    (async () => {
      const { data } = await supabase.from("messages").select("*").eq("room_user_id", sel).order("created_at", { ascending: true });
      if (active) setMsgs(data || []);
    })();
    const ch = supabase.channel("owner-chat:" + sel)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `room_user_id=eq.${sel}` },
        (p) => setMsgs((m) => (m.some((x) => x.id === p.new.id) ? m : [...m, p.new])))
      .subscribe();
    return () => { active = false; supabase.removeChannel(ch); };
  }, [sel]);

  useEffect(() => { setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 50); }, [msgs]);

  const send = async () => {
    const body = text.trim();
    if (!body || !sel) return;
    setText("");
    const { data, error } = await supabase.from("messages")
      .insert({ room_user_id: sel, sender_id: ownerId, sender_role: "owner", body }).select().single();
    if (!error && data) setMsgs((m) => (m.some((x) => x.id === data.id) ? m : [...m, data]));
  };

  return (
    <div className="od-chat">
      <div className="od-rooms">
        {rooms.length === 0 && <div className="od-empty sm">No messages yet.</div>}
        {rooms.map((r) => (
          <button key={r} className={"od-room" + (sel === r ? " on" : "")} onClick={() => setSel(r)}>
            <span className="od-room-ava" dangerouslySetInnerHTML={{ __html: BUNNY_SVG }} />
            {names[r] || "Guest"}
          </button>
        ))}
      </div>

      <div className="od-thread">
        {!sel && <div className="od-empty">Select a customer to reply.</div>}
        {sel && (
          <>
            <div className="od-thread-body">
              <MessageList msgs={msgs} mineRole="owner" />
              <div ref={endRef} />
            </div>
            <div className="od-thread-foot">
              <input className="cd-input" placeholder="Reply to customer…" value={text}
                     onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} />
              <button className="cd-send" onClick={send} aria-label="Send"><Send size={17} /></button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ---------------- Shell ---------------- */
export default function OwnerDashboard({ onClose }) {
  const { user, name } = useAuth();
  const [tab, setTab] = useState("orders");

  return (
    <div className="od-overlay">
      <div className="od-panel">
        <header className="od-head">
          <span className="od-bunny" dangerouslySetInnerHTML={{ __html: BUNNY_SVG }} />
          <div className="od-hi">
            <div className="od-shop">matchicooka · manager</div>
            <div className="od-owner">Hi {name}</div>
          </div>
          <div className="od-tabs">
            <button className={"od-tab" + (tab === "orders" ? " on" : "")} onClick={() => setTab("orders")}>
              <ShoppingBag size={15} /> Orders
            </button>
            <button className={"od-tab" + (tab === "chat" ? " on" : "")} onClick={() => setTab("chat")}>
              <MessageSquare size={15} /> Messages
            </button>
            <button className={"od-tab" + (tab === "shop" ? " on" : "")} onClick={() => setTab("shop")}>
              <Store size={15} /> Shop
            </button>
          </div>
          <button className="od-close" onClick={onClose} aria-label="Close"><X size={20} /></button>
        </header>

        <div className="od-content">
          {tab === "orders" && <OrdersTab />}
          {tab === "chat" && <MessagesTab ownerId={user.id} />}
          {tab === "shop" && <ShopStatusControl />}
        </div>
      </div>

      <style>{`
        .od-overlay{position:fixed;inset:0;z-index:90;background:rgba(48,66,54,.35);backdrop-filter:blur(4px);
          display:grid;place-items:center;padding:1rem;font-family:Inter,system-ui,sans-serif;color:#304236;}
        .od-panel{width:min(900px,96vw);height:min(720px,92vh);background:#FCFBF7;border-radius:24px;
          display:flex;flex-direction:column;overflow:hidden;box-shadow:0 30px 70px rgba(48,66,54,.35);}
        .od-head{display:flex;align-items:center;gap:.8rem;padding:1rem 1.2rem;background:#DDE8D8;flex-wrap:wrap;}
        .od-bunny{width:42px;height:42px;flex-shrink:0;}.od-bunny svg{width:100%;height:100%;}
        .od-shop{font-family:'Fraunces',Georgia,serif;font-weight:600;font-size:1.15rem;line-height:1;}
        .od-owner{font-size:.78rem;color:#5b6b5f;margin-top:2px;}
        .od-tabs{display:flex;gap:.4rem;margin-left:auto;background:rgba(255,255,255,.5);padding:.3rem;border-radius:12px;}
        .od-tab{display:flex;align-items:center;gap:.4rem;border:none;background:none;padding:.5rem .9rem;border-radius:9px;
          font-weight:600;font-size:.85rem;color:#5b6b5f;cursor:pointer;font-family:inherit;}
        .od-tab.on{background:#FCFBF7;color:#6F8F62;box-shadow:0 2px 8px rgba(48,66,54,.1);}
        .od-close{border:none;background:none;color:#5b6b5f;cursor:pointer;padding:4px;border-radius:8px;}
        .od-close:hover{background:rgba(48,66,54,.1);}
        .od-content{flex:1;overflow:hidden;display:flex;}
        .od-empty{margin:auto;text-align:center;color:#8a988a;font-size:.95rem;padding:2rem;}
        .od-empty.sm{font-size:.85rem;padding:1rem;}

        .od-orders{flex:1;overflow-y:auto;padding:1.2rem;display:flex;flex-direction:column;gap:1rem;}
        .od-toolbar{display:flex;flex-direction:column;gap:.6rem;}
        .od-search{padding:.7rem .9rem;border-radius:12px;border:1.5px solid rgba(48,66,54,.14);background:#F8F5ED;font-family:inherit;font-size:.9rem;color:#304236;}
        .od-search:focus{outline:none;border-color:#6F8F62;}
        .od-chips{display:flex;gap:.4rem;flex-wrap:wrap;}
        .od-chip{border:1.5px solid rgba(48,66,54,.12);background:none;padding:.35rem .8rem;border-radius:999px;font-size:.8rem;font-weight:600;color:#5b6b5f;cursor:pointer;font-family:inherit;}
        .od-chip.on{background:#6F8F62;color:#fff;border-color:#6F8F62;}
        .od-contact{display:flex;gap:.7rem;flex-wrap:wrap;margin:-.2rem 0 .7rem;font-size:.8rem;}
        .od-phone{font-weight:600;color:#304236;}
        .od-ordernote{color:#5b6b5f;font-style:italic;}
        .od-order{border:1px solid rgba(48,66,54,.1);border-radius:16px;padding:1rem;background:#fff;}
        .od-order-top{display:flex;justify-content:space-between;align-items:center;margin-bottom:.7rem;}
        .od-no{font-family:'Fraunces',Georgia,serif;font-weight:700;font-size:1.05rem;color:#6F8F62;margin-right:.6rem;}
        .od-cust{font-weight:600;font-size:.95rem;}
        .od-time{font-size:.75rem;color:#9aa89a;margin-left:.5rem;}
        .od-badge{color:#fff;font-size:.72rem;font-weight:600;padding:.25rem .6rem;border-radius:999px;}
        .od-badges{display:flex;align-items:center;gap:.5rem;}
        .od-review-badge{display:inline-flex;align-items:center;gap:.25rem;font-size:.75rem;font-weight:700;color:#4c7a3f;background:#DDE8D8;padding:.2rem .5rem;border-radius:999px;}
        .od-review-comment{font-size:.82rem;color:#5b6b5f;font-style:italic;background:#F8F5ED;padding:.5rem .7rem;border-radius:10px;margin-bottom:.7rem;}
        .od-items{display:flex;flex-direction:column;gap:.5rem;margin-bottom:.8rem;}
        .od-item{display:flex;align-items:flex-start;gap:.6rem;}
        .od-qty{font-weight:700;color:#6F8F62;}
        .od-item-name{font-weight:600;font-size:.92rem;}
        .od-item-lines{font-size:.76rem;color:#8a988a;line-height:1.4;}
        .od-item-price{margin-left:auto;font-weight:600;font-size:.88rem;}
        .od-order-foot{display:flex;align-items:center;justify-content:space-between;border-top:1px solid rgba(48,66,54,.08);padding-top:.7rem;}
        .od-total{font-weight:700;font-size:1.05rem;}
        .od-actions{display:flex;gap:.5rem;}
        .od-btn{border:none;padding:.5rem .9rem;border-radius:999px;font-weight:600;font-size:.82rem;cursor:pointer;font-family:inherit;}
        .od-btn.go{background:#6F8F62;color:#fff;}
        .od-btn.go:hover{background:#5E7D48;}
        .od-btn:disabled{opacity:.5;cursor:not-allowed;}
        .od-btn.cancel{background:#F0EBDF;color:#9b6a6a;}
        .od-btn.cancel:hover{background:#e8dccb;}

        .od-chat{flex:1;display:flex;overflow:hidden;}
        .od-rooms{width:200px;border-right:1px solid rgba(48,66,54,.1);overflow-y:auto;padding:.6rem;display:flex;flex-direction:column;gap:.3rem;}
        .od-room{display:flex;align-items:center;gap:.5rem;padding:.6rem .7rem;border:none;background:none;border-radius:10px;
          font-weight:500;font-size:.9rem;color:#304236;cursor:pointer;text-align:left;font-family:inherit;}
        .od-room:hover{background:#F8F5ED;}
        .od-room.on{background:#DDE8D8;color:#6F8F62;font-weight:600;}
        .od-room-ava{width:26px;height:26px;flex-shrink:0;}.od-room-ava svg{width:100%;height:100%;}
        .od-thread{flex:1;display:flex;flex-direction:column;}
        .od-thread-body{flex:1;overflow-y:auto;padding:1rem;display:flex;flex-direction:column;gap:.55rem;}
        .od-thread-foot{display:flex;gap:.5rem;padding:.7rem;border-top:1px solid rgba(48,66,54,.08);}
        .cd-msg{display:flex;max-width:78%;}
        .cd-msg.me{align-self:flex-end;}
        .cd-msg.shop{align-self:flex-start;}
        .cd-bubble{padding:.6rem .85rem;border-radius:16px;font-size:.9rem;line-height:1.4;word-break:break-word;}
        .cd-msg.me .cd-bubble{background:#6F8F62;color:#fff;border-bottom-right-radius:5px;}
        .cd-msg.shop .cd-bubble{background:#F0EBDF;color:#304236;border-bottom-left-radius:5px;}
        .cd-input{flex:1;padding:.7rem .9rem;border-radius:999px;border:1.5px solid rgba(48,66,54,.14);
          background:#F8F5ED;font-family:inherit;font-size:.9rem;color:#304236;}
        .cd-input:focus{outline:none;border-color:#6F8F62;}
        .cd-send{width:42px;height:42px;flex-shrink:0;border:none;border-radius:50%;background:#6F8F62;color:#fff;
          display:grid;place-items:center;cursor:pointer;}
        .cd-send:hover{background:#5E7D48;}

        @media(max-width:640px){
          .od-tabs{order:3;width:100%;margin-left:0;}
          .od-chat{flex-direction:column;}
          .od-rooms{width:100%;flex-direction:row;border-right:none;border-bottom:1px solid rgba(48,66,54,.1);}
          .od-room{white-space:nowrap;}
        }
      `}</style>
    </div>
  );
}
