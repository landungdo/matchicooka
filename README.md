# matchicooka 🍵

A cute matcha-café ordering web app: customers build custom drinks, place orders, chat with the shop, and track order status in real time; the owner runs everything from a single dashboard (live orders, messages, shop status, and analytics). Bilingual **EN / VI**.

**Live:** https://matchicooka.vercel.app

---

## Stack

- **Frontend:** Vite + React (no CSS framework — scoped inline styles), `lucide-react` icons
- **Backend:** Supabase (Postgres + Auth + Row Level Security + Realtime)
- **Auth email:** custom SMTP (Gmail / Resend)
- **Hosting:** Vercel (auto-deploys from `main`)

---

## Features

**Customer**
- Build a drink (strength, sweetness, milk, ice, extras) with a live SVG preview
- Cart + saved recipes persist across refreshes (localStorage)
- Checkout with phone + note; server-side pricing; idempotent order creation
- Order confirmation with code (`D14-0007`) and ETA
- **My Orders** — realtime status (Received → Making → Ready → Picked up), cancel, reorder
- Per-item **star reviews** after pickup
- Realtime **chat** with the shop
- Live **shop status** badge (Open / Busy / Closed + prep estimate)

**Owner** (role-gated)
- Realtime orders board with state-machine transitions + cancel reason
- New-order alert (toast + sound + badge) even when the dashboard is closed
- Search / filter orders; masked customer phone
- Realtime customer chat
- Shop status control + per-product sold-out toggles
- **Insights** tab: revenue, orders by hour, top drinks, prep time, ratings

---

## Local setup

```bash
npm install
# create .env.local (see below)
npm run dev        # http://localhost:5173
```

`.env.local`:

```
VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR-ANON-KEY
```

The same two variables must be set in **Vercel → Settings → Environment Variables** (Production + Preview).

---

## Database setup (fresh Supabase project)

Run the files in `supabase/migrations/` **in order**, in the Supabase SQL Editor:

| # | File | What it creates |
|---|------|-----------------|
| 0001 | `0001_init.sql` | profiles, auth trigger, `is_owner()`, messages, RLS, realtime |
| 0002 | `0002_orders.sql` | orders, order_items, reviews, order-code generator, analytics views |
| 0003 | `0003_menu.sql` | menu tables + prices + availability (source of truth for pricing) |
| 0004 | `0004_shop_status.sql` | shop status + prep-time estimate |
| 0005 | `0005_functions.sql` | RPCs: `place_order`, `transition_order_status`, `submit_review`, `cancel_my_order` + grants |
| 0006 | `0006_seed_owner.sql` | promote one account to `owner` (edit the email; sign up first) |

Notes:
- All order writes go through **`place_order`** (server computes prices, atomic, idempotent). Clients cannot insert/update orders directly.
- Status changes go through **`transition_order_status`** (owner-only state machine).
- Every `SECURITY DEFINER` function is revoked from `public`/`anon` and granted to `authenticated` only.

### Auth email

Supabase → Authentication → set **Site URL** to your deployed URL, add it to **Redirect URLs**, and configure **Custom SMTP** (Gmail app password or Resend). Without a verified domain, test with the account tied to the mail provider.

---

## Deploy

Push to `main`; Vercel builds and deploys automatically. SQL migrations are **not** run by the deploy — apply them in Supabase yourself.

---

## Project layout

```
src/
  App.jsx                 root: providers, order placement, notifications
  Storefront.jsx          storefront (hero, menu, builder, cart, saved)
  data/            menu.js, assets.js
  lib/             supabase.js, AuthContext.jsx, i18n.jsx, time.js
  components/      AuthModal, ChatDock, MessageList, MyOrders, OrderConfirm,
                   OwnerDashboard, ShopStatusBadge, ShopStatusControl,
                   StarRating, Analytics
supabase/migrations/      0001 … 0006 (run in order)
```
