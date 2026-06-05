import { useState, useRef, useCallback, useEffect } from "react";

// ── Currency config ───────────────────────────────────────────────
const CURRENCIES = {
  USD: { symbol: "$",   locale: "en-US" },
  EUR: { symbol: "€",   locale: "de-DE" },
  GBP: { symbol: "£",   locale: "en-GB" },
  BDT: { symbol: "৳",   locale: "en-US" }, // FIX 1: bn-BD unreliable in most browsers → fallback
  INR: { symbol: "₹",   locale: "en-IN" },
  CAD: { symbol: "CA$", locale: "en-CA" },
  AUD: { symbol: "A$",  locale: "en-AU" },
  JPY: { symbol: "¥",   locale: "ja-JP" },
  SGD: { symbol: "S$",  locale: "en-SG" },
};

const C = {
  bg:"#0a0a10", surface:"#13131c", card:"#1a1a26", border:"#252535",
  accent:"#6c63ff", accentHi:"#8b84ff", accentGlow:"rgba(108,99,255,0.15)",
  gold:"#f5c518", text:"#eeeef8", muted:"#7777a0", success:"#34d399", danger:"#f87171",
};

// ── Helpers ───────────────────────────────────────────────────────
let _counter = 0;
const nextInvoiceNo = () => `INV-${String(++_counter).padStart(4, "0")}`;

const fmt = (amount, currency) => {
  const cfg = CURRENCIES[currency] || CURRENCIES.USD;
  const num = Number(amount);
  // FIX 2: guard NaN — show fallback instead of "NaN"
  if (!isFinite(num)) return `${cfg.symbol}0.00`;
  try {
    return new Intl.NumberFormat(cfg.locale, {
      style: "currency", currency,
      minimumFractionDigits: currency === "JPY" ? 0 : 2,
      maximumFractionDigits: currency === "JPY" ? 0 : 2,
    }).format(num);
  } catch {
    return `${cfg.symbol}${num.toFixed(2)}`;
  }
};

const today   = () => new Date().toISOString().slice(0, 10);
// FIX 3: addDays — use UTC to avoid DST shift on date boundaries
const addDays = (d, n) => {
  const dt = new Date(d + "T00:00:00Z");
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
};
const clamp  = (v, lo, hi) => Math.min(Math.max(Number(v) || 0, lo), hi);
const round2 = n => Math.round((n + Number.EPSILON) * 100) / 100;

let _idSeed = 0;
const newId   = () => `item-${++_idSeed}`;
const newItem = () => ({ id: newId(), desc: "", qty: "1", rate: "0" });

