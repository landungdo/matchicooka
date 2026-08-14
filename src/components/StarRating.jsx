import { useState } from "react";
import { Star } from "lucide-react";

// value: current rating (0-5). onChange(n). readOnly for display only.
export default function StarRating({ value = 0, onChange, size = 24, readOnly = false }) {
  const [hover, setHover] = useState(0);
  const shown = hover || value;
  return (
    <span className="sr-wrap" onMouseLeave={() => setHover(0)}>
      {[1, 2, 3, 4, 5].map((n) => {
        const on = shown >= n;
        return (
          <button
            key={n}
            type="button"
            className={"sr-star" + (readOnly ? " ro" : "")}
            aria-label={`${n} star${n > 1 ? "s" : ""}`}
            onMouseEnter={() => !readOnly && setHover(n)}
            onClick={() => !readOnly && onChange && onChange(n)}
            disabled={readOnly}
          >
            <Star size={size} fill={on ? "#E8B84B" : "none"} color={on ? "#E8B84B" : "#cfd6cb"} strokeWidth={1.6} />
          </button>
        );
      })}
      <style>{`
        .sr-wrap{display:inline-flex;gap:2px;}
        .sr-star{border:none;background:none;padding:1px;cursor:pointer;line-height:0;transition:transform .12s;}
        .sr-star:hover{transform:scale(1.15);}
        .sr-star.ro{cursor:default;}
        .sr-star.ro:hover{transform:none;}
      `}</style>
    </span>
  );
}
