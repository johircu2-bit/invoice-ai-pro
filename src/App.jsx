import { useState, useEffect, useRef, useCallback } from "react";

// ═══════════════════════════════════════════════════════════
// THEME
// ═══════════════════════════════════════════════════════════
const T = {
  bg:       "#07080d",
  surface:  "#0e0f18",
  card:     "#13141f",
  cardHi:   "#181926",
  border:   "#1e2030",
  borderHi: "#2a2d45",
  accent:   "#5b6af0",
  accentHi: "#7b89f5",
  accentGlow:"rgba(91,106,240,0.18)",
  gold:     "#f0b429",
  green:    "#2dd4a0",
  red:      "#f5646e",
  text:     "#e8eaf6",
  muted:    "#6b6f8e",
  dim:      "#3a3d55",
};

// ═══════════════════════════════════════════════════════════
// CURRENCIES
// ═══════════════════════════════════════════════════════════
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

// ═══════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════
const fmt = (n, cur="USD") => {
  const cfg = CURRENCIES[cur] || CURRENCIES.USD;
  const num = Number(n);
  if (!isFinite(num)) return `${cfg.symbol}0.00`;
  try {
    return new Intl.NumberFormat(cfg.locale,{
      style:"currency", currency:cur,
      minimumFractionDigits: cur==="JPY"?0:2,
      maximumFractionDigits: cur==="JPY"?0:2,
    }).format(num);
  } catch { return `${cfg.symbol}${num.toFixed(2)}`; }
};
const today   = () => new Date().toISOString().slice(0,10);
const addDays = (d,n)=>{ const dt=new Date(d+"T00:00:00Z"); dt.setUTCDate(dt.getUTCDate()+n); return dt.toISOString().slice(0,10); };
const round2  = n => Math.round((n+Number.EPSILON)*100)/100;
const uid     = () => Math.random().toString(36).slice(2,9);
const newItem = () => ({ id:uid(), desc:"", qty:"1", rate:"0" });

// ═══════════════════════════════════════════════════════════
// LOCAL STORAGE
// ═══════════════════════════════════════════════════════════
const LS = {
  get:(k,def)=>{ try{ const v=localStorage.getItem(k); return v?JSON.parse(v):def; }catch{ return def; }},
  set:(k,v)=>{ try{ localStorage.setItem(k,JSON.stringify(v)); }catch{} },
};

const STATUS_COLORS = {
  Draft:   { bg:"#1e2030", color:T.muted   },
  Sent:    { bg:"rgba(91,106,240,0.15)", color:T.accentHi },
  Paid:    { bg:"rgba(45,212,160,0.15)", color:T.green    },
  Overdue: { bg:"rgba(245,100,110,0.15)", color:T.red     },
};

// ═══════════════════════════════════════════════════════════
// GLOBAL STYLES
// ═══════════════════════════════════════════════════════════
const GlobalStyles = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&family=Space+Mono:wght@400;700&display=swap');
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
    html{scroll-behavior:smooth}
    body{background:${T.bg};color:${T.text};font-family:'Outfit',sans-serif;font-size:14px;line-height:1.5;-webkit-font-smoothing:antialiased}
    input,textarea,select{font-family:'Outfit',sans-serif}
    input[type=number]::-webkit-inner-spin-button{opacity:0.4}
    input:focus,textarea:focus,select:focus{outline:none!important;border-color:${T.accent}!important;box-shadow:0 0 0 3px ${T.accentGlow}!important}
    button{cursor:pointer;font-family:'Outfit',sans-serif}
    button:active{transform:scale(0.97)}
    button:disabled{opacity:0.45;cursor:not-allowed;transform:none!important}
    ::-webkit-scrollbar{width:5px;height:5px}
    ::-webkit-scrollbar-track{background:${T.surface}}
    ::-webkit-scrollbar-thumb{background:${T.border};border-radius:4px}
    @keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
    @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}
    @keyframes spin{to{transform:rotate(360deg)}}
    .fade-in{animation:fadeIn 0.25s ease}
    @media(max-width:768px){
      .hide-mobile{display:none!important}
      .full-mobile{width:100%!important}
    }
  `}</style>
);

// ═══════════════════════════════════════════════════════════
// UI PRIMITIVES
// ═══════════════════════════════════════════════════════════
const Input = ({ label, error, style={}, ...props }) => (
  <div style={{ marginBottom:"14px", ...style }}>
    {label && <div style={{ fontSize:"11px", letterSpacing:"1px", color:T.muted, textTransform:"uppercase", marginBottom:"5px", fontWeight:600 }}>{label}</div>}
    <input style={{
      width:"100%", background:T.surface, border:`1px solid ${error?T.red:T.border}`,
      borderRadius:"8px", padding:"10px 12px", color:T.text, fontSize:"13px",
      transition:"border-color 0.2s,box-shadow 0.2s",
    }} {...props} />
    {error && <div style={{ color:T.red, fontSize:"11px", marginTop:"4px" }}>{error}</div>}
  </div>
);

const Textarea = ({ label, ...props }) => (
  <div style={{ marginBottom:"14px" }}>
    {label && <div style={{ fontSize:"11px", letterSpacing:"1px", color:T.muted, textTransform:"uppercase", marginBottom:"5px", fontWeight:600 }}>{label}</div>}
    <textarea style={{
      width:"100%", background:T.surface, border:`1px solid ${T.border}`,
      borderRadius:"8px", padding:"10px 12px", color:T.text, fontSize:"13px",
      resize:"vertical", minHeight:"72px", transition:"border-color 0.2s",
    }} {...props} />
  </div>
);

const Select = ({ label, children, ...props }) => (
  <div style={{ marginBottom:"14px" }}>
    {label && <div style={{ fontSize:"11px", letterSpacing:"1px", color:T.muted, textTransform:"uppercase", marginBottom:"5px", fontWeight:600 }}>{label}</div>}
    <select style={{
      width:"100%", background:T.surface, border:`1px solid ${T.border}`,
      borderRadius:"8px", padding:"10px 12px", color:T.text, fontSize:"13px",
      appearance:"none",
    }} {...props}>{children}</select>
  </div>
);

const Btn = ({ variant="primary", style={}, children, ...p }) => {
  const base = { border:"none", borderRadius:"9px", padding:"10px 18px", fontSize:"13px", fontWeight:600, display:"flex", alignItems:"center", justifyContent:"center", gap:"6px", transition:"opacity 0.15s,transform 0.1s", letterSpacing:"0.2px" };
  const variants = {
    primary:  { background:`linear-gradient(135deg,${T.accent},#7b5cf0)`, color:"#fff" },
    green:    { background:`linear-gradient(135deg,${T.green},#059669)`, color:"#0a0f0d" },
    outline:  { background:"transparent", color:T.accentHi, border:`1px solid ${T.accent}` },
    ghost:    { background:"transparent", color:T.muted, border:`1px solid ${T.border}` },
    danger:   { background:"transparent", color:T.red, border:`1px solid ${T.red}` },
  };
  return <button style={{ ...base, ...variants[variant], ...style }} {...p}>{children}</button>;
};

