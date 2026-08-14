import { useState, useEffect, useRef } from "react";
import { supabase } from "../lib/supabase.js";
import { useAuth } from "../lib/AuthContext.jsx";
import { BUNNY_SVG } from "../data/assets.js";
import { MessageCircle, X, Send } from "lucide-react";

export default function ChatDock() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef(null);
  const roomId = user?.id;

  useEffect(() => {
    if (!roomId) return;
    let active = true;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("messages").select("*")
        .eq("room_user_id", roomId)
        .order("created_at", { ascending: true });
      if (active) { setMsgs(data || []); setLoading(false); }
    })();

    const channel = supabase
      .channel("chat:" + roomId)
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `room_user_id=eq.${roomId}` },
        (payload) => setMsgs((m) => (m.some((x) => x.id === payload.new.id) ? m : [...m, payload.new]))
      )
      .subscribe();

    return () => { active = false; supabase.removeChannel(channel); };
  }, [roomId]);

  useEffect(() => {
    if (open) setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 60);
  }, [msgs, open]);

  const send = async () => {
    const body = text.trim();
    if (!body || !roomId) return;
    setText("");
    const { data, error } = await supabase
      .from("messages")
      .insert({ room_user_id: roomId, sender_id: roomId, sender_role: "customer", body })
      .select().single();
    if (!error && data) setMsgs((m) => (m.some((x) => x.id === data.id) ? m : [...m, data]));
  };

  if (!user) return null;

  return (
    <>
      {!open && (
        <button className="cd-fab" onClick={() => setOpen(true)} aria-label="Chat với quán">
          <MessageCircle size={24} />
        </button>
      )}

      {open && (
        <div className="cd-panel" role="dialog" aria-label="Chat với matchicooka">
          <header className="cd-head">
            <span className="cd-bunny" dangerouslySetInnerHTML={{ __html: BUNNY_SVG }} />
            <div>
              <div className="cd-title">matchicooka</div>
              <div className="cd-sub">Nhắn cho quán ✿</div>
            </div>
            <button className="cd-x" onClick={() => setOpen(false)} aria-label="Đóng"><X size={18} /></button>
          </header>

          <div className="cd-body">
            {loading && <div className="cd-empty">Đang tải…</div>}
            {!loading && msgs.length === 0 && (
              <div className="cd-empty">
                <span className="cd-bunny lg" dangerouslySetInnerHTML={{ __html: BUNNY_SVG }} />
                <p>Chào bạn! Nhắn gì cho quán cũng được — ít đá, thêm foam, hỏi đơn…</p>
              </div>
            )}
            {msgs.map((m) => (
              <div key={m.id} className={"cd-msg " + (m.sender_role === "customer" ? "me" : "shop")}>
                {m.sender_role === "owner" && <span className="cd-ava" dangerouslySetInnerHTML={{ __html: BUNNY_SVG }} />}
                <span className="cd-bubble">{m.body}</span>
              </div>
            ))}
            <div ref={endRef} />
          </div>

          <div className="cd-foot">
            <input
              className="cd-input"
              placeholder="Nhắn tin…"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
            />
            <button className="cd-send" onClick={send} aria-label="Gửi"><Send size={17} /></button>
          </div>
        </div>
      )}

      <style>{`
        .cd-fab{position:fixed;right:18px;bottom:18px;z-index:70;width:58px;height:58px;border-radius:50%;
          background:#6F8F62;color:#fff;border:none;display:grid;place-items:center;cursor:pointer;
          box-shadow:0 10px 24px rgba(111,143,98,.4);transition:transform .18s;}
        .cd-fab:hover{transform:translateY(-3px) scale(1.05);}
        .cd-panel{position:fixed;right:18px;bottom:18px;z-index:71;width:min(360px,92vw);height:min(560px,80vh);
          background:#FCFBF7;border-radius:22px;box-shadow:0 24px 60px rgba(48,66,54,.3);display:flex;flex-direction:column;
          overflow:hidden;font-family:Inter,system-ui,sans-serif;color:#304236;animation:cd-pop .25s cubic-bezier(.34,1.4,.6,1);}
        @keyframes cd-pop{from{opacity:0;transform:translateY(16px) scale(.96)}to{opacity:1;transform:none}}
        .cd-head{display:flex;align-items:center;gap:.6rem;padding:.9rem 1rem;background:#DDE8D8;}
        .cd-bunny{width:38px;height:38px;flex-shrink:0;}
        .cd-bunny svg{width:100%;height:100%;display:block;}
        .cd-bunny.lg{width:72px;height:72px;margin:0 auto .6rem;}
        .cd-title{font-family:'Fraunces',Georgia,serif;font-weight:600;font-size:1.1rem;line-height:1;}
        .cd-sub{font-size:.75rem;color:#5b6b5f;margin-top:2px;}
        .cd-x{margin-left:auto;border:none;background:none;color:#5b6b5f;cursor:pointer;padding:4px;border-radius:8px;}
        .cd-x:hover{background:rgba(48,66,54,.08);}
        .cd-body{flex:1;overflow-y:auto;padding:1rem;display:flex;flex-direction:column;gap:.55rem;}
        .cd-empty{margin:auto;text-align:center;color:#8a988a;font-size:.9rem;line-height:1.5;padding:1rem;}
        .cd-msg{display:flex;align-items:flex-end;gap:.4rem;max-width:82%;}
        .cd-msg.me{align-self:flex-end;}
        .cd-msg.shop{align-self:flex-start;}
        .cd-ava{width:26px;height:26px;flex-shrink:0;}
        .cd-ava svg{width:100%;height:100%;}
        .cd-bubble{padding:.6rem .85rem;border-radius:16px;font-size:.9rem;line-height:1.4;word-break:break-word;}
        .cd-msg.me .cd-bubble{background:#6F8F62;color:#fff;border-bottom-right-radius:5px;}
        .cd-msg.shop .cd-bubble{background:#F0EBDF;color:#304236;border-bottom-left-radius:5px;}
        .cd-foot{display:flex;gap:.5rem;padding:.7rem;border-top:1px solid rgba(48,66,54,.08);}
        .cd-input{flex:1;padding:.7rem .9rem;border-radius:999px;border:1.5px solid rgba(48,66,54,.14);
          background:#F8F5ED;font-family:inherit;font-size:.9rem;color:#304236;}
        .cd-input:focus{outline:none;border-color:#6F8F62;}
        .cd-send{width:42px;height:42px;flex-shrink:0;border:none;border-radius:50%;background:#6F8F62;color:#fff;
          display:grid;place-items:center;cursor:pointer;}
        .cd-send:hover{background:#5E7D48;}
      `}</style>
    </>
  );
}