// ── Styles ────────────────────────────────────────────────────────
const S = {
  app:       { minHeight:"100vh", background:C.bg, fontFamily:"'DM Mono','Fira Mono',monospace", color:C.text, fontSize:"14px" },
  header:    { background:`linear-gradient(135deg,${C.surface},#0e0e18)`, borderBottom:`1px solid ${C.border}`, padding:"18px 32px", display:"flex", alignItems:"center", justifyContent:"space-between", position:"sticky", top:0, zIndex:100, backdropFilter:"blur(16px)" },
  logo:      { fontFamily:"'Syne','Bebas Neue',sans-serif", fontSize:"23px", letterSpacing:"4px", display:"flex", alignItems:"center", gap:"10px" },
  badge:     { background:C.accentGlow, border:`1px solid ${C.accent}`, color:C.accentHi, borderRadius:"20px", padding:"2px 10px", fontSize:"10px", letterSpacing:"1.5px" },
  main:      { maxWidth:"1260px", margin:"0 auto", padding:"32px 18px", display:"grid", gridTemplateColumns:"minmax(0,1.2fr) minmax(0,0.8fr)", gap:"24px" },
  card:      { background:C.card, border:`1px solid ${C.border}`, borderRadius:"14px", padding:"22px" },
  secTitle:  { fontFamily:"'Syne',sans-serif", fontSize:"11px", letterSpacing:"3px", color:C.muted, textTransform:"uppercase", marginBottom:"16px", display:"flex", alignItems:"center", gap:"8px" },
  dot:       { width:"5px", height:"5px", borderRadius:"50%", background:C.accent, flexShrink:0 },
  label:     { display:"block", fontSize:"10px", letterSpacing:"1.5px", color:C.muted, textTransform:"uppercase", marginBottom:"5px" },
  input:     { width:"100%", background:C.surface, border:`1px solid ${C.border}`, borderRadius:"8px", padding:"9px 12px", color:C.text, fontFamily:"'DM Mono','Fira Mono',monospace", fontSize:"13px", outline:"none", boxSizing:"border-box", transition:"border-color 0.2s,box-shadow 0.2s" },
  textarea:  { width:"100%", background:C.surface, border:`1px solid ${C.border}`, borderRadius:"8px", padding:"9px 12px", color:C.text, fontFamily:"'DM Mono','Fira Mono',monospace", fontSize:"13px", outline:"none", resize:"vertical", minHeight:"68px", boxSizing:"border-box" },
  select:    { width:"100%", background:C.surface, border:`1px solid ${C.border}`, borderRadius:"8px", padding:"9px 12px", color:C.text, fontFamily:"'DM Mono','Fira Mono',monospace", fontSize:"13px", outline:"none", boxSizing:"border-box", appearance:"none" },
  row:       { display:"flex", gap:"12px", marginBottom:"13px" },
  col:       { flex:1, minWidth:0 },
  mb:        { marginBottom:"13px" },
  divider:   { border:"none", borderTop:`1px solid ${C.border}`, margin:"16px 0" },
  errMsg:    { color:C.danger, fontSize:"11px", marginTop:"3px" },
  totalBox:  { background:C.surface, border:`1px solid ${C.border}`, borderRadius:"10px", padding:"14px", marginTop:"10px" },
  totalRow:  { display:"flex", justifyContent:"space-between", alignItems:"center", padding:"3px 0", fontSize:"12px" },
  totalFinal:{ display:"flex", justifyContent:"space-between", padding:"10px 0 0", marginTop:"8px", borderTop:`1px solid ${C.border}`, fontSize:"18px", fontWeight:"bold", color:C.gold },
  btnPrimary:{ background:`linear-gradient(135deg,${C.accent},#9b5cf6)`, color:"#fff", border:"none", borderRadius:"9px", padding:"11px 18px", fontFamily:"'DM Mono',monospace", fontSize:"12px", letterSpacing:"1px", cursor:"pointer", fontWeight:"bold", display:"flex", alignItems:"center", justifyContent:"center", gap:"7px", width:"100%" },
  btnGreen:  { background:`linear-gradient(135deg,${C.success},#059669)`, color:"#0a0a10", border:"none", borderRadius:"9px", padding:"11px 18px", fontFamily:"'DM Mono',monospace", fontSize:"12px", letterSpacing:"1px", cursor:"pointer", fontWeight:"bold", display:"flex", alignItems:"center", justifyContent:"center", gap:"7px" },
  btnOutline:{ background:"transparent", color:C.accentHi, border:`1px solid ${C.accent}`, borderRadius:"9px", padding:"9px 15px", fontFamily:"'DM Mono',monospace", fontSize:"11px", letterSpacing:"1px", cursor:"pointer" },
  btnDanger: { background:"transparent", color:C.danger, border:`1px solid ${C.danger}`, borderRadius:"6px", padding:"4px 9px", fontFamily:"'DM Mono',monospace", fontSize:"10px", cursor:"pointer" },
  tabs:      { display:"flex", gap:"3px", background:C.surface, borderRadius:"10px", padding:"4px", marginBottom:"18px" },
  tab:       { flex:1, padding:"8px 6px", borderRadius:"7px", border:"none", cursor:"pointer", fontFamily:"'DM Mono',monospace", fontSize:"11px", letterSpacing:"0.5px", transition:"all 0.2s" },
  aiBox:     { background:`linear-gradient(135deg,rgba(108,99,255,0.07),rgba(155,92,246,0.04))`, border:`1px solid rgba(108,99,255,0.25)`, borderRadius:"12px", padding:"16px", marginTop:"14px", fontSize:"12px", lineHeight:"1.8", whiteSpace:"pre-wrap", maxHeight:"300px", overflowY:"auto" },
  prev:      { background:"#fff", color:"#111", borderRadius:"12px", padding:"32px", fontFamily:"Georgia,serif", fontSize:"12px", lineHeight:"1.6" },
  prevH:     { display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:"22px" },
  prevTitle: { fontSize:"28px", fontWeight:"900", color:"#5b54e8", letterSpacing:"5px", fontFamily:"sans-serif" },
  prevTh:    { background:"#5b54e8", color:"#fff", padding:"7px 10px", textAlign:"left", fontFamily:"sans-serif", fontSize:"10px", letterSpacing:"1px" },
  prevTd:    { padding:"7px 10px", borderBottom:"1px solid #f0f0f0" },
};

