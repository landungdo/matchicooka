import React, { useState, useEffect } from "react";
import {
  ShoppingBag, Leaf, Check, Plus, Minus, X, Heart, Sparkles, ArrowRight, Trash2,
} from "lucide-react";

/* ============================================================
   matchicooka bar — Build Your Matcha
   Single-file MVP. Product config separated from presentation.
   NOTE: cart & saved recipes use in-memory React state (Claude
   artifacts block localStorage). Data shapes are serialisable, so
   for a deployable build you swap the two useState hooks for a
   localStorage-backed store — a drop-in change, no other edits.
   ============================================================ */

/* ---------- Brand assets (compressed WebP data URIs) ---------- */
import { ASSETS, BUNNY_SVG } from "./data/assets.js";

/* ---------- Design tokens ---------- */
const C = {
  matcha: "#6F8F62", sage: "#A9BFA0", lightMatcha: "#DDE8D8", cream: "#F8F5ED",
  warmWhite: "#FCFBF7", darkGreen: "#304236", beige: "#EDE5D8", brown: "#9B8068",
};

/* ---------- Product configuration (data layer) ---------- */
const STRENGTHS = [
  { id: "light",       label: "Light",        leaves: 1, desc: "Soft, creamy and easy to drink.",       color: "#C4D8B4" },
  { id: "regular",     label: "Regular",      leaves: 2, desc: "Balanced matcha flavor.",               color: "#9DBE86" },
  { id: "strong",      label: "Strong",       leaves: 3, desc: "Bold, earthy and unmistakably matcha.", color: "#7A9A62" },
  { id: "extraStrong", label: "Extra Strong", leaves: 4, desc: "For serious matcha lovers.",            color: "#5E7D48" },
];
const SWEETNESS = [0, 25, 50, 75, 100];
const SWEET_LABEL = { 0: "No Sugar", 25: "Less Sweet", 50: "Balanced", 75: "Sweet", 100: "Extra Sweet" };
const MILKS = [
  { id: "fresh",   label: "Fresh Milk",   price: 0     },
  { id: "oat",     label: "Oat Milk",     price: 10000 },
  { id: "soy",     label: "Soy Milk",     price: 8000  },
  { id: "almond",  label: "Almond Milk",  price: 12000 },
  { id: "coconut", label: "Coconut Milk", price: 10000 },
];
const ICES = [
  { id: "none", label: "No Ice", cubes: 0 }, { id: "less", label: "Less Ice", cubes: 2 },
  { id: "regular", label: "Regular Ice", cubes: 3 }, { id: "extra", label: "Extra Ice", cubes: 5 },
];
const EXTRAS = [
  { id: "matchaFoam",      label: "Matcha Foam",       price: 10000, foam: "#CBE0B3" },
  { id: "creamCheeseFoam", label: "Cream Cheese Foam", price: 12000, foam: "#F3ECDD" },
  { id: "redBean",         label: "Red Bean",          price: 8000  },
  { id: "brownSugarJelly", label: "Brown Sugar Jelly", price: 8000  },
  { id: "extraShot",       label: "Extra Matcha Shot", price: 12000 },
];
const PRODUCTS = [
  { id: "classic",    name: "Classic Matcha Latte",    desc: "Ceremonial matcha blended with creamy milk.",  base: 55000 },
  { id: "strawberry", name: "Strawberry Matcha",       desc: "Fresh strawberry layered under smooth matcha.", base: 60000 },
  { id: "coconut",    name: "Coconut Matcha",          desc: "Matcha rounded out with silky coconut milk.",   base: 62000 },
  { id: "cloud",      name: "Matcha Cloud",            desc: "An airy cream cloud over bright matcha.",        base: 65000 },
  { id: "dirty",      name: "Dirty Matcha",            desc: "Matcha with a bold shot of espresso.",           base: 68000 },
  { id: "espresso",   name: "Matcha Espresso",         desc: "Bold espresso meets earthy matcha.",             base: 66000 },
  { id: "strawcloud", name: "Matcha Strawberry Cloud", desc: "Strawberry, matcha and a cream cloud.",          base: 70000 },
];
const PRESETS = [
  { id: "beginner", name: "Matcha Beginner", tagline: "Gentle and creamy",   config: { strength: "light",       sweetness: 50,  milk: "fresh", ice: "regular", extras: [] } },
  { id: "lover",    name: "Matcha Lover",    tagline: "Bold, barely sweet",  config: { strength: "strong",      sweetness: 25,  milk: "oat",   ice: "less",    extras: [] } },
  { id: "pure",     name: "Pure Matcha",     tagline: "No sugar, all matcha",config: { strength: "extraStrong", sweetness: 0,   milk: "fresh", ice: "less",    extras: [] } },
  { id: "sweet",    name: "Sweet Tooth",     tagline: "Dessert in a cup",    config: { strength: "regular",     sweetness: 100, milk: "fresh", ice: "regular", extras: ["creamCheeseFoam"] } },
];
const DEFAULT_CONFIG = { productId: "classic", strength: "regular", sweetness: 50, milk: "fresh", ice: "less", extras: [] };

/* ---------- Helpers ---------- */
const findP = (id) => PRODUCTS.find((p) => p.id === id) || PRODUCTS[0];
const vnd = (n) => n.toLocaleString("vi-VN") + "đ";
const loadLS = (k, fallback) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fallback; } catch { return fallback; } };
const saveLS = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
function priceOf(cfg) {
  let t = findP(cfg.productId).base;
  t += MILKS.find((m) => m.id === cfg.milk)?.price || 0;
  cfg.extras.forEach((e) => (t += EXTRAS.find((x) => x.id === e)?.price || 0));
  return t;
}
function summaryLines(cfg) {
  const out = [
    STRENGTHS.find((s) => s.id === cfg.strength)?.label + " Matcha",
    cfg.sweetness + "% · " + SWEET_LABEL[cfg.sweetness],
    MILKS.find((m) => m.id === cfg.milk)?.label,
    ICES.find((i) => i.id === cfg.ice)?.label,
  ];
  cfg.extras.forEach((e) => out.push(EXTRAS.find((x) => x.id === e)?.label));
  return out.filter(Boolean);
}

