import { useState, useEffect, useRef, useCallback } from "react";

// ─────────────────────────────────────────────
// DESIGN TOKENS — Notion/Linear inspired
// ─────────────────────────────────────────────
const C = {
  // Backgrounds
  bg:        "#0d0d0d",
  bgSub:     "#111111",
  surface:   "#161616",
  surfaceHi: "#1a1a1a",
  hover:     "#1e1e1e",

  // Borders
  border:    "#2a2a2a",
  borderHi:  "#333333",

  // Text
  text:      "#e8e8e8",
  textSub:   "#a0a0a0",
  textDim:   "#555555",

  // Accent — single, restrained
  accent:    "#4f7fff",
  accentSub: "rgba(79,127,255,0.12)",
  accentBdr: "rgba(79,127,255,0.3)",

  // Status
  green:     "#3ecf8e",
  greenSub:  "rgba(62,207,142,0.1)",
  yellow:    "#e8b04a",
  yellowSub: "rgba(232,176,74,0.1)",
  red:       "#e05c5c",
  redSub:    "rgba(224,92,92,0.1)",
  blue:      "#4f7fff",
  blueSub:   "rgba(79,127,255,0.1)",
};

// ─────────────────────────────────────────────
// CURRENCIES
// ─────────────────────────────────────────────
const CURRENCIES = {
  USD:{ symbol:"$",   locale:"en-US" },
  EUR:{ symbol:"€",   locale:"de-DE" },
  GBP:{ symbol:"£",   locale:"en-GB" },
  BDT:{ symbol:"৳",   locale:"en-US" },
  INR:{ symbol:"₹",   locale:"en-IN" },
  CAD:{ symbol:"CA$", locale:"en-CA" },
  AUD:{ symbol:"A$",  locale:"en-AU" },
  JPY:{ symbol:"¥",   locale:"ja-JP" },
  SGD:{ symbol:"S$",  locale:"en-SG" },
};