// ── ItemRow ───────────────────────────────────────────────────────
const ItemRow = ({ item, idx, onChange, onRemove, canRemove, currency, errors }) => {
  const lineTotal = round2(Number(item.qty || 0) * Number(item.rate || 0));
  const inputStyle = (hasErr) => ({
    ...S.input,
    ...(hasErr ? { borderColor: C.danger } : {}),
    // ensure consistent height regardless of error state below
    height: "38px",
    padding: "0 10px",
  });
  return (
    <div style={{ marginBottom: errors ? "14px" : "8px" }}>
      {/* Main row — fixed columns, no overflow */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 70px 90px 78px 32px",
        gap: "6px",
        alignItems: "center",
      }}>
        {/* Description */}
        <input
          style={inputStyle(errors?.desc)}
          value={item.desc}
          placeholder="Description"
          onChange={e => onChange(idx, "desc", e.target.value)}
        />
        {/* Qty */}
        <input
          type="number"
          style={{ ...inputStyle(errors?.qty), textAlign: "right" }}
          value={item.qty}
          min="0.01"
          step="0.01"
          onChange={e => onChange(idx, "qty", e.target.value)}
        />
        {/* Rate */}
        <input
          type="number"
          style={{ ...inputStyle(errors?.rate), textAlign: "right" }}
          value={item.rate}
          min="0"
          step="0.01"
          onChange={e => onChange(idx, "rate", e.target.value)}
        />
        {/* Line total — always right-aligned, no wrap */}
        <div style={{
          fontSize: "12px",
          color: C.muted,
          textAlign: "right",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          lineHeight: "38px",
        }}>
          {fmt(lineTotal, currency)}
        </div>
        {/* Remove button */}
        <button
          type="button"
          style={{
            ...S.btnDanger,
            width: "28px",
            height: "28px",
            padding: "0",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            opacity: canRemove ? 1 : 0.3,
            flexShrink: 0,
          }}
          onClick={() => canRemove && onRemove(idx)}
          disabled={!canRemove}
        >✕</button>
      </div>
      {/* Error messages below — only shown when needed, don't shift grid */}
      {(errors?.desc || errors?.qty || errors?.rate) && (
        <div style={{
          display: "grid",
          gridTemplateColumns: "1fr 70px 90px 78px 32px",
          gap: "6px",
          marginTop: "2px",
        }}>
          <div style={S.errMsg}>{errors?.desc || ""}</div>
          <div style={S.errMsg}>{errors?.qty || ""}</div>
          <div style={S.errMsg}>{errors?.rate || ""}</div>
          <div /><div />
        </div>
      )}
    </div>
  );
};

