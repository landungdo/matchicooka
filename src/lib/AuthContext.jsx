import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "./supabase.js";

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [ready, setReady] = useState(false);

  // Track the auth session
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  // Load the profile row (role, display_name) whenever the user changes
  useEffect(() => {
    let active = true;
    async function load() {
      if (!session?.user) { setProfile(null); return; }
      const { data } = await supabase
        .from("profiles")
        .select("id, role, display_name, phone")
        .eq("id", session.user.id)
        .single();
      if (active) setProfile(data || null);
    }
    load();
    return () => { active = false; };
  }, [session]);

  const value = {
    ready,
    session,
    user: session?.user || null,
    profile,
    role: profile?.role || null,
    isOwner: profile?.role === "owner",
    name: profile?.display_name || session?.user?.email?.split("@")[0] || "Bạn",
    signUp: (email, password, display_name) =>
      supabase.auth.signUp({ email, password, options: { data: { display_name } } }),
    signIn: (email, password) => supabase.auth.signInWithPassword({ email, password }),
    signOut: () => supabase.auth.signOut(),
  };

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
