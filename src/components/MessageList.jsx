import { Fragment } from "react";
import { dayLabel, timeLabel } from "../lib/time.js";

// msgs: array of { id, body, sender_role, created_at }
// mineRole: which sender_role counts as "me" (right side)
export default function MessageList({ msgs, mineRole }) {
  let lastDay = null;
  return (
    <>
      {msgs.map((m) => {
        const d = dayLabel(m.created_at);
        const sep = d !== lastDay ? d : null;
        lastDay = d;
        const mine = m.sender_role === mineRole;
        return (
          <Fragment key={m.id}>
            {sep && <div className="ml-day"><span>{sep}</span></div>}
            <div className={"ml-row " + (mine ? "me" : "other")}>
              <div className="ml-bubble">
                {m.body}
                <span className="ml-time">{timeLabel(m.created_at)}</span>
              </div>
            </div>
          </Fragment>
        );
      })}
      <style>{`
        .ml-day{text-align:center;margin:.6rem 0 .4rem;}
        .ml-day span{font-size:.7rem;font-weight:600;color:#8a988a;background:rgba(48,66,54,.06);padding:.22rem .7rem;border-radius:999px;}
        .ml-row{display:flex;margin-bottom:.35rem;}
        .ml-row.me{justify-content:flex-end;}
        .ml-bubble{max-width:80%;padding:.55rem .8rem .7rem;border-radius:16px;font-size:.9rem;line-height:1.4;word-break:break-word;}
        .ml-row.me .ml-bubble{background:#6F8F62;color:#fff;border-bottom-right-radius:5px;}
        .ml-row.other .ml-bubble{background:#F0EBDF;color:#304236;border-bottom-left-radius:5px;}
        .ml-time{display:block;font-size:.6rem;opacity:.65;margin-top:.25rem;text-align:right;}
      `}</style>
    </>
  );
}
