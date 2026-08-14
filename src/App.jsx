import { useState } from "react";
import { AuthProvider, useAuth } from "./lib/AuthContext.jsx";
import { supabase } from "./lib/supabase.js";
import { findP, summaryLines } from "./data/menu.js";
import AuthModal from "./components/AuthModal.jsx";
import Storefront from "./Storefront.jsx";
import ChatDock from "./components/ChatDock.jsx";
import OwnerDashboard from "./components/OwnerDashboard.jsx";

function Shell() {
  const { user, name, isOwner, signOut, ready } = useAuth();
  const [authOpen, setAuthOpen] = useState(false);
  const [ownerOpen, setOwnerOpen] = useState(false);

  const placeOrder = async (cart) => {
    if (!user) { setAuthOpen(true); return false; }
    const items = cart.map((it) => ({
      name: findP(it.config.productId).name,
      lines: summaryLines(it.config),
      config: it.config,
      qty: it.qty,
      price: it.price,
    }));
    const subtotal = cart.reduce((s, it) => s + it.price * it.qty, 0);
    const { error } = await supabase.from("orders").insert({ user_id: user.id, items, subtotal });
    if (error) { console.error("[order]", error); return false; }
    return true;
  };

  if (!ready) return null;

  return (
    <>
      <Storefront
        user={user}
        name={name}
        onLogin={() => setAuthOpen(true)}
        onLogout={signOut}
        onPlaceOrder={placeOrder}
        onRequireLogin={() => setAuthOpen(true)}
      />
      {user && !isOwner && <ChatDock />}
      {isOwner && (
        <button className="mxr-ownerbtn" onClick={() => setOwnerOpen(true)}>🐰 Quản lý quán</button>
      )}
      {ownerOpen && <OwnerDashboard onClose={() => setOwnerOpen(false)} />}
      {authOpen && <AuthModal onClose={() => setAuthOpen(false)} />}
      <style>{`
        .mxr-ownerbtn{position:fixed;left:16px;bottom:16px;z-index:70;background:#304236;color:#F8F5ED;border:none;
          padding:.75rem 1.15rem;border-radius:999px;font-weight:600;font-size:.9rem;cursor:pointer;
          box-shadow:0 8px 20px rgba(48,66,54,.3);font-family:Inter,system-ui,sans-serif;transition:transform .18s;}
        .mxr-ownerbtn:hover{transform:translateY(-2px);}
      `}</style>
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Shell />
    </AuthProvider>
  );
}