const Card = ({ children, style={} }) => (
  <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:"14px", padding:"20px", ...style }}>
    {children}
  </div>
);

const SectionTitle = ({ children, action }) => (
  <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"16px" }}>
    <div style={{ fontSize:"11px", letterSpacing:"2.5px", color:T.muted, textTransform:"uppercase", fontWeight:600, display:"flex", alignItems:"center", gap:"8px" }}>
      <div style={{ width:"4px", height:"14px", borderRadius:"2px", background:T.accent }} />
      {children}
    </div>
    {action}
  </div>
);

const StatusBadge = ({ status }) => {
  const s = STATUS_COLORS[status] || STATUS_COLORS.Draft;
  return (
    <span style={{ background:s.bg, color:s.color, borderRadius:"20px", padding:"3px 10px", fontSize:"11px", fontWeight:600, letterSpacing:"0.5px" }}>
      {status}
    </span>
  );
};

const Divider = () => <div style={{ borderTop:`1px solid ${T.border}`, margin:"16px 0" }} />;

// ═══════════════════════════════════════════════════════════
// ITEM ROW — mobile-friendly
// ═══════════════════════════════════════════════════════════
const ItemRow = ({ item, idx, onChange, onRemove, canRemove, currency, isMobile }) => {
  const lineTotal = round2(Number(item.qty||0)*Number(item.rate||0));
  const inp = (extra={}) => ({
    background:T.surface, border:`1px solid ${T.border}`, borderRadius:"8px",
    padding:"8px 10px", color:T.text, fontSize:"13px", width:"100%",
    transition:"border-color 0.2s", ...extra,
  });

  if (isMobile) {
    // Mobile: stacked layout
    return (
      <div style={{ background:T.cardHi, border:`1px solid ${T.border}`, borderRadius:"10px", padding:"12px", marginBottom:"10px" }} className="fade-in">
        <div style={{ display:"flex", gap:"8px", marginBottom:"8px" }}>
          <input style={{ ...inp(), flex:1 }} value={item.desc} placeholder="Description / Service"
            onChange={e=>onChange(idx,"desc",e.target.value)} />
          <button type="button" onClick={()=>canRemove&&onRemove(idx)} disabled={!canRemove}
            style={{ background:"transparent", border:`1px solid ${T.red}`, color:T.red, borderRadius:"7px", padding:"0 10px", fontSize:"12px", flexShrink:0 }}>✕</button>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:"8px", alignItems:"center" }}>
          <div>
            <div style={{ fontSize:"10px", color:T.muted, marginBottom:"3px" }}>QTY</div>
            <input type="number" style={{ ...inp(), textAlign:"right" }} value={item.qty} min="0.01" step="0.01"
              onChange={e=>onChange(idx,"qty",e.target.value)} />
          </div>
          <div>
            <div style={{ fontSize:"10px", color:T.muted, marginBottom:"3px" }}>RATE</div>
            <input type="number" style={{ ...inp(), textAlign:"right" }} value={item.rate} min="0" step="0.01"
              onChange={e=>onChange(idx,"rate",e.target.value)} />
          </div>
          <div>
            <div style={{ fontSize:"10px", color:T.muted, marginBottom:"3px" }}>AMOUNT</div>
            <div style={{ textAlign:"right", fontSize:"13px", fontWeight:600, color:T.accentHi, padding:"8px 10px", background:T.surface, borderRadius:"8px", border:`1px solid ${T.border}` }}>
              {fmt(lineTotal,currency)}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Desktop: grid layout
  return (
    <div style={{ display:"grid", gridTemplateColumns:"1fr 80px 100px 90px 32px", gap:"6px", alignItems:"center", marginBottom:"7px" }} className="fade-in">
      <input style={inp()} value={item.desc} placeholder="Description / Service"
        onChange={e=>onChange(idx,"desc",e.target.value)} />
      <input type="number" style={{ ...inp(), textAlign:"right" }} value={item.qty} min="0.01" step="0.01"
        onChange={e=>onChange(idx,"qty",e.target.value)} />
      <input type="number" style={{ ...inp(), textAlign:"right" }} value={item.rate} min="0" step="0.01"
        onChange={e=>onChange(idx,"rate",e.target.value)} />
      <div style={{ textAlign:"right", fontSize:"13px", fontWeight:600, color:T.accentHi, padding:"8px 10px", background:T.surface, borderRadius:"8px", border:`1px solid ${T.border}`, whiteSpace:"nowrap" }}>
        {fmt(lineTotal,currency)}
      </div>
      <button type="button" onClick={()=>canRemove&&onRemove(idx)} disabled={!canRemove}
        style={{ background:"transparent", border:`1px solid ${T.red}`, color:T.red, borderRadius:"7px", width:"28px", height:"28px", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"11px", flexShrink:0, opacity:canRemove?1:0.3 }}>✕</button>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════
// DASHBOARD VIEW
// ═══════════════════════════════════════════════════════════
const Dashboard = ({ invoices, onNew, onOpen }) => {
  const stats = {
    total:   invoices.length,
    paid:    invoices.filter(i=>i.status==="Paid").length,
    pending: invoices.filter(i=>i.status==="Sent").length,
    revenue: invoices.filter(i=>i.status==="Paid").reduce((s,i)=>s+i.total,0),
  };
  const recent = [...invoices].sort((a,b)=>b.updatedAt-a.updatedAt).slice(0,5);

  return (
    <div className="fade-in">
      {/* Stats */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))", gap:"12px", marginBottom:"24px" }}>
        {[
          { label:"Total Invoices", value:stats.total, icon:"📄", color:T.accentHi },
          { label:"Paid",           value:stats.paid,  icon:"✅", color:T.green },
          { label:"Pending",        value:stats.pending,icon:"⏳", color:T.gold },
          { label:"Revenue",        value:fmt(stats.revenue,"USD"), icon:"💰", color:T.gold, big:true },
        ].map(s => (
          <Card key={s.label} style={{ textAlign:"center" }}>
            <div style={{ fontSize:"22px", marginBottom:"6px" }}>{s.icon}</div>
            <div style={{ fontSize: s.big?"18px":"24px", fontWeight:700, color:s.color, fontFamily:"'Space Mono',monospace" }}>{s.value}</div>
            <div style={{ fontSize:"11px", color:T.muted, marginTop:"3px" }}>{s.label}</div>
          </Card>
        ))}
      </div>

      {/* Recent */}
      <Card>
        <SectionTitle action={<Btn variant="primary" style={{ padding:"7px 14px", fontSize:"12px" }} onClick={onNew}>+ New Invoice</Btn>}>
          Recent Invoices
        </SectionTitle>
        {recent.length === 0 ? (
          <div style={{ textAlign:"center", padding:"40px 0", color:T.muted }}>
            <div style={{ fontSize:"36px", marginBottom:"12px" }}>📭</div>
            <div>No invoices yet — create your first one!</div>
            <Btn variant="primary" style={{ margin:"16px auto 0", width:"fit-content" }} onClick={onNew}>+ Create Invoice</Btn>
          </div>
        ) : (
          <div>
            {/* Table header — hidden on mobile */}
            <div className="hide-mobile" style={{ display:"grid", gridTemplateColumns:"1fr 120px 100px 90px 80px", gap:"12px", padding:"0 8px 10px", borderBottom:`1px solid ${T.border}`, marginBottom:"8px" }}>
              {["Invoice","Client","Date","Amount","Status"].map(h=>(
                <div key={h} style={{ fontSize:"10px", color:T.muted, letterSpacing:"1.5px", textTransform:"uppercase", fontWeight:600 }}>{h}</div>
              ))}
            </div>
            {recent.map(inv=>(
              <div key={inv.id} onClick={()=>onOpen(inv.id)}
                style={{ display:"grid", gridTemplateColumns:"1fr 120px 100px 90px 80px", gap:"12px", padding:"10px 8px", borderRadius:"8px", cursor:"pointer", transition:"background 0.15s", alignItems:"center" }}
                onMouseEnter={e=>e.currentTarget.style.background=T.cardHi}
                onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                <div style={{ fontWeight:600, fontSize:"13px" }}>{inv.invoiceNo}</div>
                <div style={{ color:T.muted, fontSize:"12px", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{inv.toName||"—"}</div>
                <div style={{ color:T.muted, fontSize:"12px" }} className="hide-mobile">{inv.date}</div>
                <div style={{ fontWeight:600, fontFamily:"'Space Mono',monospace", fontSize:"12px" }}>{fmt(inv.total, inv.currency)}</div>
                <div><StatusBadge status={inv.status} /></div>
              </div>
            ))}
            {invoices.length > 5 && (
              <div style={{ textAlign:"center", marginTop:"12px" }}>
                <Btn variant="ghost" style={{ fontSize:"12px", padding:"7px 14px" }} onClick={()=>{}}>View all {invoices.length} invoices</Btn>
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════
// INVOICE EDITOR
// ═══════════════════════════════════════════════════════════
const InvoiceEditor = ({ invoice, clients, onSave, onDelete, onBack, isMobile }) => {
  const [form, setForm] = useState(invoice);
  const [items, setItems] = useState(invoice.items||[newItem()]);
  const [tab, setTab] = useState("details"); // details | items | preview
  const [aiText, setAiText] = useState(invoice.aiProposal||"");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiErr, setAiErr] = useState("");
  const [saved, setSaved] = useState(false);
  const printRef = useRef(null);

  const set = k => e => setForm(f=>({...f,[k]:e.target.value}));

  // Calculations
  const subtotal  = round2(items.reduce((s,it)=>s+round2(Number(it.qty||0)*Number(it.rate||0)),0));
  const discAmt   = round2(subtotal*(Math.min(Math.max(Number(form.discount)||0,0),100))/100);
  const afterDisc = round2(subtotal-discAmt);
  const taxAmt    = round2(afterDisc*(Math.min(Math.max(Number(form.tax)||0,0),100))/100);
  const total     = round2(afterDisc+taxAmt);

  const updateItem = useCallback((i,k,v)=>setItems(arr=>arr.map((it,idx)=>idx===i?{...it,[k]:v}:it)),[]);
  const addItem    = ()=>setItems(arr=>[...arr,newItem()]);
  const removeItem = useCallback(i=>setItems(arr=>arr.length>1?arr.filter((_,idx)=>idx!==i):arr),[]);

  const handleSave = (status) => {
    const updated = { ...form, items, total, subtotal, aiProposal:aiText, updatedAt:Date.now(), status:status||form.status };
    onSave(updated);
    setSaved(true);
    setTimeout(()=>setSaved(false),2000);
  };

  const handlePrint = () => {
    if (tab !== "preview") { setTab("preview"); setTimeout(handlePrint, 500); return; }
    if (!printRef.current) return;
    const w = window.open("","_blank");
    if (!w) { alert("Allow popups to print/save PDF"); return; }
    w.document.write(`<!DOCTYPE html><html><head><title>${form.invoiceNo}</title>
    <style>*{box-sizing:border-box}body{margin:0;padding:24px;font-family:'Outfit',Georgia,serif;font-size:12px;color:#111}
    table{width:100%;border-collapse:collapse}th{background:#5b6af0;color:#fff;padding:8px 10px;text-align:left;font-size:10px}
    td{padding:8px 10px;border-bottom:1px solid #eee}.grid2{display:grid;grid-template-columns:1fr 1fr;gap:16px}
    @media print{body{padding:12px}}</style></head>
    <body>${printRef.current.innerHTML}</body></html>`);
    w.document.close(); w.focus(); setTimeout(()=>w.print(),300);
  };

  const generateProposal = async () => {
    setAiLoading(true); setAiErr(""); setAiText("");
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages",{
        method:"POST", headers:{"Content-Type":"application/json"},
        body:JSON.stringify({ model:"claude-sonnet-4-20250514", max_tokens:1000,
          messages:[{ role:"user", content:`Write a professional business proposal:\nClient: ${form.toName||"Client"}\nProject: ${form.projectName||"Project"}\nDescription: ${form.projectDesc||"Services"}\nBudget: ${fmt(form.budget||total,form.currency)}\nTimeline: ${form.timeline||"TBD"}\nProvider: ${form.fromName||"Provider"}\n\nWrite 4 sections: 1.Executive Summary 2.Scope & Deliverables (bullets) 3.Timeline & Milestones 4.Investment & Terms. Be concise and professional.` }]
        }),
      });
      if (!res.ok) throw new Error(`API ${res.status}`);
      const d = await res.json();
      const text = d.content?.map(c=>c.text||"").join("")||"";
      if (!text) throw new Error("Empty response");
      setAiText(text);
    } catch(err) { setAiErr(`Failed: ${err.message}`); }
    finally { setAiLoading(false); }
  };

  const tabs = isMobile
    ? [["details","📋"],["items","📦"],["preview","👁"]]
    : [["details","📋 Details"],["items","📦 Items"],["proposal","✨ Proposal"],["preview","👁 Preview"]];

  return (
    <div className="fade-in">
      {/* Top bar */}
      <div style={{ display:"flex", alignItems:"center", gap:"12px", marginBottom:"20px", flexWrap:"wrap" }}>
        <button type="button" onClick={onBack}
          style={{ background:T.card, border:`1px solid ${T.border}`, color:T.muted, borderRadius:"8px", padding:"8px 12px", fontSize:"12px", display:"flex", alignItems:"center", gap:"6px" }}>
          ← Back
        </button>
        <div style={{ fontFamily:"'Space Mono',monospace", fontSize:"15px", fontWeight:700, flex:1, color:T.text }}>
          {form.invoiceNo}
        </div>
        <Select style={{ margin:0, width:"auto" }} value={form.status} onChange={set("status")}>
          {["Draft","Sent","Paid","Overdue"].map(s=><option key={s}>{s}</option>)}
        </Select>
        <Btn variant="ghost" style={{ padding:"8px 14px", fontSize:"12px" }} onClick={handlePrint}>🖨 PDF</Btn>
        <Btn variant="green" style={{ padding:"8px 16px", fontSize:"12px" }} onClick={()=>handleSave()}>
          {saved?"✅ Saved!":"💾 Save"}
        </Btn>
      </div>

      {/* Tabs */}
      <div style={{ display:"flex", gap:"4px", background:T.surface, borderRadius:"10px", padding:"4px", marginBottom:"20px", overflowX:"auto" }}>
        {tabs.map(([k,lbl])=>(
          <button type="button" key={k} onClick={()=>setTab(k)} style={{
            flex:1, minWidth:"fit-content", padding:"9px 10px", borderRadius:"7px", border:"none",
            background: tab===k ? T.accent : "transparent",
            color: tab===k ? "#fff" : T.muted,
            fontSize:"12px", fontWeight:600, whiteSpace:"nowrap", transition:"all 0.2s",
          }}>{lbl}</button>
        ))}
      </div>

      <div style={{ display:"grid", gridTemplateColumns: isMobile?"1fr":"1fr 300px", gap:"20px" }}>
        {/* LEFT PANEL */}
        <div>
          {/* DETAILS TAB */}
          {tab==="details" && (
            <Card className="fade-in">
              <SectionTitle>Invoice Info</SectionTitle>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"0 14px" }}>
                <Input label="Invoice #" value={form.invoiceNo} onChange={set("invoiceNo")} />
                <Select label="Currency" value={form.currency} onChange={set("currency")}>
                  {Object.keys(CURRENCIES).map(c=><option key={c} value={c}>{c} {CURRENCIES[c].symbol}</option>)}
                </Select>
                <Input label="Issue Date" type="date" value={form.date} onChange={set("date")} />
                <Input label="Due Date" type="date" value={form.dueDate} onChange={set("dueDate")} />
              </div>

              <Divider/>
              <SectionTitle>From (You)</SectionTitle>
              <Input label="Name / Company *" value={form.fromName} onChange={set("fromName")} placeholder="Your name or company" />
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"0 14px" }}>
                <Input label="Email" type="email" value={form.fromEmail} onChange={set("fromEmail")} placeholder="you@email.com" />
                <Input label="Phone" value={form.fromPhone} onChange={set("fromPhone")} placeholder="+880..." />
              </div>
              <Textarea label="Address" value={form.fromAddress} onChange={set("fromAddress")} placeholder="Street, City, Country" />

              <Divider/>
              <SectionTitle>Bill To (Client)</SectionTitle>
              <Input label="Client Name *" value={form.toName} onChange={set("toName")} placeholder="Client / Company" />
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"0 14px" }}>
                <Input label="Email" type="email" value={form.toEmail} onChange={set("toEmail")} placeholder="client@email.com" />
                <Input label="Phone" value={form.toPhone} onChange={set("toPhone")} placeholder="+1..." />
              </div>
              <Textarea label="Address" value={form.toAddress} onChange={set("toAddress")} placeholder="Client address" />

              <Divider/>
              <Textarea label="Notes / Payment Terms" value={form.notes} onChange={set("notes")} />
            </Card>
          )}

          {/* ITEMS TAB */}
          {tab==="items" && (
            <Card className="fade-in">
              <SectionTitle>Line Items</SectionTitle>

              {!isMobile && (
                <div style={{ display:"grid", gridTemplateColumns:"1fr 80px 100px 90px 32px", gap:"6px", marginBottom:"8px", padding:"0 2px" }}>
                  {[["Description","left"],["Qty","right"],["Rate","right"],["Amount","right"],["",""]].map(([h,a])=>(
                    <div key={h} style={{ fontSize:"10px", color:T.muted, letterSpacing:"1.5px", textTransform:"uppercase", fontWeight:600, textAlign:a }}>{h}</div>
                  ))}
                </div>
              )}

              {items.map((it,i)=>(
                <ItemRow key={it.id} item={it} idx={i}
                  onChange={updateItem} onRemove={removeItem}
                  canRemove={items.length>1} currency={form.currency} isMobile={isMobile} />
              ))}

              <Btn type="button" variant="outline" style={{ width:"100%", marginTop:"8px", padding:"9px" }} onClick={addItem}>
                + Add Line Item
              </Btn>

              <Divider/>

              {/* Totals */}
              <div style={{ background:T.surface, borderRadius:"10px", padding:"14px" }}>
                {[
                  ["Subtotal", fmt(subtotal,form.currency), false],
                  ...(Number(form.discount)>0?[["Discount", `-${fmt(discAmt,form.currency)}`, true]]:[]),
                  ...(Number(form.tax)>0?[["Tax Amount", fmt(taxAmt,form.currency), false]]:[]),
                ].map(([label,value,green])=>(
                  <div key={label} style={{ display:"flex", justifyContent:"space-between", padding:"4px 0", fontSize:"13px" }}>
                    <span style={{ color:T.muted }}>{label}</span>
                    <span style={{ color:green?T.green:T.text }}>{value}</span>
                  </div>
                ))}
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"10px", margin:"12px 0 8px" }}>
                  <div>
                    <div style={{ fontSize:"10px", color:T.muted, letterSpacing:"1px", marginBottom:"4px" }}>DISCOUNT %</div>
                    <input type="number" min="0" max="100" step="0.1" value={form.discount} onChange={set("discount")}
                      style={{ width:"100%", background:T.card, border:`1px solid ${T.border}`, borderRadius:"7px", padding:"7px 10px", color:T.text, fontSize:"13px", textAlign:"right" }} />
                  </div>
                  <div>
                    <div style={{ fontSize:"10px", color:T.muted, letterSpacing:"1px", marginBottom:"4px" }}>TAX / VAT %</div>
                    <input type="number" min="0" max="100" step="0.1" value={form.tax} onChange={set("tax")}
                      style={{ width:"100%", background:T.card, border:`1px solid ${T.border}`, borderRadius:"7px", padding:"7px 10px", color:T.text, fontSize:"13px", textAlign:"right" }} />
                  </div>
                </div>
                <div style={{ display:"flex", justifyContent:"space-between", borderTop:`1px solid ${T.border}`, paddingTop:"12px", marginTop:"4px", fontSize:"18px", fontWeight:700, color:T.gold, fontFamily:"'Space Mono',monospace" }}>
                  <span>TOTAL DUE</span>
                  <span>{fmt(total,form.currency)}</span>
                </div>
              </div>
            </Card>
          )}

          {/* PROPOSAL TAB */}
          {tab==="proposal" && (
            <Card className="fade-in">
              <SectionTitle>AI Proposal Generator</SectionTitle>
              <Input label="Project Name" value={form.projectName||""} onChange={set("projectName")} placeholder="e.g. E-Commerce Website" />
              <Textarea label="Project Description" value={form.projectDesc||""} onChange={set("projectDesc")} placeholder="Describe deliverables, tech stack, goals…" />
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"0 14px" }}>
                <Input label={`Budget (${form.currency})`} type="number" value={form.budget||""} onChange={set("budget")} placeholder={String(total)} />
                <Input label="Timeline" value={form.timeline||""} onChange={set("timeline")} placeholder="e.g. 4 weeks" />
              </div>
              <Btn variant="primary" style={{ width:"100%" }} onClick={generateProposal} disabled={aiLoading}>
                {aiLoading ? <span style={{ animation:"pulse 1s infinite" }}>✨ Generating…</span> : "✨ Generate AI Proposal"}
              </Btn>
              {aiErr && <div style={{ color:T.red, fontSize:"12px", marginTop:"10px" }}>{aiErr}</div>}
              {(aiLoading||aiText) && (
                <div style={{ background:`linear-gradient(135deg,rgba(91,106,240,0.07),rgba(123,89,240,0.04))`, border:`1px solid rgba(91,106,240,0.2)`, borderRadius:"10px", padding:"14px", marginTop:"14px", fontSize:"12px", lineHeight:"1.8", whiteSpace:"pre-wrap", maxHeight:"300px", overflowY:"auto" }}>
                  {aiLoading?"Crafting your proposal…":aiText}
                </div>
              )}
            </Card>
          )}

          {/* PREVIEW TAB */}
          {tab==="preview" && (
            <Card className="fade-in">
              <SectionTitle>Print Preview</SectionTitle>
              <div ref={printRef} style={{ background:"#fff", color:"#111", borderRadius:"10px", padding:"32px", fontFamily:"Georgia,serif", fontSize:"12px", lineHeight:"1.6" }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:"24px" }}>
                  <div>
                    <div style={{ fontSize:"30px", fontWeight:900, color:"#5b6af0", letterSpacing:"5px", fontFamily:"sans-serif" }}>INVOICE</div>
                    <div style={{ color:"#888", fontSize:"11px", marginTop:"3px", fontFamily:"monospace" }}>#{form.invoiceNo}</div>
                  </div>
                  <div style={{ textAlign:"right", fontSize:"11px", lineHeight:"1.9" }}>
                    <div><strong>Date:</strong> {form.date}</div>
                    <div><strong>Due:</strong> {form.dueDate||"—"}</div>
                    <div style={{ marginTop:"4px" }}><StatusBadge status={form.status}/></div>
                  </div>
                </div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"20px", marginBottom:"20px", fontSize:"11px" }}>
                  {[["FROM",form.fromName,form.fromEmail,form.fromPhone,form.fromAddress],
                    ["BILL TO",form.toName,form.toEmail,form.toPhone,form.toAddress]].map(([lbl,name,email,phone,addr])=>(
                    <div key={lbl}>
                      <div style={{ fontWeight:700, color:"#5b6af0", fontSize:"10px", letterSpacing:"1px", marginBottom:"5px" }}>{lbl}</div>
                      <div><strong>{name||"—"}</strong></div>
                      {email&&<div>{email}</div>}
                      {phone&&<div>{phone}</div>}
                      {addr&&<div style={{ whiteSpace:"pre-line", marginTop:"2px" }}>{addr}</div>}
                    </div>
                  ))}
                </div>
                <table style={{ width:"100%", borderCollapse:"collapse", fontSize:"11px" }}>
                  <thead>
                    <tr>{["Description","Qty","Rate","Amount"].map((h,i)=>(
                      <th key={h} style={{ background:"#5b6af0", color:"#fff", padding:"8px 10px", textAlign:i>1?"right":"left", fontSize:"10px", letterSpacing:"1px" }}>{h}</th>
                    ))}</tr>
                  </thead>
                  <tbody>
                    {items.filter(it=>it.desc.trim()||Number(it.rate)>0).map(it=>(
                      <tr key={it.id}>
                        <td style={{ padding:"7px 10px", borderBottom:"1px solid #f0f0f0" }}>{it.desc||"—"}</td>
                        <td style={{ padding:"7px 10px", borderBottom:"1px solid #f0f0f0", textAlign:"right" }}>{it.qty}</td>
                        <td style={{ padding:"7px 10px", borderBottom:"1px solid #f0f0f0", textAlign:"right" }}>{fmt(it.rate,form.currency)}</td>
                        <td style={{ padding:"7px 10px", borderBottom:"1px solid #f0f0f0", textAlign:"right", fontWeight:600 }}>{fmt(round2(Number(it.qty)*Number(it.rate)),form.currency)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div style={{ textAlign:"right", marginTop:"14px", fontSize:"11px", lineHeight:"2.2" }}>
                  <div>Subtotal: <strong>{fmt(subtotal,form.currency)}</strong></div>
                  {Number(form.discount)>0&&<div style={{ color:"#27ae60" }}>Discount ({form.discount}%): <strong>−{fmt(discAmt,form.currency)}</strong></div>}
                  {Number(form.tax)>0&&<div>Tax ({form.tax}%): <strong>{fmt(taxAmt,form.currency)}</strong></div>}
                  <div style={{ fontSize:"18px", color:"#5b6af0", fontWeight:700, marginTop:"6px" }}>Total: {fmt(total,form.currency)}</div>
                </div>
                {form.notes&&(
                  <div style={{ marginTop:"18px", padding:"12px", background:"#f5f6ff", borderRadius:"6px", fontSize:"11px", borderLeft:"3px solid #5b6af0" }}>
                    <strong>Notes:</strong> {form.notes}
                  </div>
                )}
                {aiText&&(
                  <div style={{ marginTop:"18px", padding:"14px", background:"#f8f5ff", borderRadius:"8px", fontSize:"11px", borderLeft:"3px solid #5b6af0" }}>
                    <strong style={{ color:"#5b6af0", display:"block", marginBottom:"8px", letterSpacing:"1px", fontSize:"10px" }}>PROJECT PROPOSAL</strong>
                    <div style={{ whiteSpace:"pre-wrap", lineHeight:"1.7" }}>{aiText}</div>
                  </div>
                )}
              </div>
            </Card>
          )}
        </div>

        {/* RIGHT PANEL — summary */}
        {!isMobile && (
          <div>
            <Card style={{ position:"sticky", top:"20px" }}>
              <SectionTitle>Summary</SectionTitle>
              {[
                ["Invoice", form.invoiceNo||"—", T.accentHi],
                ["Client",  form.toName||"—",    T.text],
                ["Due",     form.dueDate||"—",    T.text],
                ["Status",  null,                 null],
              ].map(([k,v,c])=>(
                <div key={k} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"10px", fontSize:"12px" }}>
                  <span style={{ color:T.muted }}>{k}</span>
                  {k==="Status" ? <StatusBadge status={form.status}/> : <span style={{ color:c }}>{v}</span>}
                </div>
              ))}
              <Divider/>
              <div style={{ display:"flex", justifyContent:"space-between", fontSize:"12px", marginBottom:"5px" }}>
                <span style={{ color:T.muted }}>Subtotal</span><span>{fmt(subtotal,form.currency)}</span>
              </div>
              {Number(form.discount)>0&&(
                <div style={{ display:"flex", justifyContent:"space-between", fontSize:"12px", marginBottom:"5px" }}>
                  <span style={{ color:T.green }}>Discount</span><span style={{ color:T.green }}>−{fmt(discAmt,form.currency)}</span>
                </div>
              )}
              {Number(form.tax)>0&&(
                <div style={{ display:"flex", justifyContent:"space-between", fontSize:"12px", marginBottom:"5px" }}>
                  <span style={{ color:T.muted }}>Tax</span><span>{fmt(taxAmt,form.currency)}</span>
                </div>
              )}
              <div style={{ display:"flex", justifyContent:"space-between", marginTop:"12px", fontSize:"20px", fontWeight:700, color:T.gold, fontFamily:"'Space Mono',monospace" }}>
                <span>TOTAL</span><span>{fmt(total,form.currency)}</span>
              </div>
              <Divider/>
              <div style={{ display:"flex", flexDirection:"column", gap:"8px" }}>
                <Btn variant="green" onClick={()=>handleSave("Paid")} style={{ width:"100%" }}>✅ Mark as Paid</Btn>
                <Btn variant="primary" onClick={()=>{setTab("preview");}} style={{ width:"100%" }}>👁 Preview</Btn>
                <Btn variant="outline" onClick={handlePrint} style={{ width:"100%" }}>🖨 Print / PDF</Btn>
                <Btn variant="ghost" onClick={()=>handleSave("Sent")} style={{ width:"100%" }}>📤 Mark as Sent</Btn>
                <Btn variant="danger" onClick={()=>{if(confirm("Delete this invoice?"))onDelete(invoice.id);}} style={{ width:"100%" }}>🗑 Delete</Btn>
              </div>
            </Card>
          </div>
        )}

        {/* Mobile bottom actions */}
        {isMobile && (
          <div style={{ display:"flex", gap:"8px", flexWrap:"wrap" }}>
            <Btn variant="green" style={{ flex:1 }} onClick={()=>handleSave()}>💾 Save</Btn>
            <Btn variant="outline" style={{ flex:1 }} onClick={handlePrint}>🖨 PDF</Btn>
            <Btn variant="ghost" style={{ flex:1 }} onClick={()=>handleSave("Paid")}>✅ Paid</Btn>
          </div>
        )}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════════════