/* ---------- Reusable bits ---------- */
function Bunny({ size = 40 }) {
  return <span className="mx-bunny" style={{ width: size, height: size }} dangerouslySetInnerHTML={{ __html: BUNNY_SVG }} />;
}
function Sticker({ src, alt, className = "", style }) {
  return <img src={src} alt={alt} loading="lazy" className={"mx-sticker " + className} style={style} />;
}

/* ============================================================
   Live drink preview — layered SVG, reacts to config
   ============================================================ */
function DrinkPreview({ cfg, size = 260 }) {
  const strength = STRENGTHS.find((s) => s.id === cfg.strength) || STRENGTHS[1];
  const ice = ICES.find((i) => i.id === cfg.ice) || ICES[2];
  const foam = EXTRAS.find((e) => cfg.extras.includes(e.id) && e.foam);
  const cubes = [
    { x: 72, y: 100, r: -12 }, { x: 106, y: 94, r: 14 }, { x: 122, y: 118, r: -8 },
    { x: 84, y: 130, r: 20 }, { x: 112, y: 142, r: -16 },
  ].slice(0, ice.cubes);
  return (
    <svg viewBox="0 0 200 290" width="100%" style={{ maxWidth: size, display: "block", margin: "0 auto" }} aria-label="Your matcha preview">
      <ellipse cx="100" cy="270" rx="60" ry="11" fill="rgba(48,66,54,0.10)" />
      <path d="M52,64 L148,64 L138,246 Q136,254 128,254 L72,254 Q64,254 62,246 Z" fill="rgba(255,255,255,0.55)" stroke="rgba(48,66,54,0.18)" strokeWidth="2" />
      <defs><clipPath id="gc"><path d="M55,67 L145,67 L136,244 Q134,251 128,251 L72,251 Q66,251 64,244 Z" /></clipPath></defs>
      <g clipPath="url(#gc)">
        <rect className="mx-liquid" x="48" y="74" width="104" height="185" fill={strength.color} />
        <ellipse cx="100" cy="96" rx="54" ry="15" fill="rgba(255,255,255,0.20)" />
        <ellipse cx="86" cy="150" rx="30" ry="10" fill="rgba(255,255,255,0.10)" />
        {cubes.map((c, i) => (
          <g key={i} transform={`translate(${c.x},${c.y}) rotate(${c.r})`}>
            <rect x="-11" y="-11" width="22" height="22" rx="5" fill="rgba(255,255,255,0.34)" stroke="rgba(255,255,255,0.55)" strokeWidth="1.2" />
          </g>
        ))}
        {foam && <ellipse className="mx-foam" cx="100" cy="76" rx="55" ry="19" fill={foam.foam} />}
      </g>
      <ellipse cx="100" cy="65" rx="47" ry="8" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="2" />
      <rect x="118" y="38" width="9" height="150" rx="4.5" fill={C.brown} transform="rotate(10 122 115)" />
      <rect x="118" y="38" width="3" height="150" rx="1.5" fill="rgba(255,255,255,0.25)" transform="rotate(10 122 115)" />
    </svg>
  );
}

/* ============================================================
   Step selectors
   ============================================================ */