// ─────────────────────────────────────────────
// UTILS
// ─────────────────────────────────────────────
const money = (n, cur = "USD") => {
  const cfg = CURRENCIES[cur] || CURRENCIES.USD;
  const num = isFinite(+n) ? +n : 0;
  try {
    return new Intl.NumberFormat(cfg.locale, {
      style: "currency", currency: cur,
      minimumFractionDigits: cur === "JPY" ? 0 : 2,
      maximumFractionDigits: cur === "JPY" ? 0 : 2,
    }).format(num);
  } catch { return `${cfg.symbol}${num.toFixed(2)}`; }
};
const r2       = n => Math.round((n + Number.EPSILON) * 100) / 100;
const today    = () => new Date().toISOString().slice(0, 10);
const due30    = d => { const dt = new Date(d + "T00:00:00Z"); dt.setUTCDate(dt.getUTCDate() + 30); return dt.toISOString().slice(0, 10); };
const uid      = () => Math.random().toString(36).slice(2, 9);
const newItem  = () => ({ id: uid(), desc: "", qty: "1", rate: "" });
const ls = {
  get: (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};
const nextNum = invs => {
  const max = invs.reduce((m, i) => Math.max(m, parseInt(i.num?.replace(/\D/g, "") || "0")), 0);
  return `INV-${String(max + 1).padStart(4, "0")}`;
};
const calcTotals = (items, discount, tax) => {
  const sub  = r2(items.reduce((s, it) => s + r2((+it.qty || 0) * (+it.rate || 0)), 0));
  const disc = r2(sub * Math.min(Math.max(+discount || 0, 0), 100) / 100);
  const after = r2(sub - disc);
  const taxAmt = r2(after * Math.min(Math.max(+tax || 0, 0), 100) / 100);
  return { sub, disc, after, taxAmt, total: r2(after + taxAmt) };
};

// ─────────────────────────────────────────────
// STATUS CONFIG
// ─────────────────────────────────────────────
const STATUS = {
  Draft:   { bg: C.surface,    color: C.textSub, dot: C.textDim  },
  Sent:    { bg: C.blueSub,    color: C.blue,    dot: C.blue     },
  Paid:    { bg: C.greenSub,   color: C.green,   dot: C.green    },
  Overdue: { bg: C.redSub,     color: C.red,     dot: C.red      },
};

// ─────────────────────────────────────────────
// GLOBAL CSS
// ─────────────────────────────────────────────
const GS = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html { font-size: 14px; }
    body {
      background: ${C.bg};
      color: ${C.text};
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      -webkit-font-smoothing: antialiased;
      line-height: 1.5;
    }
    input, textarea, select, button { font-family: inherit; }
    input[type=number]::-webkit-inner-spin-button { opacity: 0; }
    input[type=number]:hover::-webkit-inner-spin-button { opacity: 0.5; }
    input:focus, textarea:focus, select:focus {
      outline: none !important;
      border-color: ${C.accent} !important;
      box-shadow: 0 0 0 2px ${C.accentSub} !important;
    }
    button { cursor: pointer; }
    button:active { opacity: 0.8; }
    button:disabled { opacity: 0.38; cursor: not-allowed; }
    ::-webkit-scrollbar { width: 4px; height: 4px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: ${C.border}; border-radius: 2px; }
    select option { background: ${C.surface}; color: ${C.text}; }
    @keyframes fadeUp { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:none; } }
    @keyframes spin { to { transform: rotate(360deg); } }
    @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.3} }
    .fade { animation: fadeUp 0.2s ease; }
    .mono { font-family: 'JetBrains Mono', monospace; }
    @media (max-width: 720px) { .desktop-only { display: none !important; } }
    @media (min-width: 721px) { .mobile-only  { display: none !important; } }
  `}</style>
);

// ─────────────────────────────────────────────
// PRIMITIVE COMPONENTS
// ─────────────────────────────────────────────

const Label = ({ children, required }) => (
  <div style={{ fontSize: "11px", fontWeight: 500, color: C.textSub, letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: "6px" }}>
    {children}{required && <span style={{ color: C.red, marginLeft: "3px" }}>*</span>}
  </div>
);

const Field = ({ label, required, error, children, style = {} }) => (
  <div style={{ marginBottom: "16px", ...style }}>
    {label && <Label required={required}>{label}</Label>}
    {children}
    {error && <div style={{ color: C.red, fontSize: "11px", marginTop: "4px" }}>{error}</div>}
  </div>
);

const inputBase = (err) => ({
  width: "100%",
  background: C.surface,
  border: `1px solid ${err ? C.red : C.border}`,
  borderRadius: "6px",
  padding: "9px 11px",
  color: C.text,
  fontSize: "13px",
  transition: "border-color 0.15s, box-shadow 0.15s",
});

const Input = ({ label, required, error, ...p }) => (
  <Field label={label} required={required} error={error}>
    <input style={inputBase(error)} {...p} />
  </Field>
);

const Textarea = ({ label, rows = 3, ...p }) => (
  <Field label={label}>
    <textarea style={{ ...inputBase(false), resize: "vertical", minHeight: rows * 22 + "px" }} rows={rows} {...p} />
  </Field>
);

const SelectField = ({ label, children, style: extStyle = {}, ...p }) => (
  <Field label={label}>
    <select style={{ ...inputBase(false), appearance: "none", ...extStyle }} {...p}>{children}</select>
  </Field>
);

const Button = ({ variant = "default", size = "md", full, style: ext = {}, children, ...p }) => {
  const sizes = { sm: "6px 12px", md: "8px 16px", lg: "10px 20px" };
  const variants = {
    default: { background: C.surface,  color: C.text,    border: `1px solid ${C.border}` },
    primary: { background: C.accent,   color: "#fff",    border: "none" },
    ghost:   { background: "transparent", color: C.textSub, border: "none" },
    danger:  { background: "transparent", color: C.red,   border: `1px solid ${C.redSub}` },
    success: { background: C.green,    color: "#0a0a0a", border: "none" },
  };
  return (
    <button style={{
      ...variants[variant], padding: sizes[size], borderRadius: "6px",
      fontSize: "13px", fontWeight: 500, display: "inline-flex", alignItems: "center",
      justifyContent: "center", gap: "6px", transition: "background 0.15s, opacity 0.15s",
      width: full ? "100%" : "auto", whiteSpace: "nowrap", ...ext,
    }} {...p}>{children}</button>
  );
};

const Badge = ({ status }) => {
  const s = STATUS[status] || STATUS.Draft;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "5px", background: s.bg, color: s.color, borderRadius: "4px", padding: "3px 8px", fontSize: "11px", fontWeight: 500 }}>
      <span style={{ width: "5px", height: "5px", borderRadius: "50%", background: s.dot, flexShrink: 0 }} />
      {status}
    </span>
  );
};

const Divider = ({ my = 20 }) => <div style={{ borderTop: `1px solid ${C.border}`, margin: `${my}px 0` }} />;

const SectionHead = ({ title, right }) => (
  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
    <span style={{ fontSize: "11px", fontWeight: 600, color: C.textSub, letterSpacing: "0.06em", textTransform: "uppercase" }}>{title}</span>
    {right}
  </div>
);

// ─────────────────────────────────────────────
// ITEM ROW
// ─────────────────────────────────────────────
const GRID_COLS = "minmax(0,1fr) 70px 110px 110px 28px";

const ItemRow = ({ item, idx, onChange, onRemove, canRemove, currency }) => {
  const amount = r2((+item.qty || 0) * (+item.rate || 0));
  const inp = (extra = {}) => ({
    ...inputBase(false),
    padding: "7px 9px",
    fontSize: "13px",
    ...extra,
  });
  return (
    <div style={{ display: "grid", gridTemplateColumns: GRID_COLS, gap: "6px", alignItems: "center", marginBottom: "6px" }} className="fade">
      <input style={inp()} value={item.desc} placeholder="Description"
        onChange={e => onChange(idx, "desc", e.target.value)} />
      <input type="number" style={inp({ textAlign: "right", fontFamily: "'JetBrains Mono',monospace" })}
        value={item.qty} min="0.01" step="any"
        onChange={e => onChange(idx, "qty", e.target.value)} />
      <input type="number" style={inp({ textAlign: "right", fontFamily: "'JetBrains Mono',monospace" })}
        value={item.rate} min="0" step="any" placeholder="0.00"
        onChange={e => onChange(idx, "rate", e.target.value)} />
      <div style={{ textAlign: "right", fontSize: "13px", fontFamily: "'JetBrains Mono',monospace", color: amount > 0 ? C.text : C.textDim, padding: "7px 9px", background: C.surface, border: `1px solid ${C.border}`, borderRadius: "6px" }}>
        {money(amount, currency)}
      </div>
      <button type="button" onClick={() => canRemove && onRemove(idx)} disabled={!canRemove}
        style={{ width: "28px", height: "28px", borderRadius: "5px", border: "none", background: "transparent", color: C.textDim, fontSize: "14px", display: "flex", alignItems: "center", justifyContent: "center", transition: "color 0.15s, background 0.15s" }}
        onMouseEnter={e => { e.currentTarget.style.color = C.red; e.currentTarget.style.background = C.redSub; }}
        onMouseLeave={e => { e.currentTarget.style.color = C.textDim; e.currentTarget.style.background = "transparent"; }}>
        ×
      </button>
    </div>
  );
};

// Mobile item card
const ItemCard = ({ item, idx, onChange, onRemove, canRemove, currency }) => {
  const amount = r2((+item.qty || 0) * (+item.rate || 0));
  const inp = (extra = {}) => ({ ...inputBase(false), padding: "8px 10px", fontSize: "13px", ...extra });
  return (
    <div style={{ background: C.surfaceHi, border: `1px solid ${C.border}`, borderRadius: "8px", padding: "12px", marginBottom: "8px" }}>
      <div style={{ display: "flex", gap: "8px", marginBottom: "10px" }}>
        <input style={{ ...inp(), flex: 1 }} value={item.desc} placeholder="Description / Service"
          onChange={e => onChange(idx, "desc", e.target.value)} />
        {canRemove && (
          <button type="button" onClick={() => onRemove(idx)}
            style={{ width: "34px", flexShrink: 0, borderRadius: "6px", border: `1px solid ${C.border}`, background: "transparent", color: C.textDim, fontSize: "16px" }}>
            ×
          </button>
        )}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px" }}>
        {[["QTY", "qty", "1"], ["RATE", "rate", "0.00"], ["AMOUNT", null, null]].map(([lbl, key, ph]) => (
          <div key={lbl}>
            <div style={{ fontSize: "10px", color: C.textDim, marginBottom: "4px", fontWeight: 500 }}>{lbl}</div>
            {key ? (
              <input type="number" style={{ ...inp({ textAlign: "right", fontFamily: "'JetBrains Mono',monospace", width: "100%" }) }}
                value={item[key]} placeholder={ph} min="0" step="any"
                onChange={e => onChange(idx, key, e.target.value)} />
            ) : (
              <div style={{ textAlign: "right", padding: "8px 10px", background: C.surface, border: `1px solid ${C.border}`, borderRadius: "6px", fontFamily: "'JetBrains Mono',monospace", fontSize: "13px", color: C.text }}>
                {money(amount, currency)}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────
// DASHBOARD
// ─────────────────────────────────────────────
const Dashboard = ({ invoices, onCreate, onOpen }) => {
  const paid    = invoices.filter(i => i.status === "Paid");
  const pending = invoices.filter(i => i.status === "Sent");
  const revenue = paid.reduce((s, i) => s + (i.total || 0), 0);
  const sorted  = [...invoices].sort((a, b) => b.updatedAt - a.updatedAt);

  return (
    <div className="fade">
      {/* Stats row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "1px", background: C.border, border: `1px solid ${C.border}`, borderRadius: "8px", overflow: "hidden", marginBottom: "24px" }}>
        {[
          { label: "Total",   val: invoices.length,             mono: false, color: C.text   },
          { label: "Paid",    val: paid.length,                  mono: false, color: C.green  },
          { label: "Pending", val: pending.length,               mono: false, color: C.yellow },
          { label: "Revenue", val: money(revenue),               mono: true,  color: C.text   },
        ].map(s => (
          <div key={s.label} style={{ background: C.surface, padding: "18px 20px" }}>
            <div style={{ fontSize: "11px", color: C.textSub, fontWeight: 500, marginBottom: "8px", letterSpacing: "0.04em", textTransform: "uppercase" }}>{s.label}</div>
            <div style={{ fontSize: s.mono ? "18px" : "24px", fontWeight: 600, color: s.color, fontFamily: s.mono ? "'JetBrains Mono',monospace" : "inherit" }}>{s.val}</div>
          </div>
        ))}
      </div>

      {/* Invoice list */}
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: "8px", overflow: "hidden" }}>
        <div style={{ padding: "16px 20px", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: "13px", fontWeight: 500, color: C.text }}>Invoices</span>
          <Button variant="primary" size="sm" onClick={onCreate}>+ New Invoice</Button>
        </div>

        {sorted.length === 0 ? (
          <div style={{ padding: "60px 20px", textAlign: "center" }}>
            <div style={{ fontSize: "32px", marginBottom: "12px", opacity: 0.3 }}>◻</div>
            <div style={{ color: C.textSub, fontSize: "13px", marginBottom: "16px" }}>No invoices yet</div>
            <Button variant="primary" onClick={onCreate}>Create your first invoice</Button>
          </div>
        ) : (
          <>
            {/* Table head */}
            <div className="desktop-only" style={{ display: "grid", gridTemplateColumns: "160px minmax(0,1fr) 140px 110px 90px", gap: "0", borderBottom: `1px solid ${C.border}` }}>
              {[["Invoice #", "left"], ["Client", "left"], ["Date", "left"], ["Amount", "right"], ["Status", "left"]].map(([h, a]) => (
                <div key={h} style={{ padding: "10px 16px", fontSize: "11px", fontWeight: 500, color: C.textDim, textTransform: "uppercase", letterSpacing: "0.04em", textAlign: a }}>{h}</div>
              ))}
            </div>
            {sorted.map((inv, i) => (
              <div key={inv.id} onClick={() => onOpen(inv.id)}
                style={{ display: "grid", gridTemplateColumns: "160px minmax(0,1fr) 140px 110px 90px", gap: "0", borderBottom: i < sorted.length - 1 ? `1px solid ${C.border}` : "none", cursor: "pointer", transition: "background 0.1s" }}
                className="desktop-only"
                onMouseEnter={e => e.currentTarget.style.background = C.hover}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                <div style={{ padding: "13px 16px", fontFamily: "'JetBrains Mono',monospace", fontSize: "12px", color: C.accent, fontWeight: 500 }}>{inv.num}</div>
                <div style={{ padding: "13px 16px", fontSize: "13px", color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{inv.toName || <span style={{ color: C.textDim }}>No client</span>}</div>
                <div style={{ padding: "13px 16px", fontSize: "12px", color: C.textSub, fontFamily: "'JetBrains Mono',monospace" }}>{inv.date}</div>
                <div style={{ padding: "13px 16px", fontSize: "13px", fontFamily: "'JetBrains Mono',monospace", fontWeight: 500, textAlign: "right" }}>{money(inv.total || 0, inv.currency)}</div>
                <div style={{ padding: "13px 16px" }}><Badge status={inv.status} /></div>
              </div>
            ))}
            {/* Mobile list */}
            <div className="mobile-only">
              {sorted.map((inv, i) => (
                <div key={inv.id} onClick={() => onOpen(inv.id)}
                  style={{ padding: "14px 16px", borderBottom: i < sorted.length - 1 ? `1px solid ${C.border}` : "none", cursor: "pointer" }}
                  onMouseEnter={e => e.currentTarget.style.background = C.hover}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "6px" }}>
                    <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "12px", color: C.accent, fontWeight: 500 }}>{inv.num}</span>
                    <Badge status={inv.status} />
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: "13px", color: inv.toName ? C.text : C.textDim }}>{inv.toName || "No client"}</span>
                    <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "13px", fontWeight: 500 }}>{money(inv.total || 0, inv.currency)}</span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────
// INVOICE PRINT TEMPLATE
// ─────────────────────────────────────────────
const PrintTemplate = React.forwardRef(({ form, items, totals }, ref) => {
  const { sub, disc, taxAmt, total } = totals;
  return (
    <div ref={ref} style={{ background: "#fff", color: "#111", fontFamily: "'Inter',sans-serif", fontSize: "12px", lineHeight: "1.6", padding: "40px" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "32px" }}>
        <div>
          <div style={{ fontSize: "28px", fontWeight: 700, color: "#111", letterSpacing: "-0.02em", marginBottom: "4px" }}>Invoice</div>
          <div style={{ fontFamily: "monospace", fontSize: "13px", color: "#666", fontWeight: 500 }}>{form.num}</div>
        </div>
        <div style={{ textAlign: "right", fontSize: "11px", color: "#555", lineHeight: "1.9" }}>
          <div><strong style={{ color: "#111" }}>Date</strong>&nbsp;&nbsp;{form.date}</div>
          <div><strong style={{ color: "#111" }}>Due</strong>&nbsp;&nbsp;&nbsp;{form.dueDate || "—"}</div>
          <div style={{ marginTop: "6px" }}>
            <span style={{ background: form.status === "Paid" ? "#e6faf3" : "#f0f0f0", color: form.status === "Paid" ? "#1a8a5a" : "#555", borderRadius: "3px", padding: "2px 8px", fontSize: "10px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>{form.status}</span>
          </div>
        </div>
      </div>

      {/* From / To */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "32px", marginBottom: "28px", paddingBottom: "28px", borderBottom: "1px solid #e8e8e8" }}>
        {[["From", form.fromName, form.fromEmail, form.fromPhone, form.fromAddress],
          ["Bill To", form.toName, form.toEmail, form.toPhone, form.toAddress]].map(([lbl, name, email, phone, addr]) => (
          <div key={lbl}>
            <div style={{ fontSize: "10px", fontWeight: 600, color: "#999", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: "8px" }}>{lbl}</div>
            {name && <div style={{ fontWeight: 600, fontSize: "13px", color: "#111", marginBottom: "3px" }}>{name}</div>}
            {email && <div style={{ color: "#555" }}>{email}</div>}
            {phone && <div style={{ color: "#555" }}>{phone}</div>}
            {addr  && <div style={{ color: "#555", whiteSpace: "pre-line", marginTop: "2px" }}>{addr}</div>}
            {!name && <div style={{ color: "#bbb" }}>—</div>}
          </div>
        ))}
      </div>

      {/* Items table */}
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "20px" }}>
        <thead>
          <tr style={{ borderBottom: "2px solid #111" }}>
            <th style={{ textAlign: "left",   padding: "8px 0",    fontSize: "11px", fontWeight: 600, color: "#111", letterSpacing: "0.04em", textTransform: "uppercase", width: "45%" }}>Description</th>
            <th style={{ textAlign: "center", padding: "8px 8px",  fontSize: "11px", fontWeight: 600, color: "#111", letterSpacing: "0.04em", textTransform: "uppercase", width: "10%" }}>Qty</th>
            <th style={{ textAlign: "right",  padding: "8px 8px",  fontSize: "11px", fontWeight: 600, color: "#111", letterSpacing: "0.04em", textTransform: "uppercase", width: "22%" }}>Rate</th>
            <th style={{ textAlign: "right",  padding: "8px 0",    fontSize: "11px", fontWeight: 600, color: "#111", letterSpacing: "0.04em", textTransform: "uppercase", width: "23%" }}>Amount</th>
          </tr>
        </thead>
        <tbody>
          {items.filter(it => it.desc.trim()).map((it, i) => (
            <tr key={it.id} style={{ borderBottom: "1px solid #f0f0f0" }}>
              <td style={{ padding: "10px 0",   color: "#222", verticalAlign: "top" }}>{it.desc}</td>
              <td style={{ padding: "10px 8px",  color: "#555", textAlign: "center", fontFamily: "monospace" }}>{it.qty}</td>
              <td style={{ padding: "10px 8px",  color: "#555", textAlign: "right",  fontFamily: "monospace" }}>{money(+it.rate || 0, form.currency)}</td>
              <td style={{ padding: "10px 0",    color: "#222", textAlign: "right",  fontFamily: "monospace", fontWeight: 500 }}>{money(r2((+it.qty||0)*(+it.rate||0)), form.currency)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Totals */}
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <div style={{ width: "240px" }}>
          {[
            ["Subtotal",                         money(sub, form.currency),     false],
            ...(+form.discount > 0 ? [["Discount (" + form.discount + "%)", "−" + money(disc, form.currency), true]] : []),
            ...(+form.tax > 0      ? [["Tax / VAT (" + form.tax + "%)",      money(taxAmt, form.currency),   false]] : []),
          ].map(([l, v, g]) => (
            <div key={l} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", fontSize: "12px", borderBottom: "1px solid #f0f0f0" }}>
              <span style={{ color: "#666" }}>{l}</span>
              <span style={{ fontFamily: "monospace", color: g ? "#1a8a5a" : "#222" }}>{v}</span>
            </div>
          ))}
          <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 0 4px", fontWeight: 700, fontSize: "16px", borderTop: "2px solid #111", marginTop: "4px" }}>
            <span>Total Due</span>
            <span style={{ fontFamily: "monospace" }}>{money(total, form.currency)}</span>
          </div>
        </div>
      </div>

      {/* Notes */}
      {form.notes && (
        <div style={{ marginTop: "32px", paddingTop: "20px", borderTop: "1px solid #e8e8e8", fontSize: "11px", color: "#666", lineHeight: "1.7" }}>
          <div style={{ fontWeight: 600, color: "#111", marginBottom: "4px", fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.04em" }}>Notes</div>
          {form.notes}
        </div>
      )}
      {/* AI Proposal */}
      {form.proposal && (
        <div style={{ marginTop: "24px", paddingTop: "20px", borderTop: "1px solid #e8e8e8", fontSize: "11px", color: "#444", lineHeight: "1.8" }}>
          <div style={{ fontWeight: 600, color: "#111", marginBottom: "8px", fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.04em" }}>Proposal</div>
          <div style={{ whiteSpace: "pre-wrap" }}>{form.proposal}</div>
        </div>
      )}
    </div>
  );
});
PrintTemplate.displayName = "PrintTemplate";

// ─────────────────────────────────────────────
// EDITOR
// ─────────────────────────────────────────────
const Editor = ({ inv, onSave, onDelete, onBack, isMobile }) => {
  const [form,  setForm]  = useState(inv);
  const [items, setItems] = useState(inv.items?.length ? inv.items : [newItem()]);
  const [tab,   setTab]   = useState("from");
  const [saving, setSaving] = useState(false);
  const [aiLoad, setAiLoad] = useState(false);
  const [aiErr,  setAiErr]  = useState("");
  const printRef = useRef(null);

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));
  const totals = calcTotals(items, form.discount, form.tax);

  const updItem  = useCallback((i, k, v) => setItems(a => a.map((it, x) => x === i ? { ...it, [k]: v } : it)), []);
  const addItem  = () => setItems(a => [...a, newItem()]);
  const remItem  = useCallback(i => setItems(a => a.length > 1 ? a.filter((_, x) => x !== i) : a), []);

  const save = (statusOverride) => {
    const updated = { ...form, items, ...totals, updatedAt: Date.now(), status: statusOverride || form.status };
    onSave(updated);
    setSaving(true);
    setTimeout(() => setSaving(false), 1800);
  };

  const print = () => {
    if (tab !== "preview") { setTab("preview"); setTimeout(print, 500); return; }
    if (!printRef.current) return;
    const w = window.open("", "_blank");
    if (!w) { alert("Please allow pop-ups to print/save PDF."); return; }
    w.document.write(`<!DOCTYPE html><html><head><title>${form.num}</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
    <style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Inter',sans-serif}@media print{body{padding:0}}</style>
    </head><body>${printRef.current.innerHTML}</body></html>`);
    w.document.close(); w.focus(); setTimeout(() => w.print(), 400);
  };

  const genProposal = async () => {
    setAiLoad(true); setAiErr(""); setForm(f => ({ ...f, proposal: "" }));
    try {
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514", max_tokens: 1000,
          messages: [{ role: "user", content: `Write a concise, professional business proposal.\n\nClient: ${form.toName || "Client"}\nProject: ${form.projectName || "Project"}\nScope: ${form.projectDesc || "Professional services"}\nBudget: ${money(form.budget || totals.total, form.currency)}\nTimeline: ${form.timeline || "To be confirmed"}\nProvider: ${form.fromName || "Provider"}\n\nStructure:\n1. Executive Summary (2–3 sentences)\n2. Scope of Work (bullet points)\n3. Timeline & Milestones\n4. Investment & Payment Terms\n\nTone: professional, concise, confident. No fluff.` }],
        }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = await r.json();
      const text = d.content?.map(c => c.text || "").join("") || "";
      if (!text) throw new Error("Empty response");
      setForm(f => ({ ...f, proposal: text }));
    } catch (e) { setAiErr(e.message); }
    finally { setAiLoad(false); }
  };

  const TABS = isMobile
    ? [["from", "From/To"], ["items", "Items"], ["preview", "Preview"]]
    : [["from", "From / To"], ["items", "Line Items"], ["proposal", "AI Proposal"], ["preview", "Preview"]];

  const tabBtn = (k, lbl) => (
    <button key={k} type="button" onClick={() => setTab(k)} style={{
      padding: "7px 14px", borderRadius: "5px", border: "none", fontSize: "12px", fontWeight: 500,
      background: tab === k ? C.surfaceHi : "transparent",
      color: tab === k ? C.text : C.textSub,
      borderBottom: tab === k ? `2px solid ${C.accent}` : "2px solid transparent",
      transition: "all 0.15s",
    }}>{lbl}</button>
  );

  return (
    <div className="fade">
      {/* Top bar */}
      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px", flexWrap: "wrap" }}>
        <Button variant="ghost" size="sm" onClick={onBack} style={{ color: C.textSub }}>← Back</Button>
        <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "14px", fontWeight: 500, flex: 1, color: C.text }}>{form.num}</span>
        <select value={form.status} onChange={set("status")} style={{ ...inputBase(false), width: "auto", padding: "6px 10px", fontSize: "12px" }}>
          {["Draft", "Sent", "Paid", "Overdue"].map(s => <option key={s}>{s}</option>)}
        </select>
        <Button variant="ghost" size="sm" onClick={print} style={{ color: C.textSub }}>PDF</Button>
        <Button variant="primary" size="sm" onClick={() => save()} style={{ minWidth: "70px" }}>
          {saving ? "Saved ✓" : "Save"}
        </Button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 260px", gap: "16px" }}>
        {/* Left */}
        <div>
          {/* Invoice meta */}
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: "8px", padding: "16px 20px", marginBottom: "12px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: "0 16px" }}>
              <Input label="Invoice #" value={form.num} onChange={set("num")} />
              <SelectField label="Currency" value={form.currency} onChange={set("currency")}>
                {Object.entries(CURRENCIES).map(([k, v]) => <option key={k} value={k}>{k} — {v.symbol}</option>)}
              </SelectField>
              <Input label="Issue Date" type="date" value={form.date} onChange={set("date")} />
              <Input label="Due Date"   type="date" value={form.dueDate} onChange={set("dueDate")} />
            </div>
          </div>

          {/* Tab bar */}
          <div style={{ display: "flex", gap: "2px", borderBottom: `1px solid ${C.border}`, marginBottom: "12px", overflowX: "auto" }}>
            {TABS.map(([k, l]) => tabBtn(k, l))}
          </div>

          {/* FROM/TO */}
          {tab === "from" && (
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: "8px", padding: "20px", animation: "fadeUp 0.2s ease" }}>
              <SectionHead title="From (You)" />
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: "0 16px" }}>
                <Input label="Name / Company" required value={form.fromName} onChange={set("fromName")} placeholder="Your name or company" />
                <Input label="Email" type="email" value={form.fromEmail} onChange={set("fromEmail")} placeholder="you@example.com" />
                <Input label="Phone" value={form.fromPhone} onChange={set("fromPhone")} placeholder="+1 555 000 0000" />
              </div>
              <Textarea label="Address" value={form.fromAddress} onChange={set("fromAddress")} placeholder="Street, City, Country" rows={2} />
              <Divider my={20} />
              <SectionHead title="Bill To (Client)" />
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: "0 16px" }}>
                <Input label="Client Name" required value={form.toName} onChange={set("toName")} placeholder="Client or company" />
                <Input label="Email" type="email" value={form.toEmail} onChange={set("toEmail")} placeholder="client@example.com" />
                <Input label="Phone" value={form.toPhone} onChange={set("toPhone")} placeholder="+1 555 000 0000" />
              </div>
              <Textarea label="Address" value={form.toAddress} onChange={set("toAddress")} placeholder="Client address" rows={2} />
              <Divider my={20} />
              <Textarea label="Notes / Payment Terms" value={form.notes} onChange={set("notes")} rows={2}
                placeholder="e.g. Payment due within 30 days. Bank transfer preferred." />
            </div>
          )}

          {/* ITEMS */}
          {tab === "items" && (
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: "8px", padding: "20px", animation: "fadeUp 0.2s ease" }}>
              <SectionHead title="Line Items" />
              {/* Desktop header */}
              <div className="desktop-only" style={{ display: "grid", gridTemplateColumns: GRID_COLS, gap: "6px", marginBottom: "8px" }}>
                {[["Description", "left"], ["Qty", "right"], ["Rate", "right"], ["Amount", "right"], ["", ""]].map(([h, a]) => (
                  <div key={h} style={{ fontSize: "10px", fontWeight: 600, color: C.textDim, letterSpacing: "0.05em", textTransform: "uppercase", textAlign: a, padding: "0 9px" }}>{h}</div>
                ))}
              </div>
              {/* Items */}
              <div className="desktop-only">
                {items.map((it, i) => <ItemRow key={it.id} item={it} idx={i} onChange={updItem} onRemove={remItem} canRemove={items.length > 1} currency={form.currency} />)}
              </div>
              <div className="mobile-only">
                {items.map((it, i) => <ItemCard key={it.id} item={it} idx={i} onChange={updItem} onRemove={remItem} canRemove={items.length > 1} currency={form.currency} />)}
              </div>
              <Button variant="ghost" size="sm" onClick={addItem} style={{ marginTop: "8px", color: C.textSub, border: `1px dashed ${C.border}`, width: "100%" }}>
                + Add line item
              </Button>
              <Divider my={20} />
              {/* Totals */}
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: "16px", alignItems: "start" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
                  <Input label="Discount %" type="number" value={form.discount} onChange={set("discount")} min="0" max="100" step="0.1" />
                  <Input label="Tax / VAT %" type="number" value={form.tax} onChange={set("tax")} min="0" max="100" step="0.1" />
                </div>
                <div style={{ background: C.surfaceHi, border: `1px solid ${C.border}`, borderRadius: "6px", padding: "14px 16px" }}>
                  {[
                    ["Subtotal",  money(totals.sub, form.currency),    false],
                    ...(+form.discount > 0 ? [["Discount", `−${money(totals.disc, form.currency)}`, true]] : []),
                    ...(+form.tax      > 0 ? [["Tax",       money(totals.taxAmt, form.currency),  false]] : []),
                  ].map(([l, v, g]) => (
                    <div key={l} style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", padding: "4px 0", borderBottom: `1px solid ${C.border}` }}>
                      <span style={{ color: C.textSub }}>{l}</span>
                      <span style={{ fontFamily: "'JetBrains Mono',monospace", color: g ? C.green : C.text }}>{v}</span>
                    </div>
                  ))}
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: "10px", fontSize: "15px", fontWeight: 600 }}>
                    <span>Total</span>
                    <span style={{ fontFamily: "'JetBrains Mono',monospace", color: C.text }}>{money(totals.total, form.currency)}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* PROPOSAL */}
          {tab === "proposal" && (
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: "8px", padding: "20px", animation: "fadeUp 0.2s ease" }}>
              <SectionHead title="AI Proposal Generator" />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
                <Input label="Project Name" value={form.projectName || ""} onChange={set("projectName")} placeholder="e.g. Website Redesign" />
                <Input label="Timeline" value={form.timeline || ""} onChange={set("timeline")} placeholder="e.g. 4 weeks" />
                <Input label={`Budget (${form.currency})`} type="number" value={form.budget || ""} onChange={set("budget")} placeholder={String(totals.total)} />
              </div>
              <Textarea label="Project Description" value={form.projectDesc || ""} onChange={set("projectDesc")} rows={3}
                placeholder="Describe deliverables, goals, and requirements…" />
              <Button variant="primary" full onClick={genProposal} disabled={aiLoad}>
                {aiLoad ? <span style={{ animation: "blink 1s infinite" }}>Generating…</span> : "Generate AI Proposal"}
              </Button>
              {aiErr && <div style={{ color: C.red, fontSize: "12px", marginTop: "10px" }}>{aiErr}</div>}
              {form.proposal && (
                <div style={{ marginTop: "16px", background: C.surfaceHi, border: `1px solid ${C.border}`, borderRadius: "6px", padding: "16px", fontSize: "13px", lineHeight: "1.8", whiteSpace: "pre-wrap", maxHeight: "320px", overflowY: "auto", color: C.textSub }}>
                  {form.proposal}
                </div>
              )}
            </div>
          )}

          {/* PREVIEW */}
          {tab === "preview" && (
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: "8px", padding: "20px", animation: "fadeUp 0.2s ease" }}>
              <SectionHead title="Print Preview" right={<Button variant="primary" size="sm" onClick={print}>Print / Save PDF</Button>} />
              <div style={{ border: `1px solid ${C.border}`, borderRadius: "6px", overflow: "hidden" }}>
                <PrintTemplate ref={printRef} form={form} items={items} totals={totals} />
              </div>
            </div>
          )}
        </div>

        {/* Right sidebar */}
        {!isMobile && (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: "8px", padding: "16px 18px", position: "sticky", top: "72px" }}>
              <div style={{ fontSize: "11px", fontWeight: 600, color: C.textSub, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "14px" }}>Summary</div>
              {[["Invoice", form.num, "mono"], ["Client", form.toName || "—", ""], ["Due", form.dueDate || "—", "mono"]].map(([l, v, m]) => (
                <div key={l} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px", fontSize: "12px" }}>
                  <span style={{ color: C.textDim }}>{l}</span>
                  <span style={{ fontFamily: m ? "'JetBrains Mono',monospace" : "inherit", color: C.textSub, maxWidth: "130px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v}</span>
                </div>
              ))}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px", fontSize: "12px" }}>
                <span style={{ color: C.textDim }}>Status</span>
                <Badge status={form.status} />
              </div>
              <Divider my={14} />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "16px", fontWeight: 600, marginBottom: "16px" }}>
                <span style={{ color: C.textSub, fontSize: "13px" }}>Total Due</span>
                <span style={{ fontFamily: "'JetBrains Mono',monospace" }}>{money(totals.total, form.currency)}</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <Button variant="primary" full onClick={() => save()}>
                  {saving ? "Saved ✓" : "Save Invoice"}
                </Button>
                <Button variant="success" full onClick={() => save("Paid")}>Mark as Paid</Button>
                <Button variant="default" full onClick={print}>Print / PDF</Button>
                <Button variant="default" full onClick={() => save("Sent")}>Mark as Sent</Button>
                <Button variant="danger" full onClick={() => { if (confirm("Delete this invoice?")) onDelete(inv.id); }}>Delete</Button>
              </div>
            </div>
          </div>
        )}

        {/* Mobile actions */}
        {isMobile && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
            <Button variant="primary" full onClick={() => save()}>{saving ? "Saved ✓" : "Save"}</Button>
            <Button variant="default" full onClick={print}>PDF</Button>
            <Button variant="success" full onClick={() => save("Paid")}>Mark Paid</Button>
            <Button variant="danger" full onClick={() => { if (confirm("Delete?")) onDelete(inv.id); }}>Delete</Button>
          </div>
        )}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────
// ROOT APP
// ─────────────────────────────────────────────
const React = { forwardRef: (fn) => { const C = (p, r) => fn(p, r); C.displayName = fn.displayName; return C; } };

export default function App() {
  const [invs, setInvs]     = useState(() => ls.get("invoices_v3", []));
  const [view, setView]     = useState("dash");
  const [activeId, setActId]= useState(null);
  const [isMobile, setMob]  = useState(window.innerWidth < 720);

  useEffect(() => {
    const h = () => setMob(window.innerWidth < 720);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);

  useEffect(() => { ls.set("invoices_v3", invs); }, [invs]);

  const createInv = () => {
    const inv = {
      id: uid(), num: nextNum(invs),
      date: today(), dueDate: due30(today()),
      fromName: "", fromEmail: "", fromPhone: "", fromAddress: "",
      toName:   "", toEmail:   "", toPhone:   "", toAddress:   "",
      currency: "USD", discount: "0", tax: "0",
      notes: "Payment due within 30 days. Thank you for your business.",
      projectName: "", projectDesc: "", budget: "", timeline: "", proposal: "",
      items: [newItem()], sub: 0, total: 0,
      status: "Draft", createdAt: Date.now(), updatedAt: Date.now(),
    };
    setInvs(p => [inv, ...p]);
    setActId(inv.id);
    setView("edit");
  };

  const saveInv  = u  => setInvs(p => p.map(i => i.id === u.id ? u : i));
  const delInv   = id => { setInvs(p => p.filter(i => i.id !== id)); setView("dash"); };
  const openInv  = id => { setActId(id); setView("edit"); };
  const active   = invs.find(i => i.id === activeId);

  return (
    <>
      <GS />
      <div style={{ minHeight: "100vh", background: C.bg }}>
        {/* Header */}
        <header style={{ height: "52px", borderBottom: `1px solid ${C.border}`, background: C.bgSub, display: "flex", alignItems: "center", padding: "0 24px", gap: "16px", position: "sticky", top: 0, zIndex: 100, backdropFilter: "blur(12px)" }}>
          <button type="button" onClick={() => setView("dash")} style={{ background: "none", border: "none", color: C.text, fontFamily: "'JetBrains Mono',monospace", fontSize: "13px", fontWeight: 500, letterSpacing: "0.02em", cursor: "pointer", padding: 0 }}>
            InvoiceAI
          </button>
          <span style={{ color: C.border, fontSize: "18px", fontWeight: 300 }}>|</span>
          <span style={{ color: C.textDim, fontSize: "12px" }}>{view === "edit" && active ? active.num : "Dashboard"}</span>
          <div style={{ flex: 1 }} />
          {view === "dash" && (
            <Button variant="primary" size="sm" onClick={createInv}>+ New Invoice</Button>
          )}
        </header>

        {/* Main */}
        <main style={{ maxWidth: "1100px", margin: "0 auto", padding: isMobile ? "20px 14px" : "28px 24px" }}>
          {view === "dash" && <Dashboard invoices={invs} onCreate={createInv} onOpen={openInv} />}
          {view === "edit" && active && (
            <Editor inv={active} onSave={saveInv} onDelete={delInv} onBack={() => setView("dash")} isMobile={isMobile} />
          )}
        </main>
      </div>
    </>
  );
}