let _invNum = 0;
const nextInvNo = (invoices) => {
  const nums = invoices.map(i=>parseInt(i.invoiceNo?.replace(/\D/g,""))||0);
  const max  = nums.length ? Math.max(...nums) : 0;
  return `INV-${String(max+1).padStart(4,"0")}`;
};

export default function App() {
  const [invoices, setInvoices] = useState(()=>LS.get("inv_invoices",[]));
  const [view, setView]         = useState("dashboard"); // dashboard | editor
  const [activeId, setActiveId] = useState(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth<768);

  useEffect(()=>{
    const handler = ()=>setIsMobile(window.innerWidth<768);
    window.addEventListener("resize",handler);
    return ()=>window.removeEventListener("resize",handler);
  },[]);

  useEffect(()=>{ LS.set("inv_invoices",invoices); },[invoices]);

  const createNew = () => {
    const inv = {
      id: uid(),
      invoiceNo: nextInvNo(invoices),
      date: today(), dueDate: addDays(today(),30),
      fromName:"", fromEmail:"", fromAddress:"", fromPhone:"",
      toName:"",   toEmail:"",   toAddress:"",   toPhone:"",
      currency:"USD", tax:"0", discount:"0",
      notes:"Payment due within 30 days. Thank you for your business.",
      projectName:"", projectDesc:"", budget:"", timeline:"",
      items:[newItem()], total:0, subtotal:0,
      status:"Draft", aiProposal:"",
      createdAt:Date.now(), updatedAt:Date.now(),
    };
    setInvoices(prev=>[inv,...prev]);
    setActiveId(inv.id);
    setView("editor");
  };

  const openInvoice = (id) => { setActiveId(id); setView("editor"); };

  const saveInvoice = (updated) => {
    setInvoices(prev=>prev.map(i=>i.id===updated.id?updated:i));
  };

  const deleteInvoice = (id) => {
    setInvoices(prev=>prev.filter(i=>i.id!==id));
    setView("dashboard");
  };

  const activeInvoice = invoices.find(i=>i.id===activeId);

  return (
    <>
      <GlobalStyles/>
      <div style={{ minHeight:"100vh", background:T.bg }}>

        {/* Header */}
        <header style={{
          background:`linear-gradient(135deg,${T.surface},#0a0b14)`,
          borderBottom:`1px solid ${T.border}`,
          padding: isMobile?"14px 16px":"16px 32px",
          display:"flex", alignItems:"center", justifyContent:"space-between",
          position:"sticky", top:0, zIndex:100, backdropFilter:"blur(20px)",
        }}>
          <div style={{ display:"flex", alignItems:"center", gap:"10px" }}>
            {view==="editor" && (
              <button type="button" onClick={()=>setView("dashboard")}
                style={{ background:T.card, border:`1px solid ${T.border}`, color:T.muted, borderRadius:"7px", padding:"6px 10px", fontSize:"12px" }}>
                ←
              </button>
            )}
            <div style={{ fontFamily:"'Space Mono',monospace", fontSize: isMobile?"17px":"21px", fontWeight:700, letterSpacing:"2px", color:T.text }}>
              INVOICE<span style={{ color:T.accent }}>AI</span>
              <span style={{ fontFamily:"'Outfit',sans-serif", background:T.accentGlow, border:`1px solid ${T.accent}`, color:T.accentHi, borderRadius:"20px", padding:"2px 8px", fontSize:"10px", marginLeft:"8px", letterSpacing:"1px", fontWeight:600 }}>PRO</span>
            </div>
          </div>
          {view==="dashboard" && (
            <Btn variant="primary" style={{ padding:"9px 18px", fontSize:"12px" }} onClick={createNew}>
              + New Invoice
            </Btn>
          )}
        </header>

        {/* Main */}
        <main style={{ maxWidth:"1200px", margin:"0 auto", padding: isMobile?"16px":"28px 24px" }}>
          {view==="dashboard" && (
            <Dashboard invoices={invoices} onNew={createNew} onOpen={openInvoice}/>
          )}
          {view==="editor" && activeInvoice && (
            <InvoiceEditor
              invoice={activeInvoice}
              onSave={saveInvoice}
              onDelete={deleteInvoice}
              onBack={()=>setView("dashboard")}
              isMobile={isMobile}
            />
          )}
        </main>
      </div>
    </>
  );
}
