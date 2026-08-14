// Time helpers, all rendered in Vietnam timezone (UTC+7).
const TZ = "Asia/Ho_Chi_Minh";

export const timeLabel = (iso) =>
  new Date(iso).toLocaleTimeString("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });

export const dateTimeLabel = (iso) =>
  new Date(iso).toLocaleString("en-GB", { timeZone: TZ, day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

const ymd = (d) => d.toLocaleDateString("en-CA", { timeZone: TZ }); // yyyy-mm-dd in VN time

export function dayLabel(iso) {
  const d = new Date(iso);
  const now = new Date();
  const yest = new Date(now);
  yest.setDate(now.getDate() - 1);
  const dd = ymd(d);
  if (dd === ymd(now)) return "Today";
  if (dd === ymd(yest)) return "Yesterday";
  return d.toLocaleDateString("en-GB", { timeZone: TZ, day: "2-digit", month: "short", year: "numeric" });
}
