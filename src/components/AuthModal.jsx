import { useState } from "react";
import { useAuth } from "../lib/AuthContext.jsx";
import { useLang } from "../lib/i18n.jsx";
import { BUNNY_SVG } from "../data/assets.js";

export default function AuthModal({ onClose }) {
  const { signIn, signUp } = useAuth();
  const { t } = useLang();
  const [mode, setMode] = useState("login"); // 'login' | 'signup'
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [info, setInfo] = useState("");

  const submit = async () => {
    setErr(""); setInfo("");
    if (!email || !pw) { setErr(t("auth.needCreds")); return; }
    if (pw.length < 6) { setErr(t("auth.shortPw")); return; }
    setBusy(true);
    try {
      if (mode === "login") {
        const { error } = await signIn(email.trim(), pw);
        if (error) throw error;
        onClose();
      } else {
        const { data, error } = await signUp(email.trim(), pw, name.trim() || null);
        if (error) throw error;
        if (data.session) onClose();
        else setInfo(t("auth.created"));
      }
    } catch (e) {
      setErr(e.message || t("auth.generic"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="am-overlay" onClick={onClose}>
      <div className="am-card" role="dialog" aria-modal="true" aria-label="Sign in" onClick={(e) => e.stopPropagation()}>
        <button className="am-close" onClick={onClose} aria-label="Close">✕</button>

        <span className="am-bunny" dangerouslySetInnerHTML={{ __html: BUNNY_SVG }} />
        <h2 className="am-title">{mode === "login" ? t("auth.welcome") : t("auth.create")}</h2>
        <p className="am-sub">
          {mode === "login" ? t("auth.subLogin") : t("auth.subSignup")}
        </p>

        <div className="am-tabs">
          <button className={"am-tab" + (mode === "login" ? " on" : "")} onClick={() => setMode("login")}>{t("auth.tabLogin")}</button>
          <button className={"am-tab" + (mode === "signup" ? " on" : "")} onClick={() => setMode("signup")}>{t("auth.tabSignup")}</button>
        </div>

        <div className="am-form">
          {mode === "signup" && (
            <input className="am-input" placeholder={t("auth.name")} value={name} onChange={(e) => setName(e.target.value)} />
          )}
          <input className="am-input" type="email" placeholder={t("auth.email")} value={email} onChange={(e) => setEmail(e.target.value)} />
          <input className="am-input" type="password" placeholder={t("auth.password")} value={pw}
                 onChange={(e) => setPw(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} />

          {err && <div className="am-err">{err}</div>}
          {info && <div className="am-info">{info}</div>}

          <button className="am-submit" onClick={submit} disabled={busy}>
            {busy ? t("auth.wait") : mode === "login" ? t("auth.tabLogin") : t("auth.create")}
          </button>
        </div>
      </div>

      <style>{`
        .am-overlay{position:fixed;inset:0;z-index:100;display:grid;place-items:center;padding:1rem;
          background:rgba(48,66,54,.4);backdrop-filter:blur(4px);animation:am-fade .2s ease;}
        .am-card{position:relative;width:min(400px,94vw);background:#FCFBF7;border-radius:26px;
          padding:2rem 1.8rem 1.8rem;text-align:center;box-shadow:0 24px 60px rgba(48,66,54,.28);
          font-family:'Inter',system-ui,sans-serif;color:#304236;animation:am-pop .25s cubic-bezier(.34,1.4,.6,1);}
        .am-close{position:absolute;top:1rem;right:1.1rem;border:none;background:none;font-size:1.1rem;color:rgba(48,66,54,.4);cursor:pointer;}
        .am-close:hover{color:#6F8F62;}
        .am-bunny{display:block;width:64px;height:64px;margin:0 auto .6rem;}
        .am-bunny svg{width:100%;height:100%;}
        .am-title{font-family:'Fraunces','Georgia',serif;font-size:1.6rem;font-weight:600;margin:0;}
        .am-sub{color:rgba(48,66,54,.6);font-size:.9rem;margin:.35rem 0 1.2rem;}
        .am-tabs{display:flex;gap:.4rem;background:#F8F5ED;padding:.35rem;border-radius:14px;margin-bottom:1.1rem;}
        .am-tab{flex:1;padding:.55rem;border:none;background:none;border-radius:10px;font-weight:600;font-size:.9rem;color:rgba(48,66,54,.55);cursor:pointer;transition:all .2s;font-family:inherit;}
        .am-tab.on{background:#FCFBF7;color:#6F8F62;box-shadow:0 2px 8px rgba(48,66,54,.08);}
        .am-form{display:flex;flex-direction:column;gap:.7rem;}
        .am-input{padding:.8rem 1rem;border-radius:12px;border:1.5px solid rgba(48,66,54,.14);background:#F8F5ED;
          font-family:inherit;font-size:.95rem;color:#304236;}
        .am-input:focus{outline:none;border-color:#6F8F62;background:#FCFBF7;}
        .am-err{background:#F7E3E3;color:#9B4444;font-size:.82rem;padding:.55rem .8rem;border-radius:10px;text-align:left;}
        .am-info{background:#DDE8D8;color:#3f6b3f;font-size:.82rem;padding:.55rem .8rem;border-radius:10px;text-align:left;}
        .am-submit{margin-top:.3rem;padding:.85rem;border:none;border-radius:999px;background:#6F8F62;color:#fff;
          font-weight:600;font-size:.98rem;cursor:pointer;font-family:inherit;box-shadow:0 6px 16px rgba(111,143,98,.3);transition:all .18s;}
        .am-submit:hover{transform:translateY(-2px);box-shadow:0 10px 22px rgba(111,143,98,.36);}
        .am-submit:disabled{opacity:.5;transform:none;cursor:not-allowed;}
        @keyframes am-fade{from{opacity:0}to{opacity:1}}
        @keyframes am-pop{from{opacity:0;transform:translateY(12px) scale(.97)}to{opacity:1;transform:none}}
      `}</style>
    </div>
  );
}