function StrengthSelector({ value, onChange }) {
  return (
    <div className="mx-optgrid">
      {STRENGTHS.map((s) => {
        const sel = value === s.id;
        return (
          <button key={s.id} className={"mx-opt" + (sel ? " sel" : "")} onClick={() => onChange(s.id)}>
            {sel && <span className="mx-tick"><Check size={13} strokeWidth={3} /></span>}
            <span className="mx-leaves">
              {Array.from({ length: 4 }).map((_, i) => (
                <Leaf key={i} size={16} fill={i < s.leaves ? C.matcha : "none"} color={i < s.leaves ? C.matcha : "rgba(48,66,54,0.22)"} strokeWidth={1.6} />
              ))}
            </span>
            <span className="mx-opt-title">{s.label}</span>
            <span className="mx-opt-desc">{s.desc}</span>
          </button>
        );
      })}
    </div>
  );
}
function SweetnessSelector({ value, onChange }) {
  return (
    <div>
      <div className="mx-segwrap">
        {SWEETNESS.map((v) => (
          <button key={v} className={"mx-seg" + (value === v ? " sel" : "")} onClick={() => onChange(v)}>
            <span className="mx-seg-num">{v}%</span><span className="mx-seg-lab">{SWEET_LABEL[v]}</span>
          </button>
        ))}
      </div>
      <p className="mx-helper">You can always make life sweeter. Your matcha doesn't have to be.</p>
    </div>
  );
}
function MilkSelector({ value, onChange }) {
  return (
    <div className="mx-optgrid mx-milkgrid">
      {MILKS.map((m) => {
        const sel = value === m.id;
        return (
          <button key={m.id} className={"mx-opt mx-milk" + (sel ? " sel" : "")} onClick={() => onChange(m.id)}>
            {sel && <span className="mx-tick"><Check size={13} strokeWidth={3} /></span>}
            <span className="mx-milkdot" /><span className="mx-opt-title">{m.label}</span>
            <span className="mx-price-tag">{m.price === 0 ? "Included" : "+" + vnd(m.price)}</span>
          </button>
        );
      })}
    </div>
  );
}
function IceSelector({ value, onChange }) {
  return (
    <div className="mx-segwrap mx-icewrap">
      {ICES.map((i) => (
        <button key={i.id} className={"mx-seg mx-iceseg" + (value === i.id ? " sel" : "")} onClick={() => onChange(i.id)}>
          <span className="mx-icecubes">
            {Array.from({ length: 3 }).map((_, k) => (
              <span key={k} className="mx-icecube" style={{ opacity: k < Math.min(3, i.cubes) ? 1 : 0.2 }} />
            ))}
          </span>
          <span className="mx-seg-lab">{i.label}</span>
        </button>
      ))}
    </div>
  );
}
function ExtrasSelector({ value, onToggle }) {
  return (
    <div className="mx-optgrid mx-milkgrid">
      {EXTRAS.map((e) => {
        const sel = value.includes(e.id);
        return (
          <button key={e.id} className={"mx-opt mx-milk" + (sel ? " sel" : "")} onClick={() => onToggle(e.id)}>
            {sel && <span className="mx-tick"><Check size={13} strokeWidth={3} /></span>}
            <span className="mx-opt-title">{e.label}</span><span className="mx-price-tag">+{vnd(e.price)}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ---------- Order summary ---------- */
function OrderSummary({ cfg, onAdd, onSave }) {
  const [name, setName] = useState("");
  return (
    <div className="mx-summary">
      <div className="mx-sum-name">{findP(cfg.productId).name}</div>
      <div className="mx-chips">{summaryLines(cfg).map((l, i) => <span key={i} className="mx-chip">{l}</span>)}</div>
      <button className="mx-btn mx-btn-primary mx-addbtn" onClick={onAdd}><ShoppingBag size={17} /> Add to Cart — {vnd(priceOf(cfg))}</button>
      <div className="mx-saverow">
        <input className="mx-input" placeholder="Name this matcha…" value={name} onChange={(e) => setName(e.target.value)} />
        <button className="mx-btn mx-btn-ghost" onClick={() => { onSave(name.trim() || "My Matcha"); setName(""); }}><Heart size={15} /> Save</button>
      </div>
    </div>
  );
}

/* ============================================================
   Build page
   ============================================================ */
function Step({ id, n, title, children }) {
  return (
    <section id={id} className="mx-card mx-step">
      <div className="mx-step-head"><span className="mx-step-badge">{n}</span><h3>{title}</h3></div>
      {children}
    </section>
  );
}
function BuildPage({ cfg, setCfg, onAdd, onSave }) {
  const set = (k, v) => setCfg((c) => ({ ...c, [k]: v }));
  const toggle = (id) => setCfg((c) => ({ ...c, extras: c.extras.includes(id) ? c.extras.filter((x) => x !== id) : [...c.extras, id] }));
  const scrollTo = (id) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  const steps = [["s-strength", "Matcha"], ["s-sweet", "Sweetness"], ["s-milk", "Milk"], ["s-ice", "Ice"], ["s-extras", "Extras"]];
  return (
    <div className="mx-build">
      <div className="mx-steprail">
        {steps.map(([id, label], i) => (
          <button key={id} className="mx-steppill" onClick={() => scrollTo(id)}><span className="mx-stepnum">{i + 1}</span><span>{label}</span></button>
        ))}
      </div>
      <div className="mx-buildgrid">
        <div className="mx-left">
          <div className="mx-card mx-previewcard"><DrinkPreview cfg={cfg} /></div>
          <div className="mx-hide-mobile"><OrderSummary cfg={cfg} onAdd={onAdd} onSave={onSave} /></div>
        </div>
        <div className="mx-right">
          <Step id="s-strength" n="1" title="How matcha are you feeling?"><StrengthSelector value={cfg.strength} onChange={(v) => set("strength", v)} /></Step>
          <Step id="s-sweet" n="2" title="How sweet?"><SweetnessSelector value={cfg.sweetness} onChange={(v) => set("sweetness", v)} /></Step>
          <Step id="s-milk" n="3" title="Choose your milk"><MilkSelector value={cfg.milk} onChange={(v) => set("milk", v)} /></Step>
          <Step id="s-ice" n="4" title="Ice level"><IceSelector value={cfg.ice} onChange={(v) => set("ice", v)} /></Step>
          <Step id="s-extras" n="5" title="Add some extras"><ExtrasSelector value={cfg.extras} onToggle={toggle} /></Step>
        </div>
      </div>
      <div className="mx-mobilebar">
        <div><div className="mx-mb-name">{findP(cfg.productId).name}</div><div className="mx-mb-price">{vnd(priceOf(cfg))}</div></div>
        <button className="mx-btn mx-btn-primary" onClick={onAdd}><ShoppingBag size={16} /> Add to Cart</button>
      </div>
    </div>
  );
}

/* ============================================================
   Home
   ============================================================ */
function Home({ go, onPreset, onCloud }) {
  return (
    <div className="mx-home">
      <section className="mx-hero">
        <div className="mx-hero-copy">
          <div className="mx-eyebrow"><Sparkles size={14} /> Whisked fresh, made to order</div>
          <h1 className="mx-h1">Matcha,<br />made your way.</h1>
          <p className="mx-lead">Pick your strength, sweetness, milk and more. We'll whisk your perfect cup — cute little bear on top optional.</p>
          <div className="mx-herobtns">
            <button className="mx-btn mx-btn-primary" onClick={() => go("build")}>Build My Matcha <ArrowRight size={17} /></button>
            <button className="mx-btn mx-btn-ghost" onClick={() => go("menu")}>Explore Menu</button>
          </div>
        </div>
        <div className="mx-hero-art">
          <span className="mx-blob mx-blob-1" /><span className="mx-blob mx-blob-2" />
          <Leaf className="mx-floatleaf mx-fl-1" size={30} color={C.sage} fill={C.sage} />
          <Leaf className="mx-floatleaf mx-fl-2" size={22} color={C.lightMatcha} fill={C.lightMatcha} />
          <div className="mx-photo mx-hero-photo"><img src={ASSETS.hero} alt="Bunny latte-art matcha" loading="lazy" /></div>
          <Sticker src={ASSETS.stickerHamster} alt="Hamster with iced matcha" className="float mx-hero-sticker" />
        </div>
      </section>

      <section className="mx-presets">
        <div className="mx-sec-head"><h2 className="mx-h2">Not sure what to choose?</h2><p className="mx-sub">Start from a profile, then make it yours.</p></div>
        <div className="mx-presetgrid">
          {PRESETS.map((p) => (
            <div key={p.id} className="mx-card mx-presetcard">
              <DrinkPreview cfg={{ ...DEFAULT_CONFIG, ...p.config }} size={140} />
              <div className="mx-preset-name">{p.name}</div><div className="mx-preset-tag">{p.tagline}</div>
              <ul className="mx-preset-list">{summaryLines({ ...DEFAULT_CONFIG, ...p.config }).slice(0, 4).map((l, i) => <li key={i}>{l}</li>)}</ul>
              <button className="mx-btn mx-btn-soft" onClick={() => onPreset(p)}>Try this</button>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-story">
        <div className="mx-photo"><img src={ASSETS.story} alt="Ceremonial matcha bowl with bunny" loading="lazy" /></div>
        <div className="mx-story-copy">
          <div className="mx-eyebrow"><Leaf size={14} /> Ceremonial grade</div>
          <h2 className="mx-h2">Stone-ground, whisked by hand.</h2>
          <p className="mx-sub">Every cup starts with ceremonial matcha, sifted and whisked to a smooth froth before it ever meets your milk and ice. Calm, grassy, never bitter.</p>
          <button className="mx-btn mx-btn-ghost" onClick={() => go("menu")}>See the menu <ArrowRight size={16} /></button>
        </div>
      </section>

      <section className="mx-cloud">
        <Sticker src={ASSETS.stickerCat} alt="Cat with iced matcha" className="float mx-cloud-sticker" />
        <div className="mx-cloud-copy">
          <div className="mx-eyebrow"><Sparkles size={14} /> House favourite</div>
          <h2 className="mx-h2">Meet the Matcha Cloud.</h2>
          <p className="mx-sub">Bright matcha under a soft cream-cheese cloud. Order it with a little bear on top and thank us later.</p>
          <button className="mx-btn mx-btn-primary" onClick={onCloud}>Build a Cloud <ArrowRight size={16} /></button>
        </div>
        <div className="mx-photo"><img src={ASSETS.cloud} alt="Matcha Cloud drinks with bear foam" loading="lazy" /></div>
      </section>
    </div>
  );
}

/* ============================================================
   Menu / Saved
   ============================================================ */
function Menu({ onCustomize }) {
  return (
    <div className="mx-menu">
      <div className="mx-sec-head"><h2 className="mx-h2">Our Matcha</h2><p className="mx-sub">Seven house drinks. Every one fully customisable.</p></div>
      <div className="mx-menugrid">
        {PRODUCTS.map((p) => (
          <div key={p.id} className="mx-card mx-menucard">
            <div className="mx-menuart"><DrinkPreview cfg={{ ...DEFAULT_CONFIG, productId: p.id }} size={150} /></div>
            <div className="mx-menu-name">{p.name}</div><p className="mx-menu-desc">{p.desc}</p>
            <div className="mx-menu-foot"><span className="mx-from">From {vnd(p.base)}</span><button className="mx-btn mx-btn-soft" onClick={() => onCustomize(p.id)}>Customize</button></div>
          </div>
        ))}
      </div>
    </div>
  );
}
function Saved({ items, onOrder, onRemove }) {
  if (!items.length)
    return (
      <div className="mx-empty">
        <Sticker src={ASSETS.stickerCat} alt="" className="mx-empty-sticker" />
        <h2 className="mx-h2">No saved matcha yet</h2>
        <p className="mx-sub">Build a drink you love and hit Save to keep the recipe here.</p>
      </div>
    );
  return (
    <div className="mx-menu">
      <div className="mx-sec-head"><h2 className="mx-h2">My Matcha</h2><p className="mx-sub">Your saved recipes.</p></div>
      <div className="mx-menugrid">
        {items.map((it) => (
          <div key={it.id} className="mx-card mx-menucard">
            <div className="mx-menuart"><DrinkPreview cfg={it.config} size={140} /></div>
            <div className="mx-menu-name">{it.name}</div>
            <ul className="mx-preset-list">{summaryLines(it.config).map((l, i) => <li key={i}>{l}</li>)}</ul>
            <div className="mx-menu-foot"><span className="mx-from">{vnd(priceOf(it.config))}</span>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="mx-btn mx-btn-ghost mx-iconbtn" onClick={() => onRemove(it.id)} aria-label="Remove"><Trash2 size={15} /></button>
                <button className="mx-btn mx-btn-soft" onClick={() => onOrder(it.config)}>Order this</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ============================================================
   Cart drawer
   ============================================================ */
function CartDrawer({ open, onClose, items, setItems, onCheckout, phone, setPhone, note, setNote }) {
  const subtotal = items.reduce((s, it) => s + it.price * it.qty, 0);
  const setQty = (id, d) => setItems((arr) => arr.map((it) => it.id === id ? { ...it, qty: Math.max(1, it.qty + d) } : it));
  const remove = (id) => setItems((arr) => arr.filter((it) => it.id !== id));
  return (
    <>
      <div className={"mx-overlay" + (open ? " show" : "")} onClick={onClose} />
      <aside className={"mx-cart" + (open ? " open" : "")} aria-hidden={!open}>
        <div className="mx-cart-head"><h3>Your Cart</h3><button className="mx-iconbtn" onClick={onClose} aria-label="Close cart"><X size={20} /></button></div>
        <div className="mx-cart-body">
          {items.length === 0 && (
            <div className="mx-cart-empty"><Sticker src={ASSETS.stickerHamster} alt="" className="mx-cart-emptysticker" /><p>Your cart is empty.<br />Go build something good.</p></div>
          )}
          {items.map((it) => (
            <div key={it.id} className="mx-cartitem">
              <div className="mx-cartprev"><DrinkPreview cfg={it.config} size={70} /></div>
              <div className="mx-cartinfo">
                <div className="mx-cartname">{findP(it.config.productId).name}</div>
                <div className="mx-cartcustom">{summaryLines(it.config).join(" · ")}</div>
                <div className="mx-cartfoot">
                  <div className="mx-qty"><button onClick={() => setQty(it.id, -1)} aria-label="Decrease"><Minus size={13} /></button><span>{it.qty}</span><button onClick={() => setQty(it.id, 1)} aria-label="Increase"><Plus size={13} /></button></div>
                  <span className="mx-cartprice">{vnd(it.price * it.qty)}</span>
                </div>
              </div>
              <button className="mx-cartx" onClick={() => remove(it.id)} aria-label="Remove"><X size={15} /></button>
            </div>
          ))}
        </div>
        <div className="mx-cart-footer">
          {items.length > 0 && (
            <>
              <input className="mx-cart-field" placeholder="Phone number (for pickup)" value={phone} onChange={(e) => setPhone(e.target.value)} />
              <input className="mx-cart-field" placeholder="Note for the shop (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
            </>
          )}
          <div className="mx-subtotal"><span>Subtotal</span><span>{vnd(subtotal)}</span></div>
          <button className="mx-btn mx-btn-ghost" onClick={onClose}>Continue Shopping</button>
          <button className="mx-btn mx-btn-primary" disabled={!items.length || !phone.trim()} onClick={onCheckout}>Checkout</button>
        </div>
      </aside>
    </>
  );
}

/* ============================================================
   App shell
   ============================================================ */
export default function Storefront({ user, name, onLogin, onLogout, onPlaceOrder, onRequireLogin }) {
  const [view, setView] = useState("home");
  const [cfg, setCfg] = useState(DEFAULT_CONFIG);
  const [cart, setCart] = useState(() => loadLS("mx_cart", []));
  const [saved, setSaved] = useState(() => loadLS("mx_saved", []));
  const [cartOpen, setCartOpen] = useState(false);
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [toast, setToast] = useState(null);

  // Persist cart & saved recipes across refreshes (localStorage).
  useEffect(() => { saveLS("mx_cart", cart); }, [cart]);
  useEffect(() => { saveLS("mx_saved", saved); }, [saved]);

  const cartCount = cart.reduce((s, it) => s + it.qty, 0);
  const ping = (m) => { setToast(m); setTimeout(() => setToast(null), 2200); };
  const go = (v) => { setView(v); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const startBuild = (config) => { setCfg(config); go("build"); };
  const customizeProduct = (pid) => startBuild({ ...DEFAULT_CONFIG, productId: pid });
  const usePreset = (p) => startBuild({ ...DEFAULT_CONFIG, ...p.config });
  const buildCloud = () => startBuild({ ...DEFAULT_CONFIG, productId: "cloud", extras: ["creamCheeseFoam"] });
  const addToCart = () => { setCart((a) => [...a, { id: Date.now() + "-" + Math.random().toString(36).slice(2), config: { ...cfg }, qty: 1, price: priceOf(cfg) }]); setCartOpen(true); };
  const saveMatcha = (name) => { setSaved((a) => [...a, { id: Date.now() + "", name, config: { ...cfg } }]); ping("Saved to My Matcha ✿"); };
  const checkout = async () => {
    if (onPlaceOrder) {
      if (!user) { onRequireLogin && onRequireLogin(); return; }
      const ok = await onPlaceOrder(cart, { phone: phone.trim(), note: note.trim() });
      if (ok) { setCart([]); setCartOpen(false); setPhone(""); setNote(""); }   // App shows the confirmation screen
      else { ping("Couldn't place order. Try again."); }
    } else { setCart([]); setCartOpen(false); ping("Order placed — see you at the counter!"); }
  };

  const nav = [["home", "Home"], ["menu", "Menu"], ["build", "Build Your Matcha"], ["saved", "My Matcha"]];

  return (
    <div className="mx-root">
      <style>{CSS}</style>
      <header className="mx-nav">
        <button className="mx-logo" onClick={() => go("home")}>
          <Bunny size={38} /><span className="mx-word">matchi<em>cooka</em></span><span className="mx-bar">bar</span>
        </button>
        <nav className="mx-navlinks">
          {nav.map(([v, label]) => <button key={v} className={"mx-navlink" + (view === v ? " active" : "")} onClick={() => go(v)}>{label}</button>)}
        </nav>
        {user
          ? <button className="mx-authchip" onClick={onLogout}>{name} · Đăng xuất</button>
          : <button className="mx-authchip" onClick={onLogin}>Đăng nhập</button>}
        <button className="mx-cartbtn" onClick={() => setCartOpen(true)} aria-label="Open cart">
          <ShoppingBag size={20} />{cartCount > 0 && <span className="mx-cartcount">{cartCount}</span>}
        </button>
      </header>

      <main className="mx-main">
        {view === "home" && <Home go={go} onPreset={usePreset} onCloud={buildCloud} />}
        {view === "menu" && <Menu onCustomize={customizeProduct} />}
        {view === "build" && <BuildPage cfg={cfg} setCfg={setCfg} onAdd={addToCart} onSave={saveMatcha} />}
        {view === "saved" && <Saved items={saved} onOrder={startBuild} onRemove={(id) => setSaved((a) => a.filter((s) => s.id !== id))} />}
      </main>

      <footer className="mx-footer">
        <span className="mx-foot-brand"><Bunny size={26} /> matchicooka bar</span>
        <span>Whisked with care in Hanoi</span>
      </footer>

      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} items={cart} setItems={setCart} onCheckout={checkout} phone={phone} setPhone={setPhone} note={note} setNote={setNote} />
      {toast && <div className="mx-toast">{toast}</div>}
    </div>
  );
}

/* ============================================================
   Styles
   ============================================================ */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,500;0,9..144,600;1,9..144,500&family=Inter:wght@400;500;600&display=swap');

.mx-root{--matcha:${C.matcha};--sage:${C.sage};--lightM:${C.lightMatcha};--cream:${C.cream};--warm:${C.warmWhite};--dark:${C.darkGreen};--beige:${C.beige};--brown:${C.brown};
  font-family:'Inter',system-ui,-apple-system,sans-serif;color:var(--dark);background:var(--warm);min-height:100vh;-webkit-font-smoothing:antialiased;}
.mx-root *{box-sizing:border-box;}
.mx-root button{font-family:inherit;cursor:pointer;border:none;background:none;color:inherit;}
h1,h2,h3{font-family:'Fraunces','Georgia',serif;font-weight:600;margin:0;letter-spacing:-.01em;}
.mx-h1{font-size:clamp(2.6rem,6vw,4.1rem);line-height:1.02;}
.mx-h2{font-size:clamp(1.7rem,3.6vw,2.4rem);}
.mx-sub{color:rgba(48,66,54,.62);margin:.4rem 0 0;font-size:1rem;line-height:1.6;}
.mx-bunny{display:inline-flex;flex-shrink:0;}
.mx-bunny svg{width:100%;height:100%;display:block;}

/* nav */
.mx-nav{position:sticky;top:0;z-index:40;display:flex;align-items:center;gap:1.5rem;padding:.85rem clamp(1rem,4vw,2.5rem);
  background:rgba(252,251,247,.85);backdrop-filter:blur(10px);border-bottom:1px solid rgba(48,66,54,.07);}
.mx-logo{display:flex;align-items:center;gap:.5rem;}
.mx-word{font-family:'Fraunces',serif;font-size:1.4rem;font-weight:600;}
.mx-word em{font-style:italic;color:var(--matcha);}
.mx-bar{font-size:.68rem;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:var(--brown);background:var(--beige);padding:.18rem .45rem;border-radius:6px;align-self:center;}
.mx-navlinks{display:flex;gap:.35rem;margin-left:auto;}
.mx-navlink{padding:.5rem .85rem;border-radius:999px;font-size:.92rem;font-weight:500;color:rgba(48,66,54,.65);transition:all .2s;}
.mx-navlink:hover{color:var(--dark);background:var(--cream);}
.mx-navlink.active{color:var(--matcha);background:var(--lightM);}
.mx-cartbtn{position:relative;width:42px;height:42px;border-radius:50%;background:var(--cream);display:grid;place-items:center;transition:all .2s;}
.mx-cartbtn:hover{background:var(--lightM);transform:translateY(-1px);}
.mx-cartcount{position:absolute;top:-3px;right:-3px;min-width:19px;height:19px;padding:0 5px;border-radius:999px;background:var(--matcha);color:#fff;font-size:.68rem;font-weight:600;display:grid;place-items:center;}

.mx-main{max-width:1180px;margin:0 auto;padding:clamp(1.2rem,4vw,3rem) clamp(1rem,4vw,2.5rem) 3rem;}

/* buttons */
.mx-btn{display:inline-flex;align-items:center;justify-content:center;gap:.5rem;font-weight:600;font-size:.95rem;padding:.8rem 1.35rem;border-radius:999px;transition:transform .18s ease,box-shadow .2s,background .2s;white-space:nowrap;}
.mx-btn:active{transform:scale(.97);}
.mx-btn-primary{background:var(--matcha);color:#fff;box-shadow:0 6px 16px rgba(111,143,98,.28);}
.mx-btn-primary:hover{transform:translateY(-2px);box-shadow:0 10px 22px rgba(111,143,98,.34);}
.mx-btn-primary:disabled{opacity:.45;box-shadow:none;transform:none;cursor:not-allowed;}
.mx-btn-ghost{background:var(--warm);border:1.5px solid rgba(48,66,54,.14);color:var(--dark);}
.mx-btn-ghost:hover{border-color:var(--matcha);color:var(--matcha);}
.mx-btn-soft{background:var(--lightM);color:var(--matcha);padding:.6rem 1.1rem;font-size:.9rem;}
.mx-btn-soft:hover{background:var(--sage);color:#fff;}
.mx-iconbtn{width:38px;height:38px;padding:0;border-radius:50%;display:grid;place-items:center;}

.mx-card{background:var(--warm);border:1px solid rgba(48,66,54,.08);border-radius:22px;box-shadow:0 2px 14px rgba(48,66,54,.04);}

/* photo frame */
.mx-photo{border-radius:26px;overflow:hidden;box-shadow:0 20px 50px rgba(48,66,54,.14);border:6px solid var(--warm);background:var(--cream);}
.mx-photo img{display:block;width:100%;height:100%;object-fit:cover;}

/* stickers */
.mx-sticker{position:absolute;pointer-events:none;filter:drop-shadow(0 8px 14px rgba(48,66,54,.20));z-index:4;}
.mx-sticker.float{animation:mx-bob 5s ease-in-out infinite;}
@keyframes mx-bob{0%,100%{transform:translateY(0) rotate(-2deg);}50%{transform:translateY(-10px) rotate(2deg);}}

/* hero */
.mx-hero{display:grid;grid-template-columns:1.05fr .95fr;gap:2rem;align-items:center;padding:1.5rem 0 3.5rem;}
.mx-eyebrow{display:inline-flex;align-items:center;gap:.4rem;font-size:.8rem;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:var(--matcha);background:var(--lightM);padding:.4rem .8rem;border-radius:999px;margin-bottom:1.2rem;}
.mx-lead{font-size:1.12rem;line-height:1.6;color:rgba(48,66,54,.7);max-width:30rem;margin:1.2rem 0 1.8rem;}
.mx-herobtns{display:flex;gap:.8rem;flex-wrap:wrap;}
.mx-hero-art{position:relative;display:grid;place-items:center;min-height:400px;}
.mx-blob{position:absolute;border-radius:50%;filter:blur(8px);z-index:0;}
.mx-blob-1{width:280px;height:280px;background:var(--lightM);top:6%;left:8%;}
.mx-blob-2{width:150px;height:150px;background:var(--beige);bottom:6%;right:8%;}
.mx-hero-photo{position:relative;z-index:1;width:min(360px,80%);aspect-ratio:4/5;}
.mx-hero-sticker{width:150px;bottom:-14px;left:2%;}
.mx-floatleaf{position:absolute;z-index:2;opacity:.75;animation:mx-float 6s ease-in-out infinite;}
.mx-fl-1{top:4%;right:14%;}
.mx-fl-2{bottom:16%;right:6%;animation-delay:-2s;}
@keyframes mx-float{0%,100%{transform:translateY(0) rotate(-4deg);}50%{transform:translateY(-14px) rotate(6deg);}}

.mx-sec-head{text-align:center;margin:1rem 0 2rem;}

/* presets */
.mx-presetgrid,.mx-menugrid{display:grid;grid-template-columns:repeat(4,1fr);gap:1.2rem;}
.mx-presetcard{padding:1.4rem 1.2rem;text-align:center;display:flex;flex-direction:column;align-items:center;transition:transform .2s,box-shadow .2s;}
.mx-presetcard:hover,.mx-menucard:hover{transform:translateY(-4px);box-shadow:0 14px 30px rgba(48,66,54,.09);}
.mx-preset-name{font-family:'Fraunces',serif;font-size:1.2rem;margin-top:.6rem;}
.mx-preset-tag{font-size:.85rem;color:var(--brown);margin-bottom:.7rem;}
.mx-preset-list{list-style:none;padding:0;margin:0 0 1rem;font-size:.82rem;color:rgba(48,66,54,.62);line-height:1.7;}
.mx-preset-list li::before{content:"·";color:var(--sage);margin-right:.4rem;}

/* story + cloud bands */
.mx-story,.mx-cloud{display:grid;grid-template-columns:1fr 1fr;gap:2.4rem;align-items:center;margin:4.5rem 0;}
.mx-story .mx-photo{aspect-ratio:1/1;}
.mx-cloud{background:var(--cream);border-radius:30px;padding:2.6rem;position:relative;overflow:visible;}
.mx-cloud .mx-photo{aspect-ratio:5/4;}
.mx-cloud-copy .mx-sub,.mx-story-copy .mx-sub{max-width:26rem;}
.mx-cloud-copy .mx-btn,.mx-story-copy .mx-btn{margin-top:1.4rem;}
.mx-cloud-sticker{width:120px;top:-46px;right:8%;}

/* menu */
.mx-menucard{padding:1.3rem;display:flex;flex-direction:column;transition:transform .2s,box-shadow .2s;}
.mx-menuart{background:var(--cream);border-radius:16px;padding:1rem;margin-bottom:1rem;}
.mx-menu-name{font-family:'Fraunces',serif;font-size:1.22rem;}
.mx-menu-desc{font-size:.88rem;color:rgba(48,66,54,.62);line-height:1.5;margin:.4rem 0 1rem;flex:1;}
.mx-menu-foot{display:flex;align-items:center;justify-content:space-between;gap:.5rem;}
.mx-from{font-weight:600;font-size:.95rem;}

/* build */
.mx-steprail{display:flex;gap:.5rem;overflow-x:auto;padding-bottom:.4rem;margin-bottom:1.5rem;}
.mx-steppill{display:flex;align-items:center;gap:.5rem;padding:.5rem .9rem;border-radius:999px;background:var(--cream);font-size:.88rem;font-weight:500;color:rgba(48,66,54,.7);white-space:nowrap;transition:all .2s;}
.mx-steppill:hover{background:var(--lightM);color:var(--matcha);}
.mx-stepnum{width:22px;height:22px;border-radius:50%;background:var(--warm);color:var(--matcha);font-size:.75rem;font-weight:700;display:grid;place-items:center;}
.mx-buildgrid{display:grid;grid-template-columns:minmax(300px,380px) 1fr;gap:1.5rem;align-items:start;}
.mx-left{position:sticky;top:80px;display:flex;flex-direction:column;gap:1.2rem;}
.mx-previewcard{padding:1.5rem;background:var(--cream);}
.mx-right{display:flex;flex-direction:column;gap:1.2rem;}
.mx-step{padding:1.5rem;}
.mx-step-head{display:flex;align-items:center;gap:.7rem;margin-bottom:1.2rem;}
.mx-step-head h3{font-size:1.3rem;}
.mx-step-badge{width:28px;height:28px;border-radius:50%;background:var(--lightM);color:var(--matcha);font-weight:700;font-size:.85rem;display:grid;place-items:center;flex-shrink:0;}

/* options */
.mx-optgrid{display:grid;grid-template-columns:1fr 1fr;gap:.8rem;}
.mx-milkgrid{grid-template-columns:1fr 1fr 1fr;}
.mx-opt{position:relative;text-align:left;padding:1rem;border-radius:16px;border:1.5px solid rgba(48,66,54,.1);background:var(--warm);display:flex;flex-direction:column;gap:.35rem;transition:transform .16s,border-color .2s,background .2s;}
.mx-opt:hover{transform:scale(1.02);border-color:var(--sage);}
.mx-opt.sel{border-color:var(--matcha);background:var(--lightM);}
.mx-tick{position:absolute;top:.7rem;right:.7rem;width:20px;height:20px;border-radius:50%;background:var(--matcha);color:#fff;display:grid;place-items:center;}
.mx-leaves{display:flex;gap:2px;}
.mx-opt-title{font-weight:600;font-size:1rem;}
.mx-opt-desc{font-size:.8rem;color:rgba(48,66,54,.58);line-height:1.35;}
.mx-milk{align-items:flex-start;}
.mx-milkdot{width:26px;height:26px;border-radius:50%;background:linear-gradient(135deg,var(--cream),var(--beige));border:1px solid rgba(48,66,54,.12);}
.mx-price-tag{font-size:.8rem;font-weight:600;color:var(--brown);}
.mx-opt.sel .mx-price-tag{color:var(--matcha);}

/* segmented */
.mx-segwrap{display:flex;gap:.5rem;background:var(--cream);padding:.4rem;border-radius:16px;}
.mx-seg{flex:1;padding:.7rem .4rem;border-radius:12px;display:flex;flex-direction:column;align-items:center;gap:.2rem;transition:all .2s;}
.mx-seg:hover{background:var(--warm);}
.mx-seg.sel{background:var(--matcha);color:#fff;box-shadow:0 4px 12px rgba(111,143,98,.25);}
.mx-seg-num{font-weight:700;font-size:.95rem;}
.mx-seg-lab{font-size:.72rem;opacity:.85;text-align:center;}
.mx-helper{font-size:.85rem;color:var(--brown);font-style:italic;margin:.9rem 0 0;}
.mx-icewrap .mx-iceseg{gap:.4rem;}
.mx-icecubes{display:flex;gap:2px;}
.mx-icecube{width:7px;height:7px;border-radius:2px;background:currentColor;transition:opacity .2s;}
.mx-iceseg{color:var(--sage);} .mx-iceseg.sel{color:#fff;}
.mx-iceseg .mx-seg-lab{color:var(--dark);} .mx-iceseg.sel .mx-seg-lab{color:#fff;}

/* summary */
.mx-summary{background:var(--warm);border:1px solid rgba(48,66,54,.08);border-radius:22px;padding:1.4rem;box-shadow:0 2px 14px rgba(48,66,54,.04);}
.mx-sum-name{font-family:'Fraunces',serif;font-size:1.3rem;margin-bottom:.8rem;}
.mx-chips{display:flex;flex-wrap:wrap;gap:.4rem;margin-bottom:1.1rem;}
.mx-chip{font-size:.78rem;padding:.3rem .7rem;border-radius:999px;background:var(--cream);color:rgba(48,66,54,.75);}
.mx-addbtn{width:100%;}
.mx-saverow{display:flex;gap:.5rem;margin-top:.7rem;}
.mx-input{flex:1;padding:.65rem .9rem;border-radius:12px;border:1.5px solid rgba(48,66,54,.12);background:var(--cream);font-family:inherit;font-size:.9rem;color:var(--dark);}
.mx-input:focus{outline:none;border-color:var(--matcha);}

.mx-mobilebar{display:none;}

/* cart */
.mx-overlay{position:fixed;inset:0;background:rgba(48,66,54,.35);opacity:0;pointer-events:none;transition:opacity .3s;z-index:50;}
.mx-overlay.show{opacity:1;pointer-events:auto;}
.mx-cart{position:fixed;top:0;right:0;height:100%;width:min(420px,92vw);background:var(--warm);z-index:60;transform:translateX(105%);transition:transform .35s cubic-bezier(.4,0,.2,1);display:flex;flex-direction:column;box-shadow:-8px 0 40px rgba(48,66,54,.15);}
.mx-cart.open{transform:translateX(0);}
.mx-cart-head{display:flex;align-items:center;justify-content:space-between;padding:1.3rem 1.5rem;border-bottom:1px solid rgba(48,66,54,.08);}
.mx-cart-head h3{font-size:1.4rem;}
.mx-cart-body{flex:1;overflow-y:auto;padding:1.2rem 1.5rem;display:flex;flex-direction:column;gap:1rem;}
.mx-cart-empty{position:relative;text-align:center;color:rgba(48,66,54,.55);margin-top:3rem;padding-top:120px;}
.mx-cart-emptysticker{position:relative;width:130px;margin:0 auto 1rem;display:block;}
.mx-cartitem{position:relative;display:flex;gap:.8rem;background:var(--cream);border-radius:16px;padding:.9rem;}
.mx-cartprev{flex-shrink:0;width:70px;}
.mx-cartinfo{flex:1;min-width:0;}
.mx-cartname{font-weight:600;font-size:.98rem;}
.mx-cartcustom{font-size:.76rem;color:rgba(48,66,54,.6);line-height:1.4;margin:.2rem 0 .6rem;}
.mx-cartfoot{display:flex;align-items:center;justify-content:space-between;}
.mx-qty{display:flex;align-items:center;gap:.6rem;background:var(--warm);border-radius:999px;padding:.25rem;}
.mx-qty button{width:26px;height:26px;border-radius:50%;background:var(--lightM);color:var(--matcha);display:grid;place-items:center;}
.mx-qty span{font-weight:600;font-size:.9rem;min-width:14px;text-align:center;}
.mx-cartprice{font-weight:700;font-size:.95rem;}
.mx-cartx{position:absolute;top:.6rem;right:.6rem;width:24px;height:24px;border-radius:50%;color:rgba(48,66,54,.4);display:grid;place-items:center;}
.mx-cartx:hover{color:var(--matcha);background:var(--warm);}
.mx-cart-footer{padding:1.3rem 1.5rem;border-top:1px solid rgba(48,66,54,.08);display:flex;flex-direction:column;gap:.6rem;}
.mx-cart-field{padding:.65rem .85rem;border-radius:12px;border:1.5px solid rgba(48,66,54,.14);background:var(--cream);font-family:inherit;font-size:.88rem;color:var(--dark);}
.mx-cart-field:focus{outline:none;border-color:var(--matcha);}
.mx-subtotal{display:flex;justify-content:space-between;font-size:1.1rem;font-weight:700;margin-bottom:.4rem;}

/* misc */
.mx-empty{position:relative;text-align:center;padding:3rem 1rem 5rem;display:flex;flex-direction:column;align-items:center;gap:.6rem;}
.mx-empty-sticker{position:relative;width:170px;margin-bottom:.5rem;}
.mx-footer{max-width:1180px;margin:0 auto;padding:2rem clamp(1rem,4vw,2.5rem);display:flex;justify-content:space-between;align-items:center;font-size:.82rem;color:rgba(48,66,54,.5);border-top:1px solid rgba(48,66,54,.07);flex-wrap:wrap;gap:.5rem;}
.mx-foot-brand{display:inline-flex;align-items:center;gap:.5rem;font-family:'Fraunces',serif;font-size:1rem;color:var(--dark);}
.mx-toast{position:fixed;bottom:1.5rem;left:50%;transform:translateX(-50%);background:var(--dark);color:var(--cream);padding:.8rem 1.4rem;border-radius:999px;font-size:.9rem;font-weight:500;z-index:80;box-shadow:0 8px 24px rgba(48,66,54,.25);animation:mx-pop .3s ease;}
@keyframes mx-pop{from{opacity:0;transform:translateX(-50%) translateY(10px);}to{opacity:1;transform:translateX(-50%) translateY(0);}}
.mx-liquid,.mx-foam{transition:fill .45s ease;}
.mx-authchip{font-size:.85rem;font-weight:600;color:var(--dark);background:var(--cream);border:1.5px solid rgba(48,66,54,.14);padding:.45rem .85rem;border-radius:999px;transition:all .2s;}
.mx-authchip:hover{border-color:var(--matcha);color:var(--matcha);}

/* responsive */
@media(max-width:900px){
  .mx-navlinks{display:none;}
  .mx-hero{grid-template-columns:1fr;text-align:center;}
  .mx-hero-copy{order:2;} .mx-hero-art{order:1;min-height:360px;}
  .mx-eyebrow{margin-inline:auto;} .mx-lead{margin-inline:auto;} .mx-herobtns{justify-content:center;}
  .mx-presetgrid,.mx-menugrid{grid-template-columns:1fr 1fr;}
  .mx-story,.mx-cloud{grid-template-columns:1fr;gap:1.6rem;text-align:center;}
  .mx-story .mx-photo{order:2;} .mx-cloud .mx-photo{order:2;}
  .mx-story-copy .mx-eyebrow,.mx-cloud-copy .mx-eyebrow{margin-inline:auto;}
  .mx-story-copy .mx-sub,.mx-cloud-copy .mx-sub{margin-inline:auto;}
  .mx-cloud-sticker{width:90px;top:-34px;right:4%;}
  .mx-buildgrid{grid-template-columns:1fr;}
  .mx-left{position:static;} .mx-hide-mobile{display:none;}
  .mx-mobilebar{display:flex;position:sticky;bottom:0;z-index:30;align-items:center;justify-content:space-between;gap:1rem;background:rgba(252,251,247,.95);backdrop-filter:blur(10px);border-top:1px solid rgba(48,66,54,.1);padding:.85rem 1.1rem;margin:1.2rem -1rem -1rem;border-radius:18px 18px 0 0;}
  .mx-mb-name{font-size:.82rem;color:rgba(48,66,54,.6);}
  .mx-mb-price{font-size:1.2rem;font-weight:700;}
}
@media(max-width:560px){
  .mx-presetgrid,.mx-menugrid{grid-template-columns:1fr;}
  .mx-optgrid,.mx-milkgrid{grid-template-columns:1fr 1fr;}
  .mx-segwrap{flex-wrap:wrap;} .mx-seg{min-width:calc(33% - .4rem);}
}
@media(prefers-reduced-motion:reduce){
  .mx-root *,.mx-liquid,.mx-foam,.mx-floatleaf,.mx-sticker{transition:none !important;animation:none !important;}
}
`;
