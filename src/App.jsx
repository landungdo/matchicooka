import { useState } from "react";
import { AuthProvider, useAuth } from "./lib/AuthContext.jsx";
import { supabase } from "./lib/supabase.js";
import AuthModal from "./components/AuthModal.jsx";
import Storefront from "./Storefront.jsx";

function Shell() {
  const { user, name, signOut, ready } = useAuth();
  const [authOpen, setAuthOpen] = useState(false);

  // Called by the storefront's Checkout button.
  // Returns true on success so the storefront can clear the cart.
  const placeOrder = async (cart) => {
    if (!user) { setAuthOpen(true); return false; }
    const items = cart.map((it) => ({
      productId: it.config.productId,
      config: it.config,
      qty: it.qty,
      price: it.price,
    }));
    const subtotal = cart.reduce((s, it) => s + it.price * it.qty, 0);
    const { error } = await supabase.from("orders").insert({
      user_id: user.id,
      items,
      subtotal,
    });
    if (error) { console.error("[order]", error); return false; }
    return true;
  };

  if (!ready) return null; // brief blank while the session resolves

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
      {authOpen && <AuthModal onClose={() => setAuthOpen(false)} />}
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
