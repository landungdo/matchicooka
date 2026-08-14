// Shared product config + helpers (mirrors the constants inside Storefront.jsx).
// Keep these in sync with Storefront if you ever change prices/options.

export const STRENGTHS = [
  { id: "light", label: "Light" },
  { id: "regular", label: "Regular" },
  { id: "strong", label: "Strong" },
  { id: "extraStrong", label: "Extra Strong" },
];
export const SWEET_LABEL = { 0: "No Sugar", 25: "Less Sweet", 50: "Balanced", 75: "Sweet", 100: "Extra Sweet" };
export const MILKS = [
  { id: "fresh", label: "Fresh Milk", price: 0 },
  { id: "oat", label: "Oat Milk", price: 10000 },
  { id: "soy", label: "Soy Milk", price: 8000 },
  { id: "almond", label: "Almond Milk", price: 12000 },
  { id: "coconut", label: "Coconut Milk", price: 10000 },
];
export const ICES = [
  { id: "none", label: "No Ice" }, { id: "less", label: "Less Ice" },
  { id: "regular", label: "Regular Ice" }, { id: "extra", label: "Extra Ice" },
];
export const EXTRAS = [
  { id: "matchaFoam", label: "Matcha Foam", price: 10000 },
  { id: "creamCheeseFoam", label: "Cream Cheese Foam", price: 12000 },
  { id: "redBean", label: "Red Bean", price: 8000 },
  { id: "brownSugarJelly", label: "Brown Sugar Jelly", price: 8000 },
  { id: "extraShot", label: "Extra Matcha Shot", price: 12000 },
];
export const PRODUCTS = [
  { id: "classic", name: "Classic Matcha Latte", base: 55000 },
  { id: "strawberry", name: "Strawberry Matcha", base: 60000 },
  { id: "coconut", name: "Coconut Matcha", base: 62000 },
  { id: "cloud", name: "Matcha Cloud", base: 65000 },
  { id: "dirty", name: "Dirty Matcha", base: 68000 },
  { id: "espresso", name: "Matcha Espresso", base: 66000 },
  { id: "strawcloud", name: "Matcha Strawberry Cloud", base: 70000 },
];

export const findP = (id) => PRODUCTS.find((p) => p.id === id) || PRODUCTS[0];
export const vnd = (n) => (n || 0).toLocaleString("vi-VN") + "đ";

export function summaryLines(cfg) {
  if (!cfg) return [];
  const out = [
    (STRENGTHS.find((s) => s.id === cfg.strength)?.label || "") + " Matcha",
    cfg.sweetness + "% · " + (SWEET_LABEL[cfg.sweetness] || ""),
    MILKS.find((m) => m.id === cfg.milk)?.label,
    ICES.find((i) => i.id === cfg.ice)?.label,
  ];
  (cfg.extras || []).forEach((e) => out.push(EXTRAS.find((x) => x.id === e)?.label));
  return out.filter(Boolean);
}
