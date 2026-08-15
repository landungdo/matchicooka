import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase.js";
import { vnd } from "../data/menu.js";

const TZ = "Asia/Ho_Chi_Minh";
const vnDay = (iso) => new Date(iso).toLocaleDateString("en-CA", { timeZone: TZ }); // YYYY-MM-DD
const vnHour = (iso) => parseInt(new Date(iso).toLocaleString("en-GB", { timeZone: TZ, hour: "2-digit", hour12: false }), 10);
const dayShort = (ymd) => new Date(ymd + "T12:00:00").toLocaleDateString("en-GB", { timeZone: TZ, weekday: "short", day: "2-digit" });

function Bar({ label, value, max, display }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="an-bar">
      <span className="an-bar-label">{label}</span>
      <div className="an-bar-track"><div className="an-bar-fill" style={{ width: pct + "%" }} /></div>
      <span className="an-bar-val">{display}</span>
    </div>
  );
}

export default function Analytics() {
  const [loading, setLoading] = useState(true);
  const [m, setM] = useState(null);

  useEffect(() => {
    (async () => {
      const { data: orders } = await supabase.from("orders")
        .select("id,subtotal,status,created_at,making_at,ready_at");
      const { data: items } = await supabase.from("order_items")
        .select("order_id,product_name,qty,price,item_rating");
      const os = orders || [], its = items || [];

      const cancelled = new Set(os.filter((o) => o.status === "cancelled").map((o) => o.id));
      const live = os.filter((o) => o.status !== "cancelled");

      const revenue = live.reduce((s, o) => s + (o.subtotal || 0), 0);
      const count = live.length;
      const cancelRate = os.length ? Math.round((cancelled.size / os.length) * 100) : 0;

      // avg brew time (ready - making), minutes
      const brews = os.filter((o) => o.making_at && o.ready_at)
        .map((o) => (new Date(o.ready_at) - new Date(o.making_at)) / 60000);
      const avgBrew = brews.length ? (brews.reduce((a, b) => a + b, 0) / brews.length) : null;

      // avg rating (per item)
      const rated = its.filter((it) => it.item_rating);
      const avgRating = rated.length ? (rated.reduce((a, it) => a + it.item_rating, 0) / rated.length) : null;

      // revenue by last 7 VN days
      const days = [];
      const now = new Date();
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now); d.setDate(now.getDate() - i);
        days.push(d.toLocaleDateString("en-CA", { timeZone: TZ }));
      }
      const revByDay = Object.fromEntries(days.map((d) => [d, 0]));
      live.forEach((o) => { const d = vnDay(o.created_at); if (d in revByDay) revByDay[d] += o.subtotal || 0; });

      // orders by hour
      const byHour = Array.from({ length: 24 }, () => 0);
      live.forEach((o) => { byHour[vnHour(o.created_at)]++; });

      // top drinks by qty (exclude cancelled orders)
      const qtyByName = {};
      its.forEach((it) => { if (!cancelled.has(it.order_id)) qtyByName[it.product_name] = (qtyByName[it.product_name] || 0) + it.qty; });
      const topDrinks = Object.entries(qtyByName).sort((a, b) => b[1] - a[1]).slice(0, 6);

      // rating per product
      const rmap = {};
      rated.forEach((it) => { (rmap[it.product_name] ||= []).push(it.item_rating); });
      const ratingByProduct = Object.entries(rmap)
        .map(([name, arr]) => [name, arr.reduce((a, b) => a + b, 0) / arr.length, arr.length])
        .sort((a, b) => b[1] - a[1]);

      setM({ revenue, count, cancelRate, avgBrew, avgRating, revByDay, days, byHour, topDrinks, ratingByProduct });
      setLoading(false);
    })();
  }, []);

  if (loading) return <div className="an-empty">Crunching numbers…</div>;
  if (!m) return <div className="an-empty">No data yet.</div>;

  const maxRev = Math.max(1, ...Object.values(m.revByDay));
  const maxHour = Math.max(1, ...m.byHour);
  const maxQty = Math.max(1, ...m.topDrinks.map(([, q]) => q));
  // busiest hours: only show hours that have any orders, else a hint
  const activeHours = m.byHour.map((v, h) => [h, v]).filter(([, v]) => v > 0);

  return (
    <div className="an-wrap">
      <div className="an-kpis">
        <div className="an-kpi"><div className="an-kpi-v">{vnd(m.revenue)}</div><div className="an-kpi-l">Revenue (non-cancelled)</div></div>
        <div className="an-kpi"><div className="an-kpi-v">{m.count}</div><div className="an-kpi-l">Orders</div></div>
        <div className="an-kpi"><div className="an-kpi-v">{m.avgBrew != null ? m.avgBrew.toFixed(1) + "m" : "—"}</div><div className="an-kpi-l">Avg brew time</div></div>
        <div className="an-kpi"><div className="an-kpi-v">{m.avgRating != null ? m.avgRating.toFixed(2) + "★" : "—"}</div><div className="an-kpi-l">Avg rating</div></div>
        <div className="an-kpi"><div className="an-kpi-v">{m.cancelRate}%</div><div className="an-kpi-l">Cancel rate</div></div>
      </div>

      <div className="an-sec">
        <h3 className="an-h3">Revenue · last 7 days</h3>
        {m.days.map((d) => <Bar key={d} label={dayShort(d)} value={m.revByDay[d]} max={maxRev} display={vnd(m.revByDay[d])} />)}
      </div>

      <div className="an-sec">
        <h3 className="an-h3">Orders by hour</h3>
        {activeHours.length === 0 ? <div className="an-hint">No orders yet.</div> :
          activeHours.map(([h, v]) => <Bar key={h} label={String(h).padStart(2, "0") + ":00"} value={v} max={maxHour} display={String(v)} />)}
      </div>

      <div className="an-sec">
        <h3 className="an-h3">Top drinks</h3>
        {m.topDrinks.length === 0 ? <div className="an-hint">No sales yet.</div> :
          m.topDrinks.map(([name, q]) => <Bar key={name} label={name} value={q} max={maxQty} display={q + " sold"} />)}
      </div>

      <div className="an-sec">
        <h3 className="an-h3">Rating by product</h3>
        {m.ratingByProduct.length === 0 ? <div className="an-hint">No ratings yet.</div> :
          m.ratingByProduct.map(([name, avg, n]) => (
            <div key={name} className="an-rrow">
              <span className="an-rname">{name}</span>
              <span className="an-rval">{avg.toFixed(2)}★ <span className="an-rn">({n})</span></span>
            </div>
          ))}
      </div>

      <style>{`
        .an-wrap{flex:1;overflow-y:auto;padding:1.3rem;font-family:Inter,system-ui,sans-serif;color:#304236;}
        .an-empty{margin:auto;text-align:center;color:#8a988a;padding:2rem;}
        .an-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:.7rem;margin-bottom:1.6rem;}
        .an-kpi{background:#F8F5ED;border-radius:14px;padding:.9rem 1rem;}
        .an-kpi-v{font-family:'Fraunces',Georgia,serif;font-weight:700;font-size:1.35rem;color:#6F8F62;}
        .an-kpi-l{font-size:.72rem;color:#8a988a;margin-top:.15rem;}
        .an-sec{margin-bottom:1.6rem;}
        .an-h3{font-family:'Fraunces',Georgia,serif;font-size:1.05rem;font-weight:600;margin:0 0 .7rem;}
        .an-hint{font-size:.85rem;color:#9aa89a;}
        .an-bar{display:flex;align-items:center;gap:.6rem;margin-bottom:.45rem;}
        .an-bar-label{width:64px;flex-shrink:0;font-size:.78rem;color:#5b6b5f;}
        .an-bar-track{flex:1;height:16px;background:#F0EBDF;border-radius:999px;overflow:hidden;}
        .an-bar-fill{height:100%;background:linear-gradient(90deg,#A9BFA0,#6F8F62);border-radius:999px;transition:width .5s ease;}
        .an-bar-val{width:82px;flex-shrink:0;text-align:right;font-size:.76rem;font-weight:600;color:#304236;}
        .an-rrow{display:flex;justify-content:space-between;padding:.45rem 0;border-bottom:1px solid rgba(48,66,54,.06);font-size:.9rem;}
        .an-rname{font-weight:500;}
        .an-rval{font-weight:700;color:#4c7a3f;}
        .an-rn{color:#9aa89a;font-weight:500;font-size:.8rem;}
      `}</style>
    </div>
  );
}