// ── App ───────────────────────────────────────────────────────────
export default function App() {
  const [tab, setTab]             = useState("invoice");
  const [form, setForm]           = useState(() => ({
    invoiceNo:   nextInvoiceNo(),
    date:        today(),
    dueDate:     addDays(today(), 30),
    fromName:"", fromEmail:"", fromAddress:"", fromPhone:"",
    toName:"",   toEmail:"",   toAddress:"",   toPhone:"",
    currency:"USD", tax:"0", discount:"0",
    notes:"Payment due within 30 days. Thank you for your business.",
    projectName:"", projectDesc:"", budget:"", timeline:"",
  }));
  const [items,      setItems]      = useState([newItem()]);
  const [errors,     setErrors]     = useState({});
  const [itemErrors, setItemErrors] = useState({});
  const [aiText,     setAiText]     = useState("");
  const [aiLoading,  setAiLoading]  = useState(false);
  const [aiErr,      setAiErr]      = useState("");
  const [copyOk,     setCopyOk]     = useState(false);
  // FIX 6: printReady flag — ensures ref is mounted before print
  const [printReady, setPrintReady] = useState(false);
  const printRef = useRef(null);

  useEffect(() => {
    if (tab === "preview") setPrintReady(true);
    else setPrintReady(false);
  }, [tab]);

  const set = useCallback(k => e => setForm(f => ({ ...f, [k]: e.target.value })), []);

  // ── Calculations ──
  const subtotal  = round2(items.reduce((s, it) => s + round2(Number(it.qty || 0) * Number(it.rate || 0)), 0));
  const discAmt   = round2(subtotal * clamp(form.discount, 0, 100) / 100);
  const afterDisc = round2(subtotal - discAmt);
  const taxAmt    = round2(afterDisc * clamp(form.tax, 0, 100) / 100);
  const total     = round2(afterDisc + taxAmt);

  // ── Item handlers ──
  const updateItem = useCallback((i, k, v) =>
    setItems(arr => arr.map((it, idx) => idx === i ? { ...it, [k]: v } : it)), []);
  const addItem    = useCallback(() => setItems(arr => [...arr, newItem()]), []);
  const removeItem = useCallback(i =>
    setItems(arr => arr.length > 1 ? arr.filter((_, idx) => idx !== i) : arr), []);

  // ── Validation — plain function, called only on button click ──
  const validate = () => {
    const e = {}, ie = {};
    if (!form.fromName.trim())  e.fromName  = "Required";
    if (!form.toName.trim())    e.toName    = "Required";
    if (!form.invoiceNo.trim()) e.invoiceNo = "Required";
    // FIX 7: validate all items including ones with desc but qty=0
    items.forEach((it, i) => {
      const r = {};
      if (!it.desc.trim())         r.desc = "Required";
      if (!(Number(it.qty) > 0))   r.qty  = "Must be > 0";
      if (Number(it.rate) < 0)     r.rate = "Must be ≥ 0";
      if (Object.keys(r).length)   ie[i]  = r;
    });
    setErrors(e); setItemErrors(ie);
    return !Object.keys(e).length && !Object.keys(ie).length;
  };

  // ── AI Proposal ──
  const generateProposal = async () => {
    setAiLoading(true); setAiErr(""); setAiText("");
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          messages: [{ role: "user", content:
            `Write a professional business proposal:\n\nClient: ${form.toName || "Client"}\nProject: ${form.projectName || "Project"}\nDescription: ${form.projectDesc || "Custom development"}\nBudget: ${form.budget ? fmt(form.budget, form.currency) : fmt(total, form.currency)}\nTimeline: ${form.timeline || "TBD"}\nProvider: ${form.fromName || "Our Company"}\n\nWrite 4 sections:\n1. Executive Summary\n2. Scope & Deliverables (bullets)\n3. Timeline & Milestones\n4. Investment & Terms\n\nBe concise, professional, persuasive.`
          }],
        }),
      });
      if (!res.ok) {
        // FIX 8: parse error body for clearer message
        let msg = `API error ${res.status}`;
        try { const d = await res.json(); msg = d?.error?.message || msg; } catch {}
        throw new Error(msg);
      }
      const d = await res.json();
      const text = d.content?.map(c => c.text || "").join("") || "";
      if (!text) throw new Error("Empty response from API");
      setAiText(text);
    } catch (err) {
      setAiErr(`Generation failed: ${err.message}. Please retry.`);
    } finally {
      setAiLoading(false);
    }
  };

  // ── Clipboard ──
  const handleCopy = async () => {
    if (!aiText) return;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(aiText);
      } else {
        const ta = document.createElement("textarea");
        ta.value = aiText;
        ta.style.position = "fixed"; ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.focus(); ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      setCopyOk(true);
      setTimeout(() => setCopyOk(false), 2000);
    } catch {
      alert("Copy failed — please select and copy the text manually.");
    }
  };

  // ── Print / PDF ──
  // FIX 9+: triggerPrint defined INSIDE handlePrint so it always
  // captures the latest form/printRef values — no stale closure risk.
  const handlePrint = useCallback(() => {
    const doprint = () => {
      if (!printRef.current) return;
      const w = window.open("", "_blank");
      if (!w) { alert("Popup blocked — please allow popups for this site."); return; }
      const html = printRef.current.innerHTML;
      w.document.write(`<!DOCTYPE html><html><head>
        <title>Invoice ${form.invoiceNo}</title>
        <style>
          *{box-sizing:border-box}
          body{margin:0;padding:28px;font-family:Georgia,serif;font-size:12px;color:#111}
          table{width:100%;border-collapse:collapse}
          th{background:#5b54e8;color:#fff;padding:7px 10px;text-align:left;font-size:10px;letter-spacing:1px}
          td{padding:7px 10px;border-bottom:1px solid #eee}
          @media print{body{padding:12px}}
        </style>
      </head><body>${html}</body></html>`);
      w.document.close();
      w.focus();
      setTimeout(() => w.print(), 300);
    };
    if (!printReady || !printRef.current) {
      setTab("preview");
      setTimeout(doprint, 500);
      return;
    }
    doprint();
  }, [printReady, form.invoiceNo]);

  // ── New Invoice ──
  const handleNew = useCallback(() => {
    setForm(f => ({
      ...f,
      invoiceNo: nextInvoiceNo(),
      date: today(), dueDate: addDays(today(), 30),
      toName:"", toEmail:"", toAddress:"", toPhone:"",
      notes:"Payment due within 30 days. Thank you for your business.",
      projectName:"", projectDesc:"", budget:"", timeline:"",
      tax:"0", discount:"0",
    }));
    setItems([newItem()]);
    setAiText(""); setErrors({}); setItemErrors({});
    setTab("invoice");
  }, []);

  const currencyKeys = Object.keys(CURRENCIES);
  const tabStyle = k => ({ ...S.tab, ...(tab === k ? { background:C.accent, color:"#fff" } : { background:"transparent", color:C.muted }) });

  // FIX 10: header buttons use type="button" to avoid accidental submit
  return (
    <div style={S.app}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Mono:wght@300;400;500&display=swap');
        input:focus,textarea:focus,select:focus{border-color:${C.accent}!important;box-shadow:0 0 0 2px ${C.accentGlow}}
        button:active{transform:scale(0.97)}
        button:disabled{opacity:0.5;cursor:not-allowed!important}
        select option{background:${C.surface}}
        ::-webkit-scrollbar{width:4px}
        ::-webkit-scrollbar-track{background:${C.surface}}
        ::-webkit-scrollbar-thumb{background:${C.border};border-radius:4px}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.35}}
        @media(max-width:860px){.mg{grid-template-columns:1fr!important}}
        @media(max-width:560px){.item-row{grid-template-columns:1fr 60px 80px auto!important}}
      `}</style>

      <header style={S.header}>
        <div style={S.logo}>
          <span>⚡</span>
          <span>INVOICE<span style={{ color:C.accent }}>AI</span></span>
          <span style={S.badge}>PRO</span>
        </div>
        <div style={{ display:"flex", gap:"10px" }}>
          <button type="button" style={S.btnOutline} onClick={() => setTab("preview")}>👁 Preview</button>
          <button type="button" style={S.btnGreen}   onClick={handlePrint}>🖨 Print / PDF</button>
        </div>
      </header>

      <div style={S.main} className="mg">
        {/* LEFT */}
        <div>
          <div style={S.tabs}>
            {[["invoice","📄 Invoice"],["proposal","✨ Proposal"],["preview","👁 Preview"]].map(([k,lbl]) => (
              <button type="button" key={k} style={tabStyle(k)} onClick={() => setTab(k)}>{lbl}</button>
            ))}
          </div>

          {/* INVOICE TAB */}
          {tab === "invoice" && (
            <div style={S.card}>
              <div style={S.secTitle}><span style={S.dot}/>Invoice Details</div>
              <div style={S.row}>
                <div style={S.col}>
                  <label style={S.label}>Invoice #</label>
                  <input style={{ ...S.input, ...(errors.invoiceNo ? { borderColor:C.danger } : {}) }}
                    value={form.invoiceNo} onChange={set("invoiceNo")} />
                  {errors.invoiceNo && <div style={S.errMsg}>{errors.invoiceNo}</div>}
                </div>
                <div style={S.col}>
                  <label style={S.label}>Currency</label>
                  <select style={S.select} value={form.currency} onChange={set("currency")}>
                    {currencyKeys.map(c => <option key={c} value={c}>{c} {CURRENCIES[c].symbol}</option>)}
                  </select>
                </div>
              </div>
              <div style={S.row}>
                <div style={S.col}>
                  <label style={S.label}>Issue Date</label>
                  <input type="date" style={S.input} value={form.date} onChange={set("date")} />
                </div>
                <div style={S.col}>
                  <label style={S.label}>Due Date</label>
                  <input type="date" style={S.input} value={form.dueDate} onChange={set("dueDate")} />
                </div>
              </div>

              <hr style={S.divider}/>
              <div style={S.secTitle}><span style={S.dot}/>From (You)</div>
              <div style={S.mb}>
                <label style={S.label}>Name / Company *</label>
                <input style={{ ...S.input, ...(errors.fromName ? { borderColor:C.danger } : {}) }}
                  value={form.fromName} onChange={set("fromName")} placeholder="Your Name or Company" />
                {errors.fromName && <div style={S.errMsg}>{errors.fromName}</div>}
              </div>
              <div style={S.row}>
                <div style={S.col}>
                  <label style={S.label}>Email</label>
                  <input style={S.input} value={form.fromEmail} onChange={set("fromEmail")} placeholder="you@email.com" />
                </div>
                <div style={S.col}>
                  <label style={S.label}>Phone</label>
                  <input style={S.input} value={form.fromPhone} onChange={set("fromPhone")} placeholder="+880 1xxx" />
                </div>
              </div>
              <div style={S.mb}>
                <label style={S.label}>Address</label>
                <textarea style={S.textarea} rows={2} value={form.fromAddress} onChange={set("fromAddress")} placeholder="Street, City, Country" />
              </div>

              <hr style={S.divider}/>
              <div style={S.secTitle}><span style={S.dot}/>Bill To (Client)</div>
              <div style={S.mb}>
                <label style={S.label}>Client Name *</label>
                <input style={{ ...S.input, ...(errors.toName ? { borderColor:C.danger } : {}) }}
                  value={form.toName} onChange={set("toName")} placeholder="Client / Company" />
                {errors.toName && <div style={S.errMsg}>{errors.toName}</div>}
              </div>
              <div style={S.row}>
                <div style={S.col}>
                  <label style={S.label}>Email</label>
                  <input style={S.input} value={form.toEmail} onChange={set("toEmail")} placeholder="client@email.com" />
                </div>
                <div style={S.col}>
                  <label style={S.label}>Phone</label>
                  <input style={S.input} value={form.toPhone} onChange={set("toPhone")} placeholder="+1 555 000" />
                </div>
              </div>
              <div style={S.mb}>
                <label style={S.label}>Address</label>
                <textarea style={S.textarea} rows={2} value={form.toAddress} onChange={set("toAddress")} placeholder="Client address" />
              </div>

              <hr style={S.divider}/>
              <div style={S.secTitle}><span style={S.dot}/>Line Items</div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 70px 90px 78px 32px", gap:"6px", marginBottom:"6px" }}>
                {[["Description","left"],["Qty","right"],["Unit Rate","right"],["Amount","right"],["","right"]].map(([h, align]) => (
                  <div key={h} style={{ fontSize:"10px", color:C.muted, letterSpacing:"1px", textTransform:"uppercase", textAlign: align }}>{h}</div>
                ))}
              </div>
              {items.map((it, i) => (
                <ItemRow key={it.id} item={it} idx={i}
                  onChange={updateItem} onRemove={removeItem}
                  canRemove={items.length > 1}
                  currency={form.currency}
                  errors={itemErrors[i]} />
              ))}
              <button type="button" style={{ ...S.btnOutline, marginTop:"6px", fontSize:"12px" }} onClick={addItem}>+ Add Item</button>

              <div style={S.totalBox}>
                <div style={S.totalRow}>
                  <span style={{ color:C.muted }}>Subtotal</span>
                  <span>{fmt(subtotal, form.currency)}</span>
                </div>
                <div style={{ ...S.totalRow, marginTop:"6px" }}>
                  <span style={{ color:C.muted }}>Discount (%)</span>
                  <input type="number" min="0" max="100" step="0.1"
                    style={{ ...S.input, width:"80px", textAlign:"right", padding:"5px 8px" }}
                    value={form.discount} onChange={set("discount")} />
                </div>
                {Number(form.discount) > 0 && (
                  <div style={S.totalRow}>
                    <span style={{ color:C.success }}>Discount</span>
                    <span style={{ color:C.success }}>−{fmt(discAmt, form.currency)}</span>
                  </div>
                )}
                <div style={{ ...S.totalRow, marginTop:"6px" }}>
                  <span style={{ color:C.muted }}>Tax / VAT (%)</span>
                  <input type="number" min="0" max="100" step="0.1"
                    style={{ ...S.input, width:"80px", textAlign:"right", padding:"5px 8px" }}
                    value={form.tax} onChange={set("tax")} />
                </div>
                {Number(form.tax) > 0 && (
                  <div style={S.totalRow}>
                    <span style={{ color:C.muted }}>Tax Amount</span>
                    <span>{fmt(taxAmt, form.currency)}</span>
                  </div>
                )}
                <div style={S.totalFinal}>
                  <span>TOTAL DUE</span>
                  <span>{fmt(total, form.currency)}</span>
                </div>
              </div>

              <div style={{ ...S.mb, marginTop:"14px" }}>
                <label style={S.label}>Notes / Payment Terms</label>
                <textarea style={S.textarea} rows={3} value={form.notes} onChange={set("notes")} />
              </div>
              <button type="button" style={S.btnPrimary}
                onClick={() => { if (validate()) setTab("preview"); }}>
                ✅ Validate & Preview
              </button>
            </div>
          )}

          {/* PROPOSAL TAB */}
          {tab === "proposal" && (
            <div style={S.card}>
              <div style={S.secTitle}><span style={S.dot}/>AI Proposal Generator</div>
              <div style={S.mb}>
                <label style={S.label}>Project Name</label>
                <input style={S.input} value={form.projectName} onChange={set("projectName")} placeholder="e.g. E-Commerce Website" />
              </div>
              <div style={S.mb}>
                <label style={S.label}>Project Description</label>
                <textarea style={S.textarea} rows={4} value={form.projectDesc} onChange={set("projectDesc")} placeholder="Describe deliverables, tech stack, goals…" />
              </div>
              <div style={S.row}>
                <div style={S.col}>
                  <label style={S.label}>Budget ({form.currency})</label>
                  {/* FIX 11: placeholder uses String() to avoid toFixed on empty string */}
                  <input type="number" style={S.input} value={form.budget} onChange={set("budget")} placeholder={String(total)} />
                </div>
                <div style={S.col}>
                  <label style={S.label}>Timeline</label>
                  <input style={S.input} value={form.timeline} onChange={set("timeline")} placeholder="e.g. 4 weeks" />
                </div>
              </div>
              <button type="button" style={S.btnPrimary} onClick={generateProposal} disabled={aiLoading}>
                {aiLoading
                  ? <span style={{ animation:"pulse 1s infinite" }}>✨ Generating…</span>
                  : "✨ Generate AI Proposal"}
              </button>
              {aiErr && <div style={{ color:C.danger, marginTop:"10px", fontSize:"12px" }}>{aiErr}</div>}
              {(aiLoading || aiText) && (
                <div style={S.aiBox}>
                  {aiLoading ? "Crafting your proposal…" : aiText}
                </div>
              )}
              {aiText && (
                <button type="button"
                  style={{ ...S.btnOutline, marginTop:"10px", width:"100%", color: copyOk ? C.success : C.accentHi }}
                  onClick={handleCopy}>
                  {copyOk ? "✅ Copied!" : "📋 Copy Proposal"}
                </button>
              )}
            </div>
          )}

          {/* PREVIEW TAB */}
          {tab === "preview" && (
            <div style={S.card}>
              <div style={S.secTitle}><span style={S.dot}/>Print Preview</div>
              <div ref={printRef} style={S.prev}>
                <div style={S.prevH}>
                  <div>
                    <div style={S.prevTitle}>INVOICE</div>
                    <div style={{ color:"#888", fontSize:"11px", marginTop:"3px" }}>#{form.invoiceNo}</div>
                  </div>
                  <div style={{ textAlign:"right", fontSize:"11px", lineHeight:"1.8" }}>
                    <div><strong>Date:</strong> {form.date}</div>
                    <div><strong>Due:</strong>  {form.dueDate || "—"}</div>
                  </div>
                </div>

                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"20px", marginBottom:"18px", fontSize:"11px" }}>
                  {[
                    ["FROM",    form.fromName, form.fromEmail, form.fromPhone, form.fromAddress],
                    ["BILL TO", form.toName,   form.toEmail,   form.toPhone,   form.toAddress],
                  ].map(([label, name, email, phone, addr]) => (
                    <div key={label}>
                      <div style={{ fontWeight:"bold", marginBottom:"4px", color:"#5b54e8", fontSize:"10px", letterSpacing:"1px" }}>{label}</div>
                      <div><strong>{name || "—"}</strong></div>
                      {email && <div>{email}</div>}
                      {phone && <div>{phone}</div>}
                      {addr  && <div style={{ whiteSpace:"pre-line", marginTop:"2px" }}>{addr}</div>}
                    </div>
                  ))}
                </div>

                <table style={{ width:"100%", borderCollapse:"collapse", fontSize:"11px" }}>
                  <thead>
                    <tr>
                      {["Description","Qty","Unit Rate","Amount"].map((h, i) => (
                        <th key={h} style={{ ...S.prevTh, textAlign: i > 1 ? "right" : "left" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {/* FIX 12: show all items with desc OR at least one filled — not silently drop rows */}
                    {items.filter(it => it.desc.trim() || Number(it.rate) > 0).map((it) => (
                      <tr key={it.id}>
                        <td style={S.prevTd}>{it.desc || "—"}</td>
                        <td style={{ ...S.prevTd, textAlign:"right" }}>{it.qty}</td>
                        <td style={{ ...S.prevTd, textAlign:"right" }}>{fmt(Number(it.rate), form.currency)}</td>
                        <td style={{ ...S.prevTd, textAlign:"right" }}>{fmt(round2(Number(it.qty)*Number(it.rate)), form.currency)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div style={{ textAlign:"right", marginTop:"12px", fontSize:"11px", lineHeight:"2" }}>
                  <div>Subtotal: <strong>{fmt(subtotal, form.currency)}</strong></div>
                  {Number(form.discount) > 0 && <div style={{ color:"#27ae60" }}>Discount ({form.discount}%): <strong>−{fmt(discAmt, form.currency)}</strong></div>}
                  {Number(form.tax)      > 0 && <div>Tax/VAT ({form.tax}%): <strong>{fmt(taxAmt, form.currency)}</strong></div>}
                  <div style={{ fontSize:"16px", marginTop:"6px", color:"#5b54e8", fontWeight:"bold" }}>
                    Total Due: {fmt(total, form.currency)}
                  </div>
                </div>

                {form.notes && (
                  <div style={{ marginTop:"16px", padding:"10px 14px", background:"#f5f5ff", borderRadius:"6px", fontSize:"11px", borderLeft:"3px solid #5b54e8" }}>
                    <strong>Notes:</strong> {form.notes}
                  </div>
                )}
                {aiText && (
                  <div style={{ marginTop:"16px", padding:"14px", background:"#f8f5ff", borderRadius:"8px", fontSize:"11px", borderLeft:"3px solid #5b54e8" }}>
                    <strong style={{ color:"#5b54e8", display:"block", marginBottom:"6px", fontSize:"10px", letterSpacing:"1px" }}>PROJECT PROPOSAL</strong>
                    <div style={{ whiteSpace:"pre-wrap", lineHeight:"1.7" }}>{aiText}</div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT */}
        <div style={{ display:"flex", flexDirection:"column", gap:"20px" }}>
          <div style={S.card}>
            <div style={S.secTitle}><span style={S.dot}/>Live Summary</div>
            {[
              ["Invoice #", form.invoiceNo || "—", C.accentHi],
              ["Client",   form.toName    || "—", C.text],
              ["Due Date", form.dueDate   || "—", C.text],
              // FIX 13: count only items with desc filled
              ["Items",    items.filter(it => it.desc.trim()).length, C.text],
            ].map(([k, v, col]) => (
              <div key={k} style={{ display:"flex", justifyContent:"space-between", marginBottom:"8px", fontSize:"12px" }}>
                <span style={{ color:C.muted }}>{k}</span>
                <span style={{ color:col }}>{v}</span>
              </div>
            ))}
            <hr style={S.divider}/>
            <div style={{ display:"flex", justifyContent:"space-between", fontSize:"12px", marginBottom:"4px" }}>
              <span style={{ color:C.muted }}>Subtotal</span><span>{fmt(subtotal, form.currency)}</span>
            </div>
            {Number(form.discount) > 0 && (
              <div style={{ display:"flex", justifyContent:"space-between", fontSize:"12px", marginBottom:"4px" }}>
                <span style={{ color:C.success }}>Discount</span>
                <span style={{ color:C.success }}>−{fmt(discAmt, form.currency)}</span>
              </div>
            )}
            {Number(form.tax) > 0 && (
              <div style={{ display:"flex", justifyContent:"space-between", fontSize:"12px", marginBottom:"4px" }}>
                <span style={{ color:C.muted }}>Tax</span><span>{fmt(taxAmt, form.currency)}</span>
              </div>
            )}
            <div style={{ display:"flex", justifyContent:"space-between", marginTop:"12px", fontSize:"22px", fontWeight:"bold", color:C.gold }}>
              <span>TOTAL</span><span>{fmt(total, form.currency)}</span>
            </div>
          </div>

          <div style={S.card}>
            <div style={S.secTitle}><span style={S.dot}/>Actions</div>
            <div style={{ display:"flex", flexDirection:"column", gap:"9px" }}>
              <button type="button" style={S.btnGreen}    onClick={handlePrint}>🖨 Print / Save PDF</button>
              <button type="button" style={S.btnPrimary}  onClick={() => { if (validate()) setTab("preview"); }}>✅ Validate & Preview</button>
              <button type="button" style={S.btnOutline}  onClick={() => setTab("proposal")}>✨ AI Proposal</button>
              <button type="button" style={{ ...S.btnOutline, color:C.muted, borderColor:C.border }} onClick={handleNew}>🗑 New Invoice</button>
            </div>
          </div>

          <div style={{ ...S.card, background:`linear-gradient(135deg,rgba(108,99,255,0.06),rgba(155,92,246,0.03))`, border:`1px solid rgba(108,99,255,0.18)` }}>
            <div style={S.secTitle}><span style={S.dot}/>Quick Guide</div>
            <div style={{ fontSize:"11px", color:C.muted, lineHeight:"2" }}>
              <div>① Fill <strong style={{ color:C.text }}>Invoice</strong> tab — info + items</div>
              <div>② Optionally generate <strong style={{ color:C.text }}>AI Proposal</strong></div>
              <div>③ <strong style={{ color:C.text }}>Validate & Preview</strong></div>
              <div>④ <strong style={{ color:C.text }}>Print → Save as PDF</strong></div>
              <div style={{ marginTop:"8px", color:C.accentHi }}>💡 "New Invoice" auto-increments #</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
