import { useState, useEffect, useRef } from "react";
import { AuthProvider, useAuth } from "./lib/AuthContext.jsx";
import { LanguageProvider } from "./lib/i18n.jsx";
import { useLang } from "./lib/i18n.jsx";
import { supabase } from "./lib/supabase.js";
import AuthModal from "./components/AuthModal.jsx";
import Storefront from "./Storefront.jsx";
import ChatDock from "./components/ChatDock.jsx";
import OwnerDashboard from "./components/OwnerDashboard.jsx";
import MyOrders from "./components/MyOrders.jsx";
import OrderConfirm from "./components/OrderConfirm.jsx";
import { Receipt } from "lucide-react";
import ShopStatusBadge from "./components/ShopStatusBadge.jsx";

function Shell() {
  const { user, name, isOwner, signOut, ready, profile } = useAuth();
  const { t } = useLang();
  const [authOpen, setAuthOpen] = useState(false);
  const [ownerOpen, setOwnerOpen] = useState(false);
  const [ordersOpen, setOrdersOpen] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [toast, setToast] = useState(null);
  const placingRef = useRef(false); // guard against double-click checkout
  const [notice, setNotice] = useState(null);
  const [newOrders, setNewOrders] = useState(0);
  const [ownerToast, setOwnerToast] = useState(null);
  const [reorder, setReorder] = useState(null);

  // Checkout -> create order + line items (schema v2).
  const placeOrder = async (cart, details = {}) => {
    if (!user) { setAuthOpen(true); return false; }
    if (placingRef.current) return false;   // already placing -> ignore
    placingRef.current = true;
    try {
      // Server computes prices atomically (place_order RPC); client sends config+qty only.
      const p_items = cart.map((it) => ({ config: it.config, qty: it.qty }));
      const reqId = details.requestId || ((crypto?.randomUUID && crypto.randomUUID()) || (Date.now() + "-" + Math.random().toString(36).slice(2)));
      const { data, error } = await supabase.rpc("place_order", {
        p_items, p_phone: details.phone || "", p_note: details.note || "", p_request_id: reqId,
      });
      if (error || !data) {
        console.error("[place_order]", error);
        setNotice(error?.message || t("app.orderFailed"));
        setTimeout(() => setNotice(null), 5000);
        return false;
      }
      setConfirm({
        order_no: data.order_no, subtotal: data.subtotal,
        count: cart.reduce((a, it) => a + it.qty, 0),
        est_ready_at: data.est_ready_at, est_min: data.est_min, est_max: data.est_max,
      });
      return true;
    } finally {
      placingRef.current = false;
    }
  };

  // Ready notification: toast when one of my orders turns "ready".
  useEffect(() => {
    if (!user || isOwner) return;
    const notified = new Set();
    const ch = supabase.channel("ready-notify:" + user.id)
      .on("postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders", filter: `user_id=eq.${user.id}` },
        (p) => {
          if (p.new.status === "ready" && !notified.has(p.new.id)) {
            notified.add(p.new.id);
            setToast(t("app.readyToast", { no: p.new.order_no || "" }));
            setTimeout(() => setToast(null), 6000);
          }
        })
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [user, isOwner, t]);

  // Owner: alert on a new order even when the dashboard is closed (toast + beep + count).
  useEffect(() => {
    if (!isOwner) return;
    const beep = () => {
      try {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        const a = new Ctx();
        const o = a.createOscillator(); const g = a.createGain();
        o.connect(g); g.connect(a.destination); o.type = "sine"; o.frequency.value = 880;
        g.gain.setValueAtTime(0.0001, a.currentTime);
        g.gain.exponentialRampToValueAtTime(0.2, a.currentTime + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + 0.4);
        o.start(); o.stop(a.currentTime + 0.42);
      } catch {}
    };
    const ch = supabase.channel("owner-neworders")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "orders" }, (p) => {
        setNewOrders((n) => n + 1);
        setOwnerToast(t("app.newOrder", { no: p.new.order_no || "" }));
        beep();
        setTimeout(() => setOwnerToast(null), 6000);
      })
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [isOwner, t]);

  if (!ready) return null;

  return (
    <>
      <ShopStatusBadge />
      <Storefront
        user={user}
        name={name}
        defaultPhone={profile?.phone || ""}
        reorderItems={reorder}
        onReordered={() => setReorder(null)}
        onLogin={() => setAuthOpen(true)}
        onLogout={signOut}
        onPlaceOrder={placeOrder}
        onRequireLogin={() => setAuthOpen(true)}
      />

      {user && !isOwner && (
        <>
          <button className="mxr-ordersbtn" onClick={() => setOrdersOpen(true)}>
            <Receipt size={16} /> {t("app.myOrders")}
          </button>
          <ChatDock />
        </>
      )}
      {isOwner && (
        <button className="mxr-ownerbtn" onClick={() => { setOwnerOpen(true); setNewOrders(0); }}>🐰 {t("app.manage")}{newOrders > 0 && <span className="mxr-count">{newOrders}</span>}</button>
      )}

      {confirm && (
        <OrderConfirm order={confirm}
          onTrack={() => { setConfirm(null); setOrdersOpen(true); }}
          onClose={() => setConfirm(null)} />
      )}
      {ordersOpen && <MyOrders onClose={() => setOrdersOpen(false)} onReorder={(items) => { setReorder(items); setOrdersOpen(false); }} />}
      {ownerOpen && <OwnerDashboard onClose={() => setOwnerOpen(false)} />}
      {authOpen && <AuthModal onClose={() => setAuthOpen(false)} />}

      {toast && (<div className="mxr-toast" onClick={() => setOrdersOpen(true)}>{toast}</div>)}
      {notice && (<div className="mxr-notice">{notice}</div>)}
      {ownerToast && (<div className="mxr-ownertoast" onClick={() => { setOwnerOpen(true); setNewOrders(0); }}>🔔 {ownerToast}</div>)}

      <style>{`
        .mxr-ownerbtn{position:fixed;left:16px;bottom:16px;z-index:70;background:#304236;color:#F8F5ED;border:none;
          padding:.75rem 1.15rem;border-radius:999px;font-weight:600;font-size:.9rem;cursor:pointer;
          box-shadow:0 8px 20px rgba(48,66,54,.3);font-family:Inter,system-ui,sans-serif;transition:transform .18s;}
        .mxr-ownerbtn:hover{transform:translateY(-2px);}
        .mxr-count{display:inline-grid;place-items:center;min-width:20px;height:20px;padding:0 5px;margin-left:.45rem;border-radius:999px;background:#d9534f;color:#fff;font-size:.75rem;font-weight:700;}
        .mxr-ownertoast{position:fixed;left:16px;bottom:64px;z-index:96;background:#304236;color:#fff;padding:.75rem 1.1rem;border-radius:14px;font-weight:600;font-size:.9rem;font-family:Inter,system-ui,sans-serif;box-shadow:0 12px 30px rgba(48,66,54,.35);cursor:pointer;animation:mxr-pop2 .3s ease;}
        @keyframes mxr-pop2{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
        .mxr-ordersbtn{position:fixed;right:18px;bottom:88px;z-index:70;display:inline-flex;align-items:center;gap:.4rem;
          background:#FCFBF7;color:#304236;border:1.5px solid rgba(48,66,54,.14);padding:.6rem 1rem;border-radius:999px;
          font-weight:600;font-size:.88rem;cursor:pointer;box-shadow:0 6px 16px rgba(48,66,54,.14);
          font-family:Inter,system-ui,sans-serif;transition:transform .18s,border-color .2s;}
        .mxr-ordersbtn:hover{transform:translateY(-2px);border-color:#6F8F62;color:#6F8F62;}
        .mxr-toast{position:fixed;bottom:22px;left:50%;transform:translateX(-50%);z-index:95;cursor:pointer;
          background:#4c7a3f;color:#fff;padding:.9rem 1.4rem;border-radius:999px;font-weight:600;font-size:.92rem;
          font-family:Inter,system-ui,sans-serif;box-shadow:0 12px 30px rgba(48,66,54,.35);animation:mxr-pop .3s ease;}
        @keyframes mxr-pop{from{opacity:0;transform:translateX(-50%) translateY(12px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}
        .mxr-notice{position:fixed;bottom:22px;left:50%;transform:translateX(-50%);z-index:96;background:#9B4444;color:#fff;padding:.85rem 1.3rem;border-radius:999px;font-weight:600;font-size:.9rem;font-family:Inter,system-ui,sans-serif;box-shadow:0 12px 30px rgba(48,66,54,.35);animation:mxr-pop .3s ease;max-width:92vw;text-align:center;}
      `}</style>
    </>
  );
}

export default function App() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <Shell />
      </AuthProvider>
    </LanguageProvider>
  );
}
