import { BUNNY_SVG } from "../data/assets.js";
import { vnd } from "../data/menu.js";
import { Check } from "lucide-react";

export default function OrderConfirm({ order, onTrack, onClose }) {
  return (
    <div className="oc-overlay" onClick={onClose}>
      <div className="oc-card" role="dialog" aria-modal="true" aria-label="Order received" onClick={(e) => e.stopPropagation()}>
        <div className="oc-check"><Check size={30} strokeWidth={3} /></div>
        <span className="oc-bunny" dangerouslySetInnerHTML={{ __html: BUNNY_SVG }} />
        <h2 className="oc-title">Order received!</h2>
        <div className="oc-no">{order.order_no || "—"}</div>
        <p className="oc-sub">Show this order number at the counter.</p>

        <div className="oc-row"><span>Items</span><span>{order.count}</span></div>
        <div className="oc-row"><span>Total</span><span className="oc-total">{vnd(order.subtotal)}</span></div>
        <div className="oc-row"><span>Payment</span><span>Pay at counter</span></div>

        <button className="oc-btn primary" onClick={onTrack}>Track my order</button>
        <button className="oc-btn ghost" onClick={onClose}>Continue shopping</button>
      </div>

      <style>{`
        .oc-overlay{position:fixed;inset:0;z-index:99;display:grid;place-items:center;padding:1rem;
          background:rgba(48,66,54,.4);backdrop-filter:blur(4px);animation:oc-fade .2s ease;
          font-family:Inter,system-ui,sans-serif;color:#304236;}
        .oc-card{position:relative;width:min(380px,94vw);background:#FCFBF7;border-radius:26px;padding:2.4rem 1.8rem 1.7rem;
          text-align:center;box-shadow:0 24px 60px rgba(48,66,54,.3);animation:oc-pop .3s cubic-bezier(.34,1.4,.6,1);}
        .oc-check{width:56px;height:56px;border-radius:50%;background:#6F8F62;color:#fff;display:grid;place-items:center;margin:0 auto;}
        .oc-bunny{display:block;width:52px;height:52px;margin:.8rem auto .2rem;}
        .oc-bunny svg{width:100%;height:100%;}
        .oc-title{font-family:'Fraunces',Georgia,serif;font-size:1.5rem;font-weight:600;margin:.3rem 0 .1rem;}
        .oc-no{font-family:'Fraunces',Georgia,serif;font-weight:700;font-size:1.7rem;color:#6F8F62;letter-spacing:.02em;}
        .oc-sub{color:#8a988a;font-size:.86rem;margin:.3rem 0 1.2rem;}
        .oc-row{display:flex;justify-content:space-between;font-size:.9rem;padding:.5rem 0;border-top:1px solid rgba(48,66,54,.08);}
        .oc-row span:first-child{color:#8a988a;}
        .oc-total{font-weight:700;color:#304236;}
        .oc-btn{width:100%;border:none;border-radius:999px;padding:.85rem;font-weight:600;font-size:.95rem;cursor:pointer;
          font-family:inherit;margin-top:.7rem;transition:all .18s;}
        .oc-btn.primary{background:#6F8F62;color:#fff;box-shadow:0 6px 16px rgba(111,143,98,.3);}
        .oc-btn.primary:hover{transform:translateY(-2px);}
        .oc-btn.ghost{background:#F8F5ED;color:#304236;}
        .oc-btn.ghost:hover{background:#DDE8D8;}
        @keyframes oc-fade{from{opacity:0}to{opacity:1}}
        @keyframes oc-pop{from{opacity:0;transform:translateY(12px) scale(.97)}to{opacity:1;transform:none}}
      `}</style>
    </div>
  );
}
