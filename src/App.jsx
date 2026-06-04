import { useState, useMemo, useEffect, useCallback } from "react";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║  ⚠  CREDENCIALES EXPUESTAS — Leer antes de desplegar en producción         ║
// ║                                                                              ║
// ║  Firebase y EmailJS están hardcodeados en el bundle del cliente.            ║
// ║  Cualquiera que inspeccione el código puede extraerlos.                     ║
// ║                                                                              ║
// ║  Para protegerlos:                                                           ║
// ║  1. Migrar a Vite o CRA con soporte .env                                    ║
// ║  2. Mover cada clave a VITE_FIREBASE_* / REACT_APP_FIREBASE_*               ║
// ║  3. Agregar .env al .gitignore antes del primer commit                      ║
// ║  4. Restringir la API Key de Firebase en console.firebase.google.com        ║
// ╚══════════════════════════════════════════════════════════════════════════════╝
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyDZij70_7ty4BL4Jh9BAwwjkOOZpYdEJt0",
  authDomain: "gestion-operativa-dadt.firebaseapp.com",
  projectId: "gestion-operativa-dadt",
  storageBucket: "gestion-operativa-dadt.firebasestorage.app",
  messagingSenderId: "260033156668",
  appId: "1:260033156668:web:b5d43eeec8f99f66abd539"
};
const fbApp = initializeApp(FIREBASE_CONFIG);
const db    = getFirestore(fbApp);

// ─── Hook con manejo de errores de Firebase ───────────────────────────────────
// Si la conexión cae, errorFb contiene el mensaje de error en lugar de congelar.
function useColeccion(nombre) {
  const [datos,    setDatos]    = useState([]);
  const [cargando, setCargando] = useState(true);
  const [errorFb,  setErrorFb]  = useState(null);
  useEffect(() => {
    setErrorFb(null);
    const unsub = onSnapshot(
      collection(db, nombre),
      snap => {
        setDatos(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        setCargando(false);
        setErrorFb(null);
      },
      err => {
        console.error(`[Firebase/${nombre}]`, err);
        setCargando(false);
        setErrorFb(`Sin conexión (${nombre}): ${err.message}`);
      }
    );
    return unsub;
  }, [nombre]);
  return [datos, cargando, errorFb];
}

// ─── Primitivas de escritura ──────────────────────────────────────────────────
// Firebase genera su propio id en addDoc — se descarta cualquier id local.
async function fbAgregar(col, item)          { const { id: _, ...d } = item; return addDoc(collection(db, col), d); }
async function fbActualizar(col, id, cambios) { return updateDoc(doc(db, col, id), cambios); }
async function fbEliminar(col, id)            { return deleteDoc(doc(db, col, id)); }

// ─── Factory de operaciones con manejo de error por módulo ───────────────────
function mkFb(col, addToast) {
  return {
    agregar:    async (item)         => { try { return await fbAgregar(col, item);           } catch { addToast("Error al guardar. Verifica tu conexión.", false); } },
    actualizar: async (id, cambios)  => { try { return await fbActualizar(col, id, cambios); } catch { addToast("Error al actualizar. Verifica tu conexión.", false); } },
    eliminar:   async (id)           => { try { return await fbEliminar(col, id);            } catch { addToast("Error al eliminar. Verifica tu conexión.", false); } },
  };
}

// ─── EmailJS ──────────────────────────────────────────────────────────────────
// ⚠ Mover a variables de entorno (ver advertencia arriba).
const EMAILJS_CONFIG = {
  SERVICE_ID:          "gestion_operativa",
  TEMPLATE_ASIGNACION: "template_04yxyyn",
  TEMPLATE_VENCIMIENTO:"template_n68j7it",
  TEMPLATE_SOE:        "TU_TEMPLATE_SOE_ID",
  PUBLIC_KEY:          "Mt6cb7NrWs_-YsfPP",
};
const CORREOS = {
  "Macarena Godoy":  "macarena.godoy@redsalud.gob.cl",
  "Carlos Faunes":   "carlos.faunes@redsalud.gob.cl",
  "Constanza Jara":  "constanza.jarau@redsalud.gob.cl",
  "Nadia Rufatt":    "nadia.rufatt@redsalud.gob.cl",
  "Tomas Chavez":    "tomas.chavez.g@redsalud.gob.cl",
  "Sebastian Soto":  "sebastian.soto.c@redsalud.gob.cl",
};
const JEFATURAS = {
  "Macarena Godoy": "macarena.godoy@redsalud.gob.cl",
  "Sebastian Soto": "sebastian.soto.c@redsalud.gob.cl",
};

async function enviarCorreo(templateId, params) {
  try {
    const res = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ service_id: EMAILJS_CONFIG.SERVICE_ID, template_id: templateId, user_id: EMAILJS_CONFIG.PUBLIC_KEY, template_params: params }),
    });
    return res.status === 200;
  } catch { return false; }
}
async function notificarAsignacion(tarea) {
  const correo = CORREOS[tarea.responsable]; if (!correo) return false;
  return enviarCorreo(EMAILJS_CONFIG.TEMPLATE_ASIGNACION, { to_email: correo, to_name: tarea.responsable, task_title: tarea.titulo, task_priority: tarea.prioridad.toUpperCase(), task_due: tarea.fechaTermino, task_description: tarea.descripcion || "Sin descripción" });
}
async function notificarVencimiento(tarea, diasRestantes) {
  const correo = CORREOS[tarea.responsable]; if (!correo) return false;
  return enviarCorreo(EMAILJS_CONFIG.TEMPLATE_VENCIMIENTO, { to_email: correo, to_name: tarea.responsable, task_title: tarea.titulo, task_due: tarea.fechaTermino, days_left: diasRestantes, task_priority: tarea.prioridad.toUpperCase() });
}
async function notificarSOEJefaturas(solicitud) {
  const resultados = await Promise.all(Object.entries(JEFATURAS).map(([nombre, correo]) =>
    enviarCorreo(EMAILJS_CONFIG.TEMPLATE_SOE, { to_email: correo, to_name: nombre, solicitante: solicitud.solicitante, descripcion: solicitud.descripcion, horas_extra: solicitud.horasExtra, fecha: solicitud.fecha })
  ));
  return resultados.some(Boolean);
}

// ─── Paleta y estilos ─────────────────────────────────────────────────────────
const G = {
  bg: "#F7F8FC", surface: "#FFFFFF", surfaceHover: "#F0F4FF",
  border: "#DDE2EF", borderLight: "#EEF1F8",
  accent: "#1A56DB", accentLight: "#EBF0FD",
  accentGreen: "#057A55", accentGreenLight: "#E3F8EE",
  accentOrange: "#C27803", accentOrangeLight: "#FDF3E3",
  accentRed: "#C81E1E", accentRedLight: "#FDE8E8",
  accentPurple: "#6C2BD9", accentYellow: "#92400E",
  text: "#111928", textMuted: "#6B7280", textDim: "#9CA3AF",
};
const css = {
  app:      { fontFamily: "'Inter','Segoe UI',system-ui,sans-serif", background: G.bg, color: G.text, minHeight: "100vh", display: "flex", flexDirection: "column" },
  header:   { background: "#FFFFFF", borderBottom: `1px solid ${G.border}`, padding: "14px 28px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 100, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" },
  logoText: { fontSize: 15, fontWeight: 700, color: G.accent, letterSpacing: "0.01em" },
  nav:      { display: "flex", gap: 4, flexWrap: "wrap" },
  navBtn:   (a) => ({ padding: "7px 16px", fontSize: 12, fontFamily: "inherit", fontWeight: a ? 600 : 400, background: a ? G.accent : "transparent", color: a ? "#fff" : G.textMuted, border: `1px solid ${a ? G.accent : G.border}`, borderRadius: 6, cursor: "pointer", transition: "all .15s" }),
  main:     { flex: 1, padding: "28px", maxWidth: 1400, width: "100%", margin: "0 auto" },
  sectionTitle: { fontSize: 13, fontWeight: 600, color: G.text, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 },
  badge:    (c) => ({ display: "inline-block", padding: "3px 10px", borderRadius: 99, fontSize: 11, fontWeight: 600, background: c + "18", color: c, border: `1px solid ${c}33` }),
  card:     { background: "#fff", border: `1px solid ${G.border}`, borderRadius: 10, padding: 16, marginBottom: 10, cursor: "grab", transition: "box-shadow .15s", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" },
  input:    { background: "#fff", border: `1px solid ${G.border}`, borderRadius: 6, color: G.text, padding: "9px 12px", fontSize: 13, fontFamily: "inherit", outline: "none", width: "100%", boxSizing: "border-box", transition: "border-color .15s" },
  select:   { background: "#fff", border: `1px solid ${G.border}`, borderRadius: 6, color: G.text, padding: "9px 12px", fontSize: 13, fontFamily: "inherit", outline: "none", width: "100%", boxSizing: "border-box", cursor: "pointer" },
  btn:      (v = "primary") => ({ padding: "9px 20px", fontSize: 13, fontFamily: "inherit", fontWeight: 600, border: "1px solid", borderRadius: 6, cursor: "pointer", transition: "all .15s", ...(v === "primary" ? { background: G.accent, color: "#fff", borderColor: G.accent } : v === "success" ? { background: G.accentGreen, color: "#fff", borderColor: G.accentGreen } : v === "danger" ? { background: "transparent", color: G.accentRed, borderColor: G.accentRed } : { background: "transparent", color: G.textMuted, borderColor: G.border }) }),
  label:    { fontSize: 12, color: G.textMuted, fontWeight: 500, marginBottom: 5, display: "block" },
  formGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 },
  modal:    { position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999 },
  modalBox: { background: "#fff", border: `1px solid ${G.border}`, borderRadius: 12, padding: 28, width: 580, maxWidth: "95vw", maxHeight: "90vh", overflowY: "auto", boxShadow: "0 8px 32px rgba(0,0,0,0.12)" },
};

// ─── Constantes ───────────────────────────────────────────────────────────────
const RESPONSABLES  = [...new Set([...Object.keys(CORREOS), ...Object.keys(JEFATURAS)])];
const PRIORIDADES   = ["baja", "media", "alta"];
const ESTADOS       = ["pendiente", "en_progreso", "revision", "completado"];
const ESTADO_LABELS = { pendiente: "Pendiente", en_progreso: "En Progreso", revision: "Revisión", completado: "Completado" };
const ESTADO_ICONS  = { pendiente: "○", en_progreso: "◑", revision: "◕", completado: "●" };
const PRIORIDAD_COLOR = { baja: G.accentGreen, media: G.accentOrange, alta: G.accentRed };
const ESTADO_COLOR    = { pendiente: G.textMuted, en_progreso: G.accent, revision: G.accentOrange, completado: G.accentGreen };
const VEST_COLOR      = { programada: G.accent, en_progreso: G.accentOrange, realizada: G.accentGreen, cancelada: G.accentRed };
const VEST_LABELS     = { programada: "Programada", en_progreso: "En Progreso", realizada: "Realizada", cancelada: "Cancelada" };

// ─── Capacidad de referencia para el semáforo ─────────────────────────────────
// Horas estimadas de trabajo activo que se considera "plena capacidad" por persona.
// Si alguien supera este número, aparece en rojo independiente de cómo esté el resto.
// Ajusta según la realidad del equipo.
const HORAS_CAPACIDAD_REF = 20;

// ─── Utilidades ───────────────────────────────────────────────────────────────
function hoy() { return new Date().toISOString().slice(0, 10); }
function diasHasta(fecha) {
  const h = new Date(); h.setHours(0,0,0,0);
  return Math.round((new Date(fecha + "T00:00:00") - h) / 86400000);
}
function inicioSemana(offset = 0) {
  const d = new Date(); d.setHours(0,0,0,0);
  const day = d.getDay(); const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff + offset * 7);
  return d.toISOString().slice(0, 10);
}
function finSemana(offset = 0) {
  const s = new Date(inicioSemana(offset) + "T00:00:00");
  s.setDate(s.getDate() + 6);
  return s.toISOString().slice(0, 10);
}
function fmtICS(fecha, hora = "090000") { return fecha.replace(/-/g, "") + "T" + hora; }
function generarICS({ titulo, descripcion = "", fechaInicio, fechaTermino, responsable = "", lugar = "" }) {
  const uid_ev = Math.random().toString(36).slice(2) + "@gestop";
  const ahora  = new Date().toISOString().replace(/[-:.]/g, "").slice(0, 15);
  const dtStart = fmtICS(fechaInicio || fechaTermino);
  const dtEnd   = fmtICS(fechaTermino || fechaInicio, "170000");
  const desc = [descripcion, responsable ? `Responsable: ${responsable}` : ""].filter(Boolean).join("\\n");
  return ["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//Gestión Operativa ADAT//ES","CALSCALE:GREGORIAN","METHOD:PUBLISH","BEGIN:VEVENT",`UID:${uid_ev}`,`DTSTAMP:${ahora}`,`DTSTART:${dtStart}`,`DTEND:${dtEnd}`,`SUMMARY:${titulo}`,`DESCRIPTION:${desc}`,lugar ? `LOCATION:${lugar}` : "","BEGIN:VALARM","TRIGGER:-PT30M","ACTION:DISPLAY",`DESCRIPTION:Recordatorio: ${titulo}`,"END:VALARM","END:VEVENT","END:VCALENDAR"].filter(l => l !== "").join("\r\n");
}
function descargarICS(datos, nombreArchivo) {
  const ics = generarICS(datos);
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([ics], { type: "text/calendar;charset=utf-8" }));
  a.download = nombreArchivo.replace(/[^a-z0-9_\-]/gi, "_") + ".ics";
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
}
function fmtTs(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es-CL", { day:"2-digit", month:"short", year:"2-digit", hour:"2-digit", minute:"2-digit" });
}

// ─── Componentes base ─────────────────────────────────────────────────────────
function Field({ label, children }) { return <div><span style={css.label}>{label}</span>{children}</div>; }
function Toast({ msg, ok, onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 4500); return () => clearTimeout(t); }, [onClose]);
  return <div style={{ position:"fixed", bottom:24, right:24, background: ok ? G.accentGreen : G.accentRed, color:"#fff", padding:"12px 20px", borderRadius:8, fontSize:13, fontFamily:"inherit", zIndex:9999, fontWeight:600, maxWidth:340, boxShadow:"0 4px 16px rgba(0,0,0,0.15)" }}>{ok ? "✓" : "✗"} {msg}</div>;
}

// ─── Banner de error Firebase ─────────────────────────────────────────────────
function FbErrorBanner({ errores }) {
  const lista = errores.filter(Boolean);
  if (lista.length === 0) return null;
  return (
    <div style={{ background: G.accentRedLight, borderBottom: `2px solid ${G.accentRed}`, padding: "10px 28px", display:"flex", alignItems:"center", gap:12, fontSize:12, color: G.accentRed }}>
      <span style={{ fontWeight:700, fontSize:16 }}>⚠</span>
      <span><strong>Problema de conexión con Firebase.</strong> {lista[0]} — Verifica tu conexión a internet. Los cambios no se están guardando.</span>
    </div>
  );
}

// ─── AlertChip ────────────────────────────────────────────────────────────────
function AlertChip({ val, label, color, bg }) {
  return (
    <div style={{ flex:1, minWidth:160, background:bg, border:`1.5px solid ${color}44`, borderRadius:10, padding:"13px 18px", display:"flex", alignItems:"center", gap:12 }}>
      <div style={{ width:38, height:38, borderRadius:"50%", background:color, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
        <span style={{ color:"#fff", fontSize:18, fontWeight:700 }}>!</span>
      </div>
      <div>
        <div style={{ fontSize:22, fontWeight:700, color, lineHeight:1 }}>{val}</div>
        <div style={{ fontSize:11, color, marginTop:3, fontWeight:500 }}>{label}</div>
      </div>
    </div>
  );
}

// ─── DonutChart ───────────────────────────────────────────────────────────────
function DonutChart({ pendientes, completadas, enProgreso, revision }) {
  const total = pendientes + completadas + enProgreso + revision;
  const size = 180, cx = 90, cy = 90, r = 68, sw = 24, circ = 2 * Math.PI * r;
  const segs = [{ v:completadas, c:G.accentGreen },{ v:enProgreso, c:G.accent },{ v:revision, c:G.accentOrange },{ v:pendientes, c:G.textDim }].filter(s => s.v > 0);
  let off = 0;
  const arcs = segs.map(s => { const dash=(s.v/total)*circ; const a={...s,dash,gap:circ-dash,off}; off+=dash; return a; });
  const pct = total > 0 ? Math.round(completadas/total*100) : 0;
  const pColor = pct>=75 ? G.accentGreen : pct>=40 ? G.accent : G.accentOrange;
  return (
    <div style={{ display:"flex", alignItems:"center", gap:28 }}>
      <div style={{ position:"relative", flexShrink:0 }}>
        <svg width={size} height={size}>
          <circle cx={cx} cy={cy} r={r} fill="none" stroke={G.borderLight} strokeWidth={sw} />
          {arcs.map((a,i) => <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={a.c} strokeWidth={sw} strokeDasharray={`${a.dash} ${a.gap}`} strokeDashoffset={circ/4-a.off} strokeLinecap="round" style={{ transition:"stroke-dasharray .7s ease" }} />)}
        </svg>
        <div style={{ position:"absolute", inset:0, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", pointerEvents:"none" }}>
          <div style={{ fontSize:30, fontWeight:700, color:pColor, lineHeight:1 }}>{pct}%</div>
          <div style={{ fontSize:10, color:G.textMuted, marginTop:3 }}>completado</div>
        </div>
      </div>
      <div style={{ display:"flex", flexDirection:"column", gap:9 }}>
        {[{ label:"Completadas",v:completadas,c:G.accentGreen },{ label:"En Progreso",v:enProgreso,c:G.accent },{ label:"En Revisión",v:revision,c:G.accentOrange },{ label:"Pendientes",v:pendientes,c:G.textDim }].map(({ label,v,c }) => (
          <div key={label} style={{ display:"flex", alignItems:"center", gap:8 }}>
            <div style={{ width:10, height:10, borderRadius:"50%", background:c, flexShrink:0 }} />
            <span style={{ fontSize:12, color:G.textMuted, width:90 }}>{label}</span>
            <span style={{ fontSize:14, fontWeight:700, color:c }}>{v}</span>
          </div>
        ))}
        <div style={{ borderTop:`1px solid ${G.border}`, paddingTop:8, display:"flex", alignItems:"center", gap:8 }}>
          <div style={{ width:10, height:10, borderRadius:"50%", background:G.border, flexShrink:0 }} />
          <span style={{ fontSize:12, color:G.textMuted, width:90 }}>Total</span>
          <span style={{ fontSize:14, fontWeight:700, color:G.accent }}>{total}</span>
        </div>
      </div>
    </div>
  );
}

// ─── 1. SEMÁFORO DE CARGA ─────────────────────────────────────────────────────
// Compara contra HORAS_CAPACIDAD_REF (umbral fijo), NO contra el promedio del equipo.
// Así, si todos están sobrecargados, todos aparecen en rojo — no en verde.
function SemaforoCarga({ tareas }) {
  const datos = RESPONSABLES.map(r => {
    const activas  = tareas.filter(t => t.responsable === r && t.estado !== "completado");
    const horasAct = activas.reduce((s, t) => s + (t.horasEstimadas || 1), 0);
    const total    = tareas.filter(t => t.responsable === r).length;
    const vencidas = activas.filter(t => diasHasta(t.fechaTermino) < 0).length;
    return { nombre: r, cantidad: activas.length, horasAct, total, vencidas };
  }).filter(r => r.total > 0);

  if (datos.length === 0) return <div style={{ color:G.textDim, fontSize:12, textAlign:"center", padding:"20px 0" }}>Sin tareas asignadas</div>;

  const maxHoras = Math.max(...datos.map(d => d.horasAct), 1);

  function colorSemaforo(h) {
    if (h === 0) return G.accentGreen;
    const r = h / HORAS_CAPACIDAD_REF;
    if (r <= 0.65) return G.accentGreen;
    if (r <= 1.0)  return G.accentOrange;
    return G.accentRed;
  }
  function labelSemaforo(h) {
    if (h === 0) return "Libre";
    const r = h / HORAS_CAPACIDAD_REF;
    if (r <= 0.65) return "Normal";
    if (r <= 1.0)  return "Alta";
    return "Crítica";
  }

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
      {datos.sort((a,b) => b.horasAct - a.horasAct).map(d => {
        const c = colorSemaforo(d.horasAct);
        const esCritica = d.horasAct > HORAS_CAPACIDAD_REF;
        return (
          <div key={d.nombre} style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 14px", background:c+"0D", border:`1px solid ${c}33`, borderRadius:8 }}>
            <div style={{ width:20, height:20, borderRadius:"50%", background:c, boxShadow:`0 0 8px ${c}99`, flexShrink:0,
              animation: esCritica ? "semaforoPulse 1.4s ease-in-out infinite" : "none" }} />
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:13, fontWeight:600, color:G.text, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{d.nombre}</div>
              <div style={{ fontSize:10, color:G.textMuted, marginTop:2 }}>
                {d.cantidad} tarea{d.cantidad !== 1 ? "s" : ""}
                <span style={{ marginLeft:6, color:c, fontWeight:600 }}>· {d.horasAct.toFixed(1)} h estimadas</span>
                {d.vencidas > 0 && <span style={{ color:G.accentRed, fontWeight:700, marginLeft:6 }}>· {d.vencidas} vencida{d.vencidas!==1?"s":""}</span>}
              </div>
            </div>
            <span style={{ ...css.badge(c), fontSize:10 }}>{labelSemaforo(d.horasAct)}</span>
            <div style={{ width:80, background:G.borderLight, borderRadius:99, height:6, overflow:"hidden", flexShrink:0 }}>
              <div style={{ background:c, width:`${(d.horasAct/maxHoras)*100}%`, height:"100%", borderRadius:99, transition:"width .6s" }} />
            </div>
          </div>
        );
      })}
      <div style={{ fontSize:10, color:G.textDim, marginTop:4 }}>
        Umbral de referencia: <strong>{HORAS_CAPACIDAD_REF} h</strong> estimadas activas por persona
        {" · "}<span style={{ color:G.accentGreen }}>●</span> Normal (≤65%)
        {" · "}<span style={{ color:G.accentOrange }}>●</span> Alta (65–100%)
        {" · "}<span style={{ color:G.accentRed }}>●</span> Crítica (&gt;100%)
      </div>
    </div>
  );
}

// ─── 2. TABLA ATRASADOS ───────────────────────────────────────────────────────
function TablaAtrasados({ tareas }) {
  const atrasadas = tareas.filter(t => t.estado !== "completado" && diasHasta(t.fechaTermino) < 0)
    .sort((a,b) => diasHasta(a.fechaTermino) - diasHasta(b.fechaTermino));
  if (atrasadas.length === 0) return (
    <div style={{ textAlign:"center", padding:"20px 0", color:G.accentGreen, fontSize:13, fontWeight:600 }}>✓ Sin tareas atrasadas</div>
  );
  return (
    <div style={{ overflowX:"auto" }}>
      <table style={{ width:"100%", borderCollapse:"collapse", fontSize:11 }}>
        <thead><tr style={{ borderBottom:`2px solid ${G.border}` }}>{["Tarea","Responsable","Atraso","Prioridad","Horas est."].map(h=><th key={h} style={{ padding:"6px 10px",textAlign:"left",color:G.textMuted,fontSize:10,textTransform:"uppercase",letterSpacing:"0.06em" }}>{h}</th>)}</tr></thead>
        <tbody>
          {atrasadas.map(t => {
            const d = Math.abs(diasHasta(t.fechaTermino));
            const bgRow = d>=14 ? G.accentRedLight : d>=7 ? G.accentOrangeLight+"88" : "transparent";
            const colorAtraso = d>=7 ? G.accentRed : G.accentOrange;
            return (
              <tr key={t.id} style={{ borderBottom:`1px solid ${G.borderLight}`, background:bgRow }}>
                <td style={{ padding:"8px 10px" }}>
                  <div style={{ fontWeight:600, fontSize:12, color:G.text }}>{t.titulo}</div>
                  <div style={{ fontSize:9, color:G.textDim, marginTop:2 }}>venció {t.fechaTermino}</div>
                </td>
                <td style={{ padding:"8px 10px", color:G.textMuted }}>{t.responsable.split(" ")[0]}</td>
                <td style={{ padding:"8px 10px" }}>
                  <span style={{ ...css.badge(colorAtraso), fontWeight:700 }}>−{d}d</span>
                  {d>=14 && <div style={{ fontSize:9, color:G.accentRed, marginTop:3, fontWeight:600 }}>CRÍTICO</div>}
                </td>
                <td style={{ padding:"8px 10px" }}><span style={css.badge(PRIORIDAD_COLOR[t.prioridad])}>{t.prioridad}</span></td>
                <td style={{ padding:"8px 10px", color:G.textMuted }}>{(t.horasEstimadas||1)}h</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── 3. RESUMEN SEMANAL ───────────────────────────────────────────────────────
function ResumenSemanal({ tareas, visitas }) {
  const iSemAct=inicioSemana(0), fSemAct=finSemana(0), iSemAnt=inicioSemana(-1), fSemAnt=finSemana(-1);
  function enRango(f,d,h){ return f>=d && f<=h; }
  const compAct=tareas.filter(t=>t.estado==="completado"&&t.fechaTermino&&enRango(t.fechaTermino,iSemAct,fSemAct)).length;
  const compAnt=tareas.filter(t=>t.estado==="completado"&&t.fechaTermino&&enRango(t.fechaTermino,iSemAnt,fSemAnt)).length;
  const visAct=visitas.filter(v=>enRango(v.fecha,iSemAct,fSemAct)).length;
  const visAnt=visitas.filter(v=>enRango(v.fecha,iSemAnt,fSemAnt)).length;
  const nuevAct=tareas.filter(t=>t.fechaInicio&&enRango(t.fechaInicio,iSemAct,fSemAct)).length;
  const nuevAnt=tareas.filter(t=>t.fechaInicio&&enRango(t.fechaInicio,iSemAnt,fSemAnt)).length;
  function DeltaBar({ actual, anterior, color }) {
    const max=Math.max(actual,anterior,1), diff=actual-anterior;
    const diffColor=diff>0?G.accentGreen:diff<0?G.accentRed:G.textDim;
    return (
      <div>
        <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:4 }}>
          <span style={{ fontSize:10, color:G.textMuted, width:60 }}>Esta sem.</span>
          <div style={{ flex:1, background:G.borderLight, borderRadius:99, height:8, overflow:"hidden" }}>
            <div style={{ background:color, width:`${(actual/max)*100}%`, height:"100%", borderRadius:99, transition:"width .5s" }} />
          </div>
          <span style={{ fontSize:12, fontWeight:700, color, width:20, textAlign:"right" }}>{actual}</span>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:6 }}>
          <span style={{ fontSize:10, color:G.textDim, width:60 }}>Sem. ant.</span>
          <div style={{ flex:1, background:G.borderLight, borderRadius:99, height:8, overflow:"hidden" }}>
            <div style={{ background:color+"55", width:`${(anterior/max)*100}%`, height:"100%", borderRadius:99 }} />
          </div>
          <span style={{ fontSize:12, color:G.textDim, width:20, textAlign:"right" }}>{anterior}</span>
        </div>
        {diff!==0&&<div style={{ marginTop:6, fontSize:10, color:diffColor, fontWeight:600 }}>{diff>0?"▲":"▼"} {Math.abs(diff)} vs semana anterior</div>}
      </div>
    );
  }
  return (
    <div style={{ display:"flex", gap:12, flexWrap:"wrap" }}>
      {[
        { label:"Tareas completadas", actual:compAct, anterior:compAnt, color:G.accentGreen, icon:"✓" },
        { label:"Tareas nuevas",      actual:nuevAct, anterior:nuevAnt, color:G.accent,      icon:"+" },
        { label:"Visitas realizadas", actual:visAct,  anterior:visAnt,  color:G.accentOrange, icon:"◈" },
      ].map(item => (
        <div key={item.label} style={{ flex:1, minWidth:160, background:item.color+"08", border:`1px solid ${item.color}33`, borderRadius:10, padding:"14px 16px" }}>
          <div style={{ fontSize:11, color:G.textMuted, marginBottom:10, fontWeight:600 }}>{item.icon} {item.label}</div>
          <div style={{ fontSize:32, fontWeight:700, color:item.color, lineHeight:1, marginBottom:10 }}>{item.actual}</div>
          <DeltaBar actual={item.actual} anterior={item.anterior} color={item.color} />
        </div>
      ))}
    </div>
  );
}

// ─── 4. MINI-CALENDARIO 7 DÍAS ────────────────────────────────────────────────
function MiniCalendario({ tareas, visitas }) {
  const dias = Array.from({ length:7 }, (_,i) => {
    const d = new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate()+i);
    const fecha = d.toISOString().slice(0,10);
    const t = tareas.filter(t=>t.fechaTermino===fecha&&t.estado!=="completado").length;
    const v = visitas.filter(v=>v.fecha===fecha).length;
    return { fecha, t, v, total:t+v, esHoy:i===0, nombreDia:d.toLocaleDateString("es-CL",{weekday:"short"}), numDia:d.getDate() };
  });
  const maxTotal = Math.max(...dias.map(d=>d.total),1);
  return (
    <div>
      <div style={{ display:"flex", gap:6 }}>
        {dias.map(d => {
          const carga=d.total/maxTotal;
          const bgColor=d.esHoy?G.accent:carga>0.7?G.accentRed:carga>0.3?G.accentOrange:G.accentGreen;
          return (
            <div key={d.fecha} style={{ flex:1, textAlign:"center", padding:"10px 4px", borderRadius:8, background:d.esHoy?G.accent+"0F":G.bg, border:`1.5px solid ${d.esHoy?G.accent:G.border}` }}>
              <div style={{ fontSize:10, color:d.esHoy?G.accent:G.textMuted, fontWeight:d.esHoy?700:400, textTransform:"capitalize" }}>{d.nombreDia}</div>
              <div style={{ fontSize:17, fontWeight:700, color:d.esHoy?G.accent:G.text, marginTop:2, lineHeight:1 }}>{d.numDia}</div>
              <div style={{ marginTop:8, height:36, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"flex-end", gap:3 }}>
                {d.total>0 ? (<><div style={{ width:"80%", background:bgColor, borderRadius:3, height:Math.max(4,carga*28) }} /><div style={{ fontSize:11, fontWeight:700, color:bgColor }}>{d.total}</div></>) : <div style={{ fontSize:10, color:G.textDim }}>—</div>}
              </div>
              <div style={{ marginTop:4, minHeight:28 }}>
                {d.t>0&&<div style={{ fontSize:9, color:G.textMuted }}>📋{d.t}</div>}
                {d.v>0&&<div style={{ fontSize:9, color:G.textMuted }}>📍{d.v}</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── 5. INFORME ───────────────────────────────────────────────────────────────
function InformeModule({ tareas, visitas, soe, contingencias }) {
  const [periodo, setPeriodo] = useState("semana");
  const [preview, setPreview] = useState(false);

  function calcularFechas() {
    if (periodo==="semana") return { desde:inicioSemana(0), hasta:finSemana(0) };
    const d=new Date(hoy()+"T00:00:00");
    return { desde:new Date(d.getFullYear(),d.getMonth(),1).toISOString().slice(0,10), hasta:new Date(d.getFullYear(),d.getMonth()+1,0).toISOString().slice(0,10) };
  }
  function enRango(f,d,h){ return f>=d && f<=h; }

  function generarTexto() {
    const {desde,hasta}=calcularFechas();
    const label=periodo==="semana"?`Semana ${desde} al ${hasta}`:`Mes ${desde.slice(0,7)}`;
    const tareasComp=tareas.filter(t=>t.estado==="completado"&&t.fechaTermino&&enRango(t.fechaTermino,desde,hasta));
    const tareasPend=tareas.filter(t=>t.estado!=="completado");
    const tareasVenc=tareas.filter(t=>t.estado!=="completado"&&diasHasta(t.fechaTermino)<0);
    const visitasReal=visitas.filter(v=>enRango(v.fecha,desde,hasta));
    const soeAprobados=soe.filter(s=>s.estado==="aprobada"&&enRango(s.fecha,desde,hasta));
    const contResueltas=contingencias.filter(c=>c.estado==="resuelta"&&enRango(c.fecha,desde,hasta));
    const contActivas=contingencias.filter(c=>c.estado==="activa");
    const cargaPorPersona=RESPONSABLES.map(r=>({
      nombre:r, activas:tareas.filter(t=>t.responsable===r&&t.estado!=="completado").length,
      horasAct:tareas.filter(t=>t.responsable===r&&t.estado!=="completado").reduce((s,t)=>s+(t.horasEstimadas||1),0),
      completadas:tareas.filter(t=>t.responsable===r&&t.estado==="completado").length,
    })).filter(r=>r.activas+r.completadas>0);

    return `INFORME DE GESTIÓN OPERATIVA
Departamento Apoyo Diagnóstico y Terapéutico
${label}
Generado: ${new Date().toLocaleDateString("es-CL",{weekday:"long",year:"numeric",month:"long",day:"numeric"})}

════════════════════════════════════════
RESUMEN EJECUTIVO
════════════════════════════════════════
• Tareas completadas en el período : ${tareasComp.length}
• Tareas pendientes actualmente    : ${tareasPend.length}
• Tareas vencidas sin completar    : ${tareasVenc.length}
• Visitas realizadas               : ${visitasReal.length}
• SOE aprobados                    : ${soeAprobados.length}
• Contingencias resueltas          : ${contResueltas.length}
• Contingencias activas            : ${contActivas.length}

════════════════════════════════════════
CARGA POR PERSONA (horas estimadas activas)
════════════════════════════════════════
${cargaPorPersona.map(p=>`• ${p.nombre.padEnd(22)} Activas: ${p.activas} (${p.horasAct.toFixed(1)}h)  |  Completadas: ${p.completadas}`).join("\n")}

════════════════════════════════════════
TAREAS COMPLETADAS EN EL PERÍODO
════════════════════════════════════════
${tareasComp.length===0?"  (ninguna)":tareasComp.map(t=>`• [${t.prioridad.toUpperCase()}] ${t.titulo} — ${t.responsable} (${t.fechaTermino}) [${t.horasEstimadas||1}h]`).join("\n")}

════════════════════════════════════════
TAREAS VENCIDAS SIN COMPLETAR
════════════════════════════════════════
${tareasVenc.length===0?"  (ninguna)":tareasVenc.sort((a,b)=>diasHasta(a.fechaTermino)-diasHasta(b.fechaTermino)).map(t=>`• [${t.prioridad.toUpperCase()}] ${t.titulo} — ${t.responsable} — ATRASO: ${Math.abs(diasHasta(t.fechaTermino))} días`).join("\n")}

════════════════════════════════════════
VISITAS REALIZADAS
════════════════════════════════════════
${visitasReal.length===0?"  (ninguna)":visitasReal.map(v=>`• ${v.fecha} | ${v.lugar} — ${v.responsable}\n  Objetivo: ${v.objetivo}${v.resultado?"\n  Resultado: "+v.resultado:""}${v.asistentes?"\n  Asistentes: "+v.asistentes:""}${v.compromisos?"\n  Compromisos: "+v.compromisos:""}`).join("\n\n")}

════════════════════════════════════════
SOLICITUDES DE TRABAJO EXTRAORDINARIO
════════════════════════════════════════
${soeAprobados.length===0?"  (ninguna aprobada en el período)":soeAprobados.map(s=>`• ${s.fecha} | ${s.solicitante} — ${s.horasExtra} hrs | Aprobado por: ${s.aprobadaPor}${s.timestampAprobacion?" ["+fmtTs(s.timestampAprobacion)+"]":""}`).join("\n")}

════════════════════════════════════════
CONTINGENCIAS
════════════════════════════════════════
Resueltas: ${contResueltas.length}
${contResueltas.map(c=>`• [${c.impacto.toUpperCase()}] ${c.descripcion} — Acción: ${c.accionTomada||"no registrada"}`).join("\n")||"  (ninguna)"}

Activas al cierre: ${contActivas.length}
${contActivas.map(c=>`• [${c.impacto.toUpperCase()}] ${c.descripcion} — Reportado por: ${c.reportadoPor}`).join("\n")||"  (ninguna)"}

════════════════════════════════════════
Fin del informe
════════════════════════════════════════`;
  }

  const { desde, hasta } = calcularFechas();
  const textoPreview = useMemo(generarTexto, [tareas, visitas, soe, contingencias, periodo]);
  const P  = { background:"#fff", border:`1px solid ${G.border}`, borderRadius:12, padding:20, boxShadow:"0 1px 4px rgba(0,0,0,0.05)" };
  const PT = { fontSize:11, fontWeight:600, color:G.textMuted, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:16 };

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <div style={css.sectionTitle}><span style={{ color:G.accentPurple }}>📄</span> Informe de Gestión</div>
      </div>
      <div style={{ ...P, display:"flex", alignItems:"center", gap:16, flexWrap:"wrap" }}>
        <div>
          <div style={css.label}>Período</div>
          <div style={{ display:"flex", gap:8 }}>
            {["semana","mes"].map(p=><button key={p} style={{ ...css.btn(periodo===p?"primary":"ghost"), padding:"7px 18px", fontSize:12 }} onClick={()=>setPeriodo(p)}>{p==="semana"?"Esta semana":"Este mes"}</button>)}
          </div>
        </div>
        <div style={{ color:G.textMuted, fontSize:12 }}>{desde} → {hasta}</div>
        <div style={{ marginLeft:"auto", display:"flex", gap:8 }}>
          <button style={{ ...css.btn("ghost"), fontSize:12, padding:"7px 16px" }} onClick={()=>setPreview(p=>!p)}>{preview?"Ocultar":"Vista previa"}</button>
          <button style={{ ...css.btn("ghost"), fontSize:12, padding:"7px 16px" }} onClick={() => { const t=generarTexto(); const a=document.createElement("a"); a.href=URL.createObjectURL(new Blob([t],{type:"text/plain;charset=utf-8;"})); a.download=`informe_${periodo}_${hoy()}.txt`; a.click(); }}>↓ .txt</button>
          <button style={{ ...css.btn("primary"), fontSize:12, padding:"7px 16px" }} onClick={() => {
            const t=generarTexto();
            const html=`<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Informe</title><style>body{font-family:monospace;max-width:900px;margin:40px auto;padding:0 20px;color:#111;line-height:1.6}pre{white-space:pre-wrap;word-wrap:break-word}</style></head><body><pre>${t.replace(/</g,"&lt;").replace(/>/g,"&gt;")}</pre></body></html>`;
            const a=document.createElement("a"); a.href=URL.createObjectURL(new Blob([html],{type:"text/html;charset=utf-8;"})); a.download=`informe_${periodo}_${hoy()}.html`; a.click();
          }}>↓ .html</button>
        </div>
      </div>
      <div style={P}>
        <div style={PT}>Carga del equipo en el período</div>
        <SemaforoCarga tareas={tareas} />
      </div>
      {preview && <div style={P}><div style={PT}>Vista previa</div><pre style={{ fontSize:11, color:G.text, background:G.bg, padding:16, borderRadius:8, overflowX:"auto", whiteSpace:"pre-wrap", wordWrap:"break-word", lineHeight:1.7, fontFamily:"monospace", maxHeight:500, overflowY:"auto" }}>{textoPreview}</pre></div>}
    </div>
  );
}

// ─── 6. HISTORIAL DE CARGA ────────────────────────────────────────────────────
// Ahora permite ver en "horas estimadas" (esfuerzo real) o en "cantidad de tareas".
// El modo "horas" evita que una tarea de 5 minutos pese igual que un proyecto de 3 semanas.
function HistorialCargaModule({ tareas }) {
  const [modo, setModo] = useState("horas"); // "horas" | "tareas"
  const meses = Array.from({ length:6 }, (_,i) => {
    const d=new Date(); d.setDate(1); d.setMonth(d.getMonth()-(5-i));
    const desde=d.toISOString().slice(0,7)+"-01";
    const hasta=new Date(d.getFullYear(),d.getMonth()+1,0).toISOString().slice(0,10);
    return { label:d.toLocaleDateString("es-CL",{month:"short",year:"2-digit"}), desde, hasta };
  });

  const datos = RESPONSABLES.map(r => ({
    nombre: r.split(" ")[0],
    nombreCompleto: r,
    serieTareas: meses.map(m => tareas.filter(t=>t.responsable===r&&t.fechaInicio>=m.desde&&t.fechaInicio<=m.hasta).length),
    serieHoras:  meses.map(m => tareas.filter(t=>t.responsable===r&&t.fechaInicio>=m.desde&&t.fechaInicio<=m.hasta).reduce((s,t)=>s+(t.horasEstimadas||1),0)),
  })).filter(r => r.serieTareas.some(v=>v>0));

  const serie  = (d) => modo==="horas" ? d.serieHoras  : d.serieTareas;
  const maxVal = Math.max(...datos.flatMap(d=>serie(d)), 1);
  const colores = [G.accent, G.accentGreen, G.accentOrange, G.accentRed, G.accentPurple, "#0891B2"];
  const H = 120;
  const P = { background:"#fff", border:`1px solid ${G.border}`, borderRadius:12, padding:20, boxShadow:"0 1px 4px rgba(0,0,0,0.05)" };

  if (datos.length===0) return (
    <div style={P}><div style={{ fontSize:11, fontWeight:600, color:G.textMuted, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:16 }}>Historial de Carga</div><div style={{ color:G.textDim, fontSize:12, textAlign:"center", padding:"20px 0" }}>Sin datos históricos aún</div></div>
  );

  return (
    <div style={P}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:20, flexWrap:"wrap", gap:10 }}>
        <div style={{ fontSize:11, fontWeight:600, color:G.textMuted, textTransform:"uppercase", letterSpacing:"0.08em" }}>Historial de Carga — últimos 6 meses</div>
        <div style={{ display:"flex", gap:6, alignItems:"center" }}>
          <span style={{ fontSize:11, color:G.textDim }}>Ver por:</span>
          {[["horas","Horas estimadas"],["tareas","N° de tareas"]].map(([k,l])=>(
            <button key={k} style={{ ...css.btn(modo===k?"primary":"ghost"), padding:"5px 14px", fontSize:11 }} onClick={()=>setModo(k)}>{l}</button>
          ))}
        </div>
      </div>
      {modo==="tareas" && (
        <div style={{ background:G.accentOrangeLight, border:`1px solid ${G.accentOrange}33`, borderRadius:6, padding:"8px 12px", marginBottom:14, fontSize:11, color:G.accentOrange }}>
          ⚠ El conteo por tareas trata igual una tarea de 5 minutos que un proyecto de 3 semanas. El modo "Horas estimadas" refleja mejor el esfuerzo real.
        </div>
      )}

      <div style={{ display:"flex", gap:12, alignItems:"flex-end", marginBottom:8 }}>
        {meses.map((mes,mi) => (
          <div key={mes.label} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:3 }}>
            <div style={{ display:"flex", alignItems:"flex-end", gap:2, height:H }}>
              {datos.map((d,di) => {
                const val=serie(d)[mi];
                const barH=val>0?Math.max(4,(val/maxVal)*H):0;
                const label=modo==="horas"?`${d.nombreCompleto}: ${val.toFixed(1)}h`:`${d.nombreCompleto}: ${val} tareas`;
                return <div key={d.nombre} title={label} style={{ width:14, height:barH, background:colores[di%colores.length], borderRadius:"3px 3px 0 0", transition:"height .5s", cursor:"default" }} />;
              })}
            </div>
            <div style={{ fontSize:10, color:G.textMuted, textAlign:"center" }}>{mes.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display:"flex", gap:14, flexWrap:"wrap", marginTop:12, paddingTop:12, borderTop:`1px solid ${G.borderLight}` }}>
        {datos.map((d,di) => <div key={d.nombre} style={{ display:"flex", alignItems:"center", gap:6 }}><div style={{ width:10, height:10, borderRadius:2, background:colores[di%colores.length] }} /><span style={{ fontSize:11, color:G.textMuted }}>{d.nombre}</span></div>)}
      </div>

      <div style={{ marginTop:20, overflowX:"auto" }}>
        <table style={{ width:"100%", borderCollapse:"collapse", fontSize:11 }}>
          <thead>
            <tr style={{ borderBottom:`1px solid ${G.border}` }}>
              <th style={{ padding:"6px 10px", textAlign:"left", color:G.textMuted, fontSize:10, textTransform:"uppercase" }}>Persona</th>
              {meses.map(m=><th key={m.label} style={{ padding:"6px 10px", textAlign:"center", color:G.textMuted, fontSize:10, textTransform:"uppercase" }}>{m.label}</th>)}
              <th style={{ padding:"6px 10px", textAlign:"center", color:G.textMuted, fontSize:10, textTransform:"uppercase" }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {datos.map((d,di) => {
              const s=serie(d);
              const total=s.reduce((a,b)=>a+b,0);
              const maxS=Math.max(...s);
              return (
                <tr key={d.nombre} style={{ borderBottom:`1px solid ${G.borderLight}` }}>
                  <td style={{ padding:"7px 10px" }}>
                    <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                      <div style={{ width:8, height:8, borderRadius:2, background:colores[di%colores.length] }} />
                      {d.nombreCompleto}
                    </div>
                  </td>
                  {s.map((v,mi) => <td key={mi} style={{ padding:"7px 10px", textAlign:"center", fontWeight:v===maxS&&v>0?700:400, color:v===maxS&&v>0?G.accentRed:G.text }}>{v>0?(modo==="horas"?`${v.toFixed(1)}h`:v):"—"}</td>)}
                  <td style={{ padding:"7px 10px", textAlign:"center", fontWeight:700, color:G.accent }}>{modo==="horas"?`${total.toFixed(1)}h`:total}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── 9. ALERTA DIARIA ─────────────────────────────────────────────────────────
function AlertaDiaria({ tareas, onCerrar }) {
  const vencidas  = tareas.filter(t=>t.estado!=="completado"&&diasHasta(t.fechaTermino)<0);
  const hoyTareas = tareas.filter(t=>t.estado!=="completado"&&diasHasta(t.fechaTermino)===0);
  const manana    = tareas.filter(t=>t.estado!=="completado"&&diasHasta(t.fechaTermino)===1);
  if (vencidas.length+hoyTareas.length+manana.length===0) return null;
  const hora=new Date().getHours();
  const saludo=hora<12?"Buenos días":hora<19?"Buenas tardes":"Buenas noches";
  return (
    <div style={{ ...css.modal, zIndex:1200 }}>
      <div style={{ ...css.modalBox, width:560, maxWidth:"95vw", padding:0, overflow:"hidden" }}>
        <div style={{ background:vencidas.length>0?G.accentRed:G.accentOrange, padding:"20px 28px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div>
            <div style={{ fontSize:11, color:"rgba(255,255,255,0.75)", fontWeight:500, marginBottom:3 }}>{saludo} — {new Date().toLocaleDateString("es-CL",{weekday:"long",day:"numeric",month:"long"})}</div>
            <div style={{ fontSize:16, fontWeight:700, color:"#fff" }}>{vencidas.length>0?`⚠ ${vencidas.length} vencida${vencidas.length!==1?"s":""} + ${hoyTareas.length} vence${hoyTareas.length!==1?"n":""}  hoy`:`🟡 ${hoyTareas.length} tarea${hoyTareas.length!==1?"s":""} vence hoy`}</div>
          </div>
          <button onClick={onCerrar} style={{ background:"rgba(255,255,255,0.2)", border:"none", color:"#fff", width:32, height:32, borderRadius:"50%", fontSize:18, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>×</button>
        </div>
        <div style={{ padding:"20px 28px", display:"flex", flexDirection:"column", gap:14 }}>
          <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
            {vencidas.length>0&&<div style={{ flex:1, minWidth:120, background:G.accentRedLight, border:`1px solid ${G.accentRed}33`, borderRadius:8, padding:"10px 14px", textAlign:"center" }}><div style={{ fontSize:28, fontWeight:700, color:G.accentRed, lineHeight:1 }}>{vencidas.length}</div><div style={{ fontSize:11, color:G.accentRed, marginTop:3, fontWeight:600 }}>Vencida{vencidas.length!==1?"s":""}</div></div>}
            {hoyTareas.length>0&&<div style={{ flex:1, minWidth:120, background:G.accentOrangeLight, border:`1px solid ${G.accentOrange}33`, borderRadius:8, padding:"10px 14px", textAlign:"center" }}><div style={{ fontSize:28, fontWeight:700, color:G.accentOrange, lineHeight:1 }}>{hoyTareas.length}</div><div style={{ fontSize:11, color:G.accentOrange, marginTop:3, fontWeight:600 }}>Vence hoy</div></div>}
            {manana.length>0&&<div style={{ flex:1, minWidth:120, background:G.accentLight, border:`1px solid ${G.accent}33`, borderRadius:8, padding:"10px 14px", textAlign:"center" }}><div style={{ fontSize:28, fontWeight:700, color:G.accent, lineHeight:1 }}>{manana.length}</div><div style={{ fontSize:11, color:G.accent, marginTop:3, fontWeight:600 }}>Mañana</div></div>}
          </div>
          {vencidas.length>0&&<div style={{ background:G.accentRedLight, border:`1px solid ${G.accentRed}33`, borderRadius:8, padding:"12px 14px" }}>
            <div style={{ fontSize:11, fontWeight:700, color:G.accentRed, marginBottom:8 }}>🔴 Requieren acción inmediata</div>
            {vencidas.slice(0,5).map(t=><div key={t.id} style={{ fontSize:11, color:G.text, marginBottom:5, paddingLeft:8, display:"flex", justifyContent:"space-between", gap:8 }}><span>• <strong>{t.titulo}</strong> — {t.responsable}</span><span style={{ color:G.accentRed, fontWeight:700, whiteSpace:"nowrap" }}>{Math.abs(diasHasta(t.fechaTermino))}d atraso</span></div>)}
            {vencidas.length>5&&<div style={{ fontSize:11, color:G.textMuted, paddingLeft:8 }}>+{vencidas.length-5} más...</div>}
          </div>}
          <div style={{ display:"flex", justifyContent:"flex-end", paddingTop:4 }}>
            <button style={css.btn("primary")} onClick={onCerrar}>Entendido, ir al sistema →</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── KANBAN ───────────────────────────────────────────────────────────────────
// Mejoras: edición de tareas, búsqueda por texto, paginación por columna.
const KANBAN_PAGE = 5; // tarjetas visibles por columna antes de "Ver más"

function KanbanModule({ tareas, fb, addToast }) {
  const [showForm,    setShowForm]    = useState(false);
  const [editTarea,   setEditTarea]   = useState(null);  // task object | null
  const [dragId,      setDragId]      = useState(null);
  const [dragOver,    setDragOver]    = useState(null);
  const [hoveredCard, setHoveredCard] = useState(null);
  const [sending,     setSending]     = useState(false);
  const [filtroResp,  setFiltroResp]  = useState("todos");
  const [busqueda,    setBusqueda]    = useState("");
  const [paginaCol,   setPaginaCol]   = useState({}); // { estado: visiblesCount }

  const tareaVacia = { titulo:"", responsable:RESPONSABLES[0], fechaInicio:hoy(), fechaTermino:"", estado:"pendiente", prioridad:"media", descripcion:"", horasEstimadas:1 };
  const [form, setForm] = useState(tareaVacia);

  // Filtros acumulados: responsable + búsqueda de texto
  const tareasFiltradas = useMemo(() => {
    const q = busqueda.toLowerCase().trim();
    return tareas
      .filter(t => filtroResp==="todos" || t.responsable===filtroResp)
      .filter(t => !q || t.titulo.toLowerCase().includes(q) || (t.descripcion||"").toLowerCase().includes(q) || t.responsable.toLowerCase().includes(q));
  }, [tareas, filtroResp, busqueda]);

  const byEstado = useMemo(() => ESTADOS.reduce((acc,e) => ({ ...acc, [e]: tareasFiltradas.filter(t=>t.estado===e) }), {}), [tareasFiltradas]);

  async function agregarTarea() {
    if (!form.titulo||!form.fechaTermino) { addToast("Completa título y fecha de término.", false); return; }
    setSending(true);
    const { id:_, ...nueva } = form;
    await fb.agregar(nueva);
    descargarICS({ titulo:nueva.titulo, descripcion:nueva.descripcion, fechaInicio:nueva.fechaInicio, fechaTermino:nueva.fechaTermino, responsable:nueva.responsable }, nueva.titulo);
    const ok = await notificarAsignacion(nueva);
    addToast(ok?`Correo enviado a ${nueva.responsable}`:"Tarea creada. (Configura EmailJS para correos automáticos.)", ok);
    setSending(false); setForm(tareaVacia); setShowForm(false);
  }

  async function guardarEdicion() {
    if (!editTarea.titulo||!editTarea.fechaTermino) { addToast("Completa título y fecha de término.", false); return; }
    const { id, ...cambios } = editTarea;
    await fb.actualizar(id, cambios);
    addToast("Tarea actualizada correctamente.");
    setEditTarea(null);
  }

  function cambiarEstado(id, e) { fb.actualizar(id, { estado:e }); }
  function onDrop(e) { if (!dragId) return; cambiarEstado(dragId, e); setDragId(null); setDragOver(null); }
  function eliminar(id) {
    if (!window.confirm("¿Eliminar esta tarea? Esta acción no se puede deshacer.")) return;
    fb.eliminar(id);
    addToast("Tarea eliminada.");
  }
  function verMasCol(estado) { setPaginaCol(p => ({ ...p, [estado]: (p[estado]||KANBAN_PAGE)+KANBAN_PAGE })); }

  function DiasTag({ fechaTermino, estado }) {
    if (estado==="completado") return null;
    const d=diasHasta(fechaTermino); if (d>7) return null;
    const c=d<0?G.accentRed:d<=3?G.accentOrange:G.accentYellow;
    return <span style={css.badge(c)}>{d<0?`−${Math.abs(d)}d`:d===0?"hoy":`${d}d`}</span>;
  }

  function FormTarea({ titulo, data, setData, onGuardar, onCancelar, guardando }) {
    return (
      <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
        <Field label="Título *"><input style={css.input} value={data.titulo} onChange={e=>setData(p=>({...p,titulo:e.target.value}))} placeholder="Descripción breve..." /></Field>
        <div style={css.formGrid}>
          <Field label="Responsable"><select style={css.select} value={data.responsable} onChange={e=>setData(p=>({...p,responsable:e.target.value}))}>{RESPONSABLES.map(r=><option key={r}>{r}</option>)}</select></Field>
          <Field label="Prioridad"><select style={css.select} value={data.prioridad} onChange={e=>setData(p=>({...p,prioridad:e.target.value}))}>{PRIORIDADES.map(p=><option key={p}>{p}</option>)}</select></Field>
          <Field label="Fecha Inicio"><input type="date" style={css.input} value={data.fechaInicio} onChange={e=>setData(p=>({...p,fechaInicio:e.target.value}))} /></Field>
          <Field label="Fecha Término *"><input type="date" style={css.input} value={data.fechaTermino} onChange={e=>setData(p=>({...p,fechaTermino:e.target.value}))} /></Field>
        </div>
        <div style={css.formGrid}>
          <Field label="Estado">
            <select style={css.select} value={data.estado} onChange={e=>setData(p=>({...p,estado:e.target.value}))}>
              {ESTADOS.map(e=><option key={e} value={e}>{ESTADO_LABELS[e]}</option>)}
            </select>
          </Field>
          <Field label="Horas estimadas">
            <input type="number" min={0.5} max={999} step={0.5} style={css.input} value={data.horasEstimadas||1} onChange={e=>setData(p=>({...p,horasEstimadas:parseFloat(e.target.value)||1}))} />
          </Field>
        </div>
        <Field label="Descripción"><textarea style={{ ...css.input, minHeight:60, resize:"vertical" }} value={data.descripcion||""} onChange={e=>setData(p=>({...p,descripcion:e.target.value}))} placeholder="Detalles adicionales..." /></Field>
        <div style={{ display:"flex", gap:8, justifyContent:"flex-end", marginTop:8 }}>
          <button style={css.btn("ghost")} onClick={onCancelar}>Cancelar</button>
          <button style={css.btn("primary")} onClick={onGuardar} disabled={guardando}>{guardando?"Guardando...":titulo}</button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
        <div style={css.sectionTitle}><span style={{ color:G.accent }}>▦</span> Tareas</div>
        <button style={css.btn("primary")} onClick={()=>setShowForm(true)}>+ Nueva Tarea</button>
      </div>

      {/* Barra de búsqueda + filtro responsable */}
      <div style={{ display:"flex", gap:10, marginBottom:12, flexWrap:"wrap", alignItems:"center" }}>
        <div style={{ position:"relative", flex:"1 1 220px", maxWidth:320 }}>
          <span style={{ position:"absolute", left:10, top:"50%", transform:"translateY(-50%)", color:G.textDim, fontSize:13 }}>🔍</span>
          <input style={{ ...css.input, paddingLeft:32 }} placeholder="Buscar en título, descripción, responsable..." value={busqueda} onChange={e=>setBusqueda(e.target.value)} />
          {busqueda && <button onClick={()=>setBusqueda("")} style={{ position:"absolute", right:8, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", color:G.textDim, cursor:"pointer", fontSize:16 }}>×</button>}
        </div>
        <div style={{ display:"flex", gap:4, flexWrap:"wrap" }}>
          <button onClick={()=>setFiltroResp("todos")} style={{ ...css.navBtn(filtroResp==="todos"), fontSize:11 }}>Todos ({tareas.length})</button>
          {RESPONSABLES.map(r => {
            const cnt=tareas.filter(t=>t.responsable===r&&t.estado!=="completado").length;
            if (tareas.filter(t=>t.responsable===r).length===0) return null;
            return <button key={r} onClick={()=>setFiltroResp(r)} style={{ ...css.navBtn(filtroResp===r), fontSize:11 }}>{r.split(" ")[0]} {cnt>0&&<span style={{ background:filtroResp===r?"#ffffff44":G.accentOrange, color:filtroResp===r?"#fff":"#000", borderRadius:99, padding:"0 5px", fontSize:9, marginLeft:4 }}>{cnt}</span>}</button>;
          })}
        </div>
      </div>

      {busqueda && tareasFiltradas.length===0 && (
        <div style={{ background:G.accentLight, border:`1px solid ${G.accent}33`, borderRadius:8, padding:"12px 16px", marginBottom:16, fontSize:12, color:G.accent }}>
          Sin resultados para "<strong>{busqueda}</strong>". Prueba con otro término.
        </div>
      )}

      <div style={{ background:G.surface, border:`1px solid ${G.accent}33`, borderRadius:6, padding:"10px 14px", marginBottom:16, fontSize:11, color:G.accent }}>
        📅 Al guardar, se descargará un archivo <strong>.ics</strong> para Outlook. Haz clic en ✎ para editar una tarea existente.
      </div>

      {/* Modal crear */}
      {showForm && (
        <div style={css.modal} onClick={e=>e.target===e.currentTarget&&setShowForm(false)}>
          <div style={css.modalBox}>
            <div style={{ fontSize:13, fontWeight:700, marginBottom:20, color:G.accent }}>NUEVA TAREA</div>
            <FormTarea titulo="Guardar Tarea" data={form} setData={setForm} onGuardar={agregarTarea} onCancelar={()=>setShowForm(false)} guardando={sending} />
          </div>
        </div>
      )}

      {/* Modal editar */}
      {editTarea && (
        <div style={css.modal} onClick={e=>e.target===e.currentTarget&&setEditTarea(null)}>
          <div style={css.modalBox}>
            <div style={{ fontSize:13, fontWeight:700, marginBottom:4, color:G.accent }}>EDITAR TAREA</div>
            <div style={{ fontSize:11, color:G.textDim, marginBottom:16 }}>Los cambios se guardan en Firebase al confirmar.</div>
            <FormTarea titulo="Guardar Cambios" data={editTarea} setData={setEditTarea} onGuardar={guardarEdicion} onCancelar={()=>setEditTarea(null)} guardando={false} />
          </div>
        </div>
      )}

      {/* Tablero Kanban */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:16 }}>
        {ESTADOS.map(estado => {
          const col = byEstado[estado];
          const limite = paginaCol[estado]||KANBAN_PAGE;
          const visibles = col.slice(0, limite);
          const hayMas = col.length > limite;
          return (
            <div key={estado}
              style={{ background:dragOver===estado?G.accentLight:"#F7F8FC", border:`2px solid ${dragOver===estado?G.accent:G.border}`, borderRadius:10, padding:12, minHeight:400, transition:"all .15s" }}
              onDragOver={e=>{e.preventDefault();setDragOver(estado);}}
              onDragLeave={()=>setDragOver(null)}
              onDrop={()=>onDrop(estado)}
            >
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
                <div style={{ fontSize:12, color:ESTADO_COLOR[estado], fontWeight:600 }}>{ESTADO_ICONS[estado]} {ESTADO_LABELS[estado]}</div>
                <span style={{ fontSize:11, color:G.textDim, background:G.border+"55", padding:"1px 7px", borderRadius:99 }}>{col.length}</span>
              </div>

              {visibles.map(tarea => {
                const urgente = tarea.estado!=="completado" && diasHasta(tarea.fechaTermino)<=3;
                return (
                  <div key={tarea.id} draggable
                    onDragStart={()=>setDragId(tarea.id)}
                    onDragEnd={()=>{setDragId(null);setDragOver(null);}}
                    onMouseEnter={()=>setHoveredCard(tarea.id)}
                    onMouseLeave={()=>setHoveredCard(null)}
                    style={{ ...css.card, borderColor:urgente?G.accentOrange:(hoveredCard===tarea.id?PRIORIDAD_COLOR[tarea.prioridad]:G.border), opacity:dragId===tarea.id?0.4:1, boxShadow:urgente?`0 0 0 1px ${G.accentOrange}44`:"none" }}
                  >
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:6 }}>
                      <div style={{ fontSize:12, fontWeight:700, lineHeight:1.4, flex:1 }}>{tarea.titulo}</div>
                      <div style={{ display:"flex", gap:4, marginLeft:6, flexShrink:0 }}>
                        {/* Botón EDITAR */}
                        <button title="Editar tarea" onClick={()=>setEditTarea({...tarea})}
                          style={{ background:"none", border:"none", color:G.accent, cursor:"pointer", fontSize:13, padding:0 }}>✎</button>
                        {/* Botón ELIMINAR */}
                        <button title="Eliminar tarea" onClick={()=>eliminar(tarea.id)}
                          style={{ background:"none", border:"none", color:G.textDim, cursor:"pointer", fontSize:14, padding:0 }}>×</button>
                      </div>
                    </div>
                    {tarea.descripcion&&<div style={{ fontSize:10, color:G.textMuted, marginBottom:6, lineHeight:1.5 }}>{tarea.descripcion}</div>}
                    <div style={{ display:"flex", flexWrap:"wrap", gap:4, marginBottom:8 }}>
                      <span style={css.badge(PRIORIDAD_COLOR[tarea.prioridad])}>{tarea.prioridad}</span>
                      <span style={{ ...css.badge(G.textDim), fontSize:10 }}>⏱{tarea.horasEstimadas||1}h</span>
                      <DiasTag fechaTermino={tarea.fechaTermino} estado={tarea.estado} />
                    </div>
                    <div style={{ fontSize:10, color:G.textMuted, marginBottom:8 }}>
                      <div>👤 {tarea.responsable}</div>
                      <div style={{ marginTop:2 }}>📅 {tarea.fechaTermino}</div>
                    </div>
                    <div style={{ marginBottom:8 }}>
                      <button onClick={()=>descargarICS({titulo:tarea.titulo,descripcion:tarea.descripcion,fechaInicio:tarea.fechaInicio,fechaTermino:tarea.fechaTermino,responsable:tarea.responsable},tarea.titulo)}
                        style={{ fontSize:9, color:G.accent, background:"transparent", border:`1px solid ${G.accent}44`, borderRadius:3, padding:"2px 7px", cursor:"pointer", fontFamily:"inherit" }}>
                        📅 Descargar .ics
                      </button>
                    </div>
                    <div style={{ borderTop:`1px solid ${G.borderLight}`, paddingTop:8 }}>
                      <div style={{ fontSize:9, color:G.textDim, marginBottom:4, letterSpacing:"0.06em", textTransform:"uppercase" }}>Mover a:</div>
                      <div style={{ display:"flex", gap:3, flexWrap:"wrap" }}>
                        {ESTADOS.filter(e=>e!==tarea.estado).map(e=>(
                          <button key={e} onClick={()=>cambiarEstado(tarea.id,e)}
                            style={{ padding:"3px 7px", fontSize:9, fontFamily:"inherit", fontWeight:700, background:"transparent", color:ESTADO_COLOR[e], border:`1px solid ${ESTADO_COLOR[e]}55`, borderRadius:3, cursor:"pointer" }}>
                            {ESTADO_ICONS[e]} {ESTADO_LABELS[e]}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}

              {hayMas && (
                <button onClick={()=>verMasCol(estado)}
                  style={{ width:"100%", padding:"8px 0", fontSize:11, fontFamily:"inherit", fontWeight:600, background:"transparent", color:G.accent, border:`1px dashed ${G.accent}55`, borderRadius:8, cursor:"pointer", marginTop:4 }}>
                  Ver {Math.min(KANBAN_PAGE, col.length-limite)} más ({col.length-limite} oculta{col.length-limite!==1?"s":""})
                </button>
              )}
              {col.length === 0 && <div style={{ fontSize:11, color:G.textDim, textAlign:"center", padding:"24px 0" }}>Sin tareas</div>}
            </div>
          );
        })}
      </div>

      {/* Tabla completa */}
      <div style={{ marginTop:32 }}>
        <div style={css.sectionTitle}><span style={{ color:G.accentGreen }}>⊞</span> Registro Completo</div>
        <div style={{ overflowX:"auto" }}>
          <table style={{ width:"100%", borderCollapse:"collapse", fontSize:11 }}>
            <thead>
              <tr style={{ borderBottom:`1px solid ${G.border}` }}>
                {["Título","Responsable","Inicio","Término","Días","Estado","Prioridad","Horas"].map(h=>(
                  <th key={h} style={{ padding:"8px 12px", textAlign:"left", color:G.textMuted, fontSize:10, textTransform:"uppercase", letterSpacing:"0.06em" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tareasFiltradas.map(t => {
                const d=diasHasta(t.fechaTermino);
                const dc=t.estado==="completado"?G.textDim:d<0?G.accentRed:d<=3?G.accentOrange:G.textMuted;
                return (
                  <tr key={t.id} style={{ borderBottom:`1px solid ${G.borderLight}` }}>
                    <td style={{ padding:"8px 12px" }}>
                      <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                        {t.titulo}
                        <button title="Editar" onClick={()=>setEditTarea({...t})} style={{ background:"none", border:"none", color:G.textDim, cursor:"pointer", fontSize:12 }}>✎</button>
                      </div>
                    </td>
                    <td style={{ padding:"8px 12px", color:G.textMuted }}>{t.responsable}</td>
                    <td style={{ padding:"8px 12px", color:G.textMuted }}>{t.fechaInicio}</td>
                    <td style={{ padding:"8px 12px", color:G.textMuted }}>{t.fechaTermino}</td>
                    <td style={{ padding:"8px 12px", color:dc, fontWeight:d<=3&&t.estado!=="completado"?700:400 }}>{t.estado==="completado"?"—":d<0?`−${Math.abs(d)}d`:`${d}d`}</td>
                    <td style={{ padding:"8px 12px" }}>
                      <select style={{ ...css.select, padding:"3px 6px", width:"auto", fontSize:10 }} value={t.estado} onChange={e=>cambiarEstado(t.id,e.target.value)}>
                        {ESTADOS.map(e=><option key={e} value={e}>{ESTADO_LABELS[e]}</option>)}
                      </select>
                    </td>
                    <td style={{ padding:"8px 12px" }}><span style={css.badge(PRIORIDAD_COLOR[t.prioridad])}>{t.prioridad}</span></td>
                    <td style={{ padding:"8px 12px", color:G.textMuted }}>{t.horasEstimadas||1}h</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── REUNIONES ────────────────────────────────────────────────────────────────
const REUN_ESTADOS     = ["programada", "en_progreso", "realizada", "cancelada"];
const REUN_ESTADO_LABELS = { programada:"Programada", en_progreso:"En Progreso", realizada:"Realizada", cancelada:"Cancelada" };
const REUN_ESTADO_COLOR  = { programada:G.accent, en_progreso:G.accentOrange, realizada:G.accentGreen, cancelada:G.accentRed };

function ReunionesModule({ reuniones, fb, addToast }) {
  const [showForm,    setShowForm]    = useState(false);
  const [editReunion, setEditReunion] = useState(null);
  const [filtroEstado, setFiltroEstado] = useState("todos");

  const reunionVacia = { titulo:"", fecha:hoy(), hora:"09:00", lugar:"", responsable:RESPONSABLES[0], participantes:"", objetivo:"", acuerdos:"", estado:"programada" };
  const [form, setForm] = useState(reunionVacia);

  async function guardar() {
    if (!form.titulo || !form.fecha) { addToast("Completa título y fecha.", false); return; }
    const { id:_, ...nueva } = form;
    await fb.agregar(nueva);
    descargarICS({ titulo:`Reunión: ${nueva.titulo}`, descripcion:nueva.objetivo, fechaInicio:nueva.fecha, fechaTermino:nueva.fecha, responsable:nueva.responsable, lugar:nueva.lugar }, `Reunion_${nueva.titulo}`);
    addToast("Reunión registrada.");
    setForm(reunionVacia); setShowForm(false);
  }

  async function guardarEdicion() {
    if (!editReunion.titulo || !editReunion.fecha) { addToast("Completa título y fecha.", false); return; }
    const { id, ...cambios } = editReunion;
    await fb.actualizar(id, cambios);
    addToast("Reunión actualizada.");
    setEditReunion(null);
  }

  function eliminar(id) {
    if (!window.confirm("¿Eliminar esta reunión?")) return;
    fb.eliminar(id);
    addToast("Reunión eliminada.");
  }

  function FormReunion({ data, setData, onGuardar, onCancelar, tituloBoton }) {
    return (
      <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
        <Field label="Título *"><input style={css.input} value={data.titulo} onChange={e=>setData(p=>({...p,titulo:e.target.value}))} placeholder="Nombre de la reunión..." /></Field>
        <div style={css.formGrid}>
          <Field label="Fecha *"><input type="date" style={css.input} value={data.fecha} onChange={e=>setData(p=>({...p,fecha:e.target.value}))} /></Field>
          <Field label="Hora"><input type="time" style={css.input} value={data.hora||"09:00"} onChange={e=>setData(p=>({...p,hora:e.target.value}))} /></Field>
          <Field label="Responsable / Moderador"><select style={css.select} value={data.responsable} onChange={e=>setData(p=>({...p,responsable:e.target.value}))}>{RESPONSABLES.map(r=><option key={r}>{r}</option>)}</select></Field>
          <Field label="Estado"><select style={css.select} value={data.estado} onChange={e=>setData(p=>({...p,estado:e.target.value}))}>{REUN_ESTADOS.map(e=><option key={e} value={e}>{REUN_ESTADO_LABELS[e]}</option>)}</select></Field>
        </div>
        <Field label="Lugar / Link"><input style={css.input} value={data.lugar||""} onChange={e=>setData(p=>({...p,lugar:e.target.value}))} placeholder="Sala, dirección o enlace Zoom/Teams..." /></Field>
        <Field label="Participantes"><input style={css.input} value={data.participantes||""} onChange={e=>setData(p=>({...p,participantes:e.target.value}))} placeholder="Nombres separados por coma..." /></Field>
        <Field label="Objetivo / Temario"><textarea style={{ ...css.input, minHeight:60, resize:"vertical" }} value={data.objetivo||""} onChange={e=>setData(p=>({...p,objetivo:e.target.value}))} placeholder="¿Para qué es esta reunión?..." /></Field>
        <Field label="Acuerdos / Compromisos"><textarea style={{ ...css.input, minHeight:60, resize:"vertical" }} value={data.acuerdos||""} onChange={e=>setData(p=>({...p,acuerdos:e.target.value}))} placeholder="Decisiones tomadas y compromisos asumidos..." /></Field>
        <div style={{ display:"flex", gap:8, justifyContent:"flex-end" }}>
          <button style={css.btn("ghost")} onClick={onCancelar}>Cancelar</button>
          <button style={{ ...css.btn("primary"), background:G.accentPurple, borderColor:G.accentPurple }} onClick={onGuardar}>{tituloBoton}</button>
        </div>
      </div>
    );
  }

  const reunFiltradas = filtroEstado==="todos" ? reuniones : reuniones.filter(r=>r.estado===filtroEstado);
  const proximas = [...reuniones].filter(r=>r.estado!=="realizada"&&r.estado!=="cancelada").sort((a,b)=>a.fecha.localeCompare(b.fecha));

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
        <div style={css.sectionTitle}><span style={{ color:G.accentPurple }}>◉</span> Reuniones</div>
        <button style={{ ...css.btn("primary"), background:G.accentPurple, borderColor:G.accentPurple }} onClick={()=>setShowForm(true)}>+ Nueva Reunión</button>
      </div>

      <div style={{ background:G.surface, border:`1px solid ${G.accentPurple}33`, borderRadius:6, padding:"10px 14px", marginBottom:16, fontSize:11, color:G.accentPurple }}>
        📅 Al registrar se descarga un <strong>.ics</strong> para Outlook. Usa ✎ para editar y registrar acuerdos y compromisos.
      </div>

      {showForm && (
        <div style={css.modal} onClick={e=>e.target===e.currentTarget&&setShowForm(false)}>
          <div style={css.modalBox}>
            <div style={{ fontSize:13, fontWeight:700, marginBottom:20, color:G.accentPurple }}>NUEVA REUNIÓN</div>
            <FormReunion data={form} setData={setForm} onGuardar={guardar} onCancelar={()=>setShowForm(false)} tituloBoton="Registrar" />
          </div>
        </div>
      )}

      {editReunion && (
        <div style={css.modal} onClick={e=>e.target===e.currentTarget&&setEditReunion(null)}>
          <div style={css.modalBox}>
            <div style={{ fontSize:13, fontWeight:700, marginBottom:4, color:G.accentPurple }}>EDITAR REUNIÓN</div>
            <div style={{ fontSize:11, color:G.textDim, marginBottom:16 }}>Actualiza estado, acuerdos y compromisos.</div>
            <FormReunion data={editReunion} setData={setEditReunion} onGuardar={guardarEdicion} onCancelar={()=>setEditReunion(null)} tituloBoton="Guardar Cambios" />
          </div>
        </div>
      )}

      {/* Próximas reuniones */}
      {proximas.length > 0 && (
        <div style={{ background:`${G.accentPurple}08`, border:`1px solid ${G.accentPurple}33`, borderRadius:10, padding:"14px 18px", marginBottom:20 }}>
          <div style={{ fontSize:11, fontWeight:700, color:G.accentPurple, marginBottom:10, textTransform:"uppercase", letterSpacing:"0.07em" }}>Próximas ({proximas.length})</div>
          <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
            {proximas.slice(0,4).map(r => {
              const d = diasHasta(r.fecha);
              const esHoy = d===0;
              return (
                <div key={r.id} style={{ background:"#fff", border:`1.5px solid ${G.accentPurple}44`, borderRadius:8, padding:"10px 14px", minWidth:180, flex:"1 1 180px", maxWidth:260 }}>
                  <div style={{ fontSize:12, fontWeight:700, color:G.text, marginBottom:4 }}>{r.titulo}</div>
                  <div style={{ fontSize:10, color:G.textMuted }}>👤 {r.responsable}</div>
                  {r.lugar && <div style={{ fontSize:10, color:G.textMuted }}>📍 {r.lugar}</div>}
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginTop:6 }}>
                    <div style={{ fontSize:11, fontWeight:600, color:G.accentPurple }}>{r.fecha}{r.hora?` · ${r.hora}`:""}</div>
                    {d>=0&&<span style={{ fontSize:10, color:esHoy?G.accentPurple:G.textDim, fontWeight:esHoy?700:400 }}>{esHoy?"Hoy":`en ${d}d`}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Filtros */}
      <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:16 }}>
        <button onClick={()=>setFiltroEstado("todos")} style={{ ...css.navBtn(filtroEstado==="todos"), fontSize:11 }}>Todas ({reuniones.length})</button>
        {REUN_ESTADOS.map(estado => {
          const cnt = reuniones.filter(r=>r.estado===estado).length;
          if (cnt===0) return null;
          const color = REUN_ESTADO_COLOR[estado];
          return <button key={estado} onClick={()=>setFiltroEstado(estado)} style={{ ...css.navBtn(filtroEstado===estado), fontSize:11, ...(filtroEstado===estado?{background:color,borderColor:color}:{}) }}>{REUN_ESTADO_LABELS[estado]} <span style={{ marginLeft:4, background:filtroEstado===estado?"#ffffff44":color+"22", color:filtroEstado===estado?"#fff":color, borderRadius:99, padding:"0 5px", fontSize:9 }}>{cnt}</span></button>;
        })}
      </div>

      {/* Listado */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(320px,1fr))", gap:16 }}>
        {reunFiltradas.length===0 && <div style={{ fontSize:12, color:G.textDim, padding:"24px 0" }}>Sin reuniones{filtroEstado!=="todos"?` con estado "${REUN_ESTADO_LABELS[filtroEstado]}"`:""}</div>}
        {reunFiltradas.map(r => {
          const color = REUN_ESTADO_COLOR[r.estado] || G.textMuted;
          return (
            <div key={r.id} style={{ background:G.surface, border:`2px solid ${color}33`, borderRadius:8, padding:16 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:10 }}>
                <span style={{ fontSize:14, fontWeight:700, color:G.text, flex:1 }}>{r.titulo}</span>
                <div style={{ display:"flex", gap:6, alignItems:"center", flexShrink:0, marginLeft:8 }}>
                  <span style={css.badge(color)}>{REUN_ESTADO_LABELS[r.estado]||r.estado}</span>
                  <button title="Editar reunión" onClick={()=>setEditReunion({...r})} style={{ background:"none", border:`1px solid ${G.border}`, borderRadius:4, color:G.accentPurple, cursor:"pointer", fontSize:12, padding:"2px 7px" }}>✎</button>
                  <button title="Eliminar" onClick={()=>eliminar(r.id)} style={{ background:"none", border:"none", color:G.textDim, cursor:"pointer", fontSize:16, padding:0 }}>×</button>
                </div>
              </div>
              <div style={{ fontSize:11, color:G.textMuted, display:"flex", flexDirection:"column", gap:3, marginBottom:10 }}>
                <div>📅 {r.fecha}{r.hora?` · ${r.hora}`:""}</div>
                {r.lugar&&<div>📍 {r.lugar}</div>}
                <div>👤 {r.responsable}</div>
                {r.participantes&&<div>👥 {r.participantes}</div>}
              </div>
              {r.objetivo&&<div style={{ fontSize:11, color:G.text, background:G.bg, borderRadius:6, padding:"8px 10px", marginBottom:8 }}><strong>Objetivo:</strong> {r.objetivo}</div>}
              {r.acuerdos&&<div style={{ fontSize:11, color:G.accentGreen, background:G.accentGreenLight, borderRadius:6, padding:"8px 10px", marginBottom:8 }}><strong>Acuerdos:</strong> {r.acuerdos}</div>}
              <button onClick={()=>descargarICS({titulo:`Reunión: ${r.titulo}`,descripcion:r.objetivo,fechaInicio:r.fecha,fechaTermino:r.fecha,responsable:r.responsable,lugar:r.lugar},`Reunion_${r.titulo}`)}
                style={{ fontSize:10, color:G.accentPurple, background:"transparent", border:`1px solid ${G.accentPurple}44`, borderRadius:4, padding:"3px 9px", cursor:"pointer", fontFamily:"inherit" }}>
                📅 Descargar .ics
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── VISITAS ──────────────────────────────────────────────────────────────────
// Mejoras: campos de asistentes, compromisos surgidos y evidencia. Edición in-situ.
function VisitasModule({ visitas, fb, addToast }) {
  const [showForm,  setShowForm]  = useState(false);
  const [editVisita,setEditVisita]= useState(null);
  const [filtroEstadoVis, setFiltroEstadoVis] = useState("todos");

  const visitaVacia = { fecha:hoy(), lugar:"", responsable:RESPONSABLES[0], objetivo:"", resultado:"", estado:"programada", asistentes:"", compromisos:"", evidencia:"" };
  const [form, setForm] = useState(visitaVacia);

  async function guardar() {
    if (!form.lugar||!form.objetivo) { addToast("Completa lugar y objetivo.", false); return; }
    const { id:_, ...nueva } = form;
    await fb.agregar(nueva);
    descargarICS({ titulo:`Visita: ${nueva.lugar}`, descripcion:nueva.objetivo, fechaInicio:nueva.fecha, fechaTermino:nueva.fecha, responsable:nueva.responsable, lugar:nueva.lugar }, `Visita_${nueva.lugar}`);
    addToast("Visita registrada.");
    setForm(visitaVacia); setShowForm(false);
  }

  async function guardarEdicion() {
    if (!editVisita.lugar||!editVisita.objetivo) { addToast("Completa lugar y objetivo.", false); return; }
    const { id, ...cambios } = editVisita;
    await fb.actualizar(id, cambios);
    addToast("Visita actualizada.");
    setEditVisita(null);
  }

  function FormVisita({ data, setData, onGuardar, onCancelar, tituloBoton }) {
    return (
      <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
        <div style={css.formGrid}>
          <Field label="Fecha"><input type="date" style={css.input} value={data.fecha} onChange={e=>setData(p=>({...p,fecha:e.target.value}))} /></Field>
          <Field label="Responsable"><select style={css.select} value={data.responsable} onChange={e=>setData(p=>({...p,responsable:e.target.value}))}>{RESPONSABLES.map(r=><option key={r}>{r}</option>)}</select></Field>
        </div>
        <Field label="Lugar *"><input style={css.input} value={data.lugar} onChange={e=>setData(p=>({...p,lugar:e.target.value}))} placeholder="Dirección o nombre del lugar..." /></Field>
        <Field label="Asistentes"><input style={css.input} value={data.asistentes||""} onChange={e=>setData(p=>({...p,asistentes:e.target.value}))} placeholder="Nombres separados por coma..." /></Field>
        <Field label="Objetivo *"><textarea style={{ ...css.input, minHeight:60, resize:"vertical" }} value={data.objetivo} onChange={e=>setData(p=>({...p,objetivo:e.target.value}))} placeholder="Objetivo de la visita..." /></Field>
        <Field label="Resultado / Observaciones"><textarea style={{ ...css.input, minHeight:60, resize:"vertical" }} value={data.resultado||""} onChange={e=>setData(p=>({...p,resultado:e.target.value}))} placeholder="Resultado obtenido..." /></Field>
        <Field label="Compromisos surgidos"><textarea style={{ ...css.input, minHeight:60, resize:"vertical" }} value={data.compromisos||""} onChange={e=>setData(p=>({...p,compromisos:e.target.value}))} placeholder="Acuerdos, tareas y compromisos que surgieron en la visita..." /></Field>
        <Field label="Evidencia (URL o referencia)"><input style={css.input} value={data.evidencia||""} onChange={e=>setData(p=>({...p,evidencia:e.target.value}))} placeholder="https://... o nombre del archivo adjunto..." /></Field>
        <Field label="Estado">
          <select style={css.select} value={data.estado} onChange={e=>setData(p=>({...p,estado:e.target.value}))}>
            {Object.keys(VEST_COLOR).map(e=><option key={e} value={e}>{VEST_LABELS[e]}</option>)}
          </select>
        </Field>
        <div style={{ display:"flex", gap:8, justifyContent:"flex-end" }}>
          <button style={css.btn("ghost")} onClick={onCancelar}>Cancelar</button>
          <button style={css.btn("success")} onClick={onGuardar}>{tituloBoton}</button>
        </div>
      </div>
    );
  }

  const visFiltered = filtroEstadoVis==="todos" ? visitas : visitas.filter(v=>(v.estado||"programada")===filtroEstadoVis);

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
        <div style={css.sectionTitle}><span style={{ color:G.accentOrange }}>◈</span> Visitas / Trabajo en Terreno</div>
        <button style={css.btn("primary")} onClick={()=>setShowForm(true)}>+ Nueva Visita</button>
      </div>
      <div style={{ background:G.surface, border:`1px solid ${G.accentOrange}33`, borderRadius:6, padding:"10px 14px", marginBottom:20, fontSize:11, color:G.accentOrange }}>
        📅 Al registrar se descarga un <strong>.ics</strong> para Outlook. Usa ✎ para editar y registrar asistentes, resultados y compromisos de seguimiento.
      </div>

      {showForm && (
        <div style={css.modal} onClick={e=>e.target===e.currentTarget&&setShowForm(false)}>
          <div style={css.modalBox}>
            <div style={{ fontSize:13, fontWeight:700, marginBottom:20, color:G.accentOrange }}>REGISTRAR VISITA</div>
            <FormVisita data={form} setData={setForm} onGuardar={guardar} onCancelar={()=>setShowForm(false)} tituloBoton="Registrar" />
          </div>
        </div>
      )}

      {editVisita && (
        <div style={css.modal} onClick={e=>e.target===e.currentTarget&&setEditVisita(null)}>
          <div style={css.modalBox}>
            <div style={{ fontSize:13, fontWeight:700, marginBottom:4, color:G.accentOrange }}>EDITAR VISITA</div>
            <div style={{ fontSize:11, color:G.textDim, marginBottom:16 }}>Actualiza asistentes, resultado, compromisos y evidencia.</div>
            <FormVisita data={editVisita} setData={setEditVisita} onGuardar={guardarEdicion} onCancelar={()=>setEditVisita(null)} tituloBoton="Guardar Cambios" />
          </div>
        </div>
      )}

      {/* Filtros */}
      <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:16 }}>
        <button onClick={()=>setFiltroEstadoVis("todos")} style={{ ...css.navBtn(filtroEstadoVis==="todos"), fontSize:11 }}>Todas ({visitas.length})</button>
        {Object.entries(VEST_COLOR).map(([estado,color]) => {
          const cnt=visitas.filter(v=>(v.estado||"programada")===estado).length;
          if (cnt===0) return null;
          return <button key={estado} onClick={()=>setFiltroEstadoVis(estado)} style={{ ...css.navBtn(filtroEstadoVis===estado), fontSize:11, ...(filtroEstadoVis===estado?{background:color,borderColor:color}:{}) }}>{VEST_LABELS[estado]} <span style={{ marginLeft:4, background:filtroEstadoVis===estado?"#ffffff44":color+"22", color:filtroEstadoVis===estado?"#fff":color, borderRadius:99, padding:"0 5px", fontSize:9 }}>{cnt}</span></button>;
        })}
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(320px,1fr))", gap:16 }}>
        {visFiltered.map(v => {
          const estadoActual=v.estado||"pendiente";
          const colorEstado=VEST_COLOR[estadoActual]||G.textMuted;
          return (
            <div key={v.id} style={{ background:G.surface, border:`2px solid ${colorEstado}33`, borderRadius:8, padding:16 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:10 }}>
                <span style={{ fontSize:14, fontWeight:600, color:G.text, flex:1 }}>{v.lugar}</span>
                <div style={{ display:"flex", gap:6, alignItems:"center", flexShrink:0, marginLeft:8 }}>
                  <span style={css.badge(colorEstado)}>{VEST_LABELS[estadoActual]||estadoActual}</span>
                  <button title="Editar visita" onClick={()=>setEditVisita({...v})}
                    style={{ background:"none", border:`1px solid ${G.border}`, borderRadius:4, color:G.accent, cursor:"pointer", fontSize:12, padding:"2px 7px" }}>✎</button>
                </div>
              </div>
              <div style={{ fontSize:11, color:G.textMuted, marginBottom:6 }}>📅 {v.fecha} · 👤 {v.responsable}</div>
              {v.asistentes && <div style={{ fontSize:11, color:G.textMuted, marginBottom:4 }}>👥 <strong>Asistentes:</strong> {v.asistentes}</div>}
              <div style={{ fontSize:11, marginBottom:v.resultado||v.compromisos||v.evidencia?8:0 }}><span style={{ color:G.textMuted }}>Objetivo: </span>{v.objetivo}</div>
              {v.resultado && <div style={{ fontSize:11, color:G.accentGreen, marginBottom:6 }}><span style={{ color:G.textMuted }}>Resultado: </span>{v.resultado}</div>}
              {v.compromisos && (
                <div style={{ background:G.accentOrangeLight, border:`1px solid ${G.accentOrange}33`, borderRadius:6, padding:"8px 10px", marginBottom:6 }}>
                  <div style={{ fontSize:10, fontWeight:700, color:G.accentOrange, marginBottom:3 }}>📌 COMPROMISOS DE SEGUIMIENTO</div>
                  <div style={{ fontSize:11, color:G.text, whiteSpace:"pre-line" }}>{v.compromisos}</div>
                </div>
              )}
              {v.evidencia && (
                <div style={{ fontSize:11, marginBottom:8 }}>
                  <span style={{ color:G.textMuted }}>🔗 Evidencia: </span>
                  {v.evidencia.startsWith("http") ? <a href={v.evidencia} target="_blank" rel="noopener noreferrer" style={{ color:G.accent }}>{v.evidencia}</a> : <span>{v.evidencia}</span>}
                </div>
              )}
              <div style={{ borderTop:`1px solid ${G.borderLight}`, paddingTop:10, marginTop:8 }}>
                <div style={{ fontSize:9, color:G.textDim, marginBottom:6, letterSpacing:"0.06em", textTransform:"uppercase" }}>Cambiar estado:</div>
                <div style={{ display:"flex", gap:4, flexWrap:"wrap" }}>
                  {Object.keys(VEST_COLOR).filter(e=>e!==estadoActual).map(e=>(
                    <button key={e} onClick={()=>fb.actualizar(v.id,{estado:e})}
                      style={{ padding:"3px 8px", fontSize:9, fontFamily:"inherit", fontWeight:700, background:"transparent", color:VEST_COLOR[e], border:`1px solid ${VEST_COLOR[e]}55`, borderRadius:3, cursor:"pointer" }}>
                      {VEST_LABELS[e]}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ marginTop:10, display:"flex", gap:8, alignItems:"center" }}>
                <button onClick={()=>descargarICS({titulo:`Visita: ${v.lugar}`,descripcion:v.objetivo,fechaInicio:v.fecha,fechaTermino:v.fecha,responsable:v.responsable,lugar:v.lugar},`Visita_${v.lugar}`)}
                  style={{ fontSize:9, color:G.accentOrange, background:"transparent", border:`1px solid ${G.accentOrange}44`, borderRadius:3, padding:"2px 7px", cursor:"pointer", fontFamily:"inherit" }}>📅 .ics</button>
                <button onClick={()=>{ if(window.confirm("¿Eliminar esta visita?")) fb.eliminar(v.id); }}
                  style={{ ...css.btn("danger"), padding:"4px 10px", fontSize:10 }}>Eliminar</button>
              </div>
            </div>
          );
        })}
        {visitas.length===0&&<div style={{ color:G.textDim, fontSize:11, padding:20 }}>No hay visitas registradas.</div>}
      </div>

      {/* Tabla */}
      <div style={{ marginTop:32 }}>
        <div style={css.sectionTitle}><span style={{ color:G.accentGreen }}>⊞</span> Registro Visitas</div>
        <div style={{ overflowX:"auto" }}>
          <table style={{ width:"100%", borderCollapse:"collapse", fontSize:11 }}>
            <thead><tr style={{ borderBottom:`1px solid ${G.border}` }}>{["Fecha","Lugar","Responsable","Asistentes","Objetivo","Compromisos","Evidencia","Estado"].map(h=><th key={h} style={{ padding:"8px 12px",textAlign:"left",color:G.textMuted,fontSize:10,textTransform:"uppercase",letterSpacing:"0.06em" }}>{h}</th>)}</tr></thead>
            <tbody>{visitas.map(v=>{
              const estadoActual=v.estado||"pendiente";
              return (
                <tr key={v.id} style={{ borderBottom:`1px solid ${G.borderLight}` }}>
                  <td style={{ padding:"8px 12px" }}>{v.fecha}</td>
                  <td style={{ padding:"8px 12px",fontWeight:700 }}>{v.lugar}</td>
                  <td style={{ padding:"8px 12px",color:G.textMuted }}>{v.responsable}</td>
                  <td style={{ padding:"8px 12px",color:G.textMuted }}>{v.asistentes||"—"}</td>
                  <td style={{ padding:"8px 12px",color:G.textMuted,maxWidth:180,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{v.objetivo}</td>
                  <td style={{ padding:"8px 12px",color:G.textMuted,maxWidth:180,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{v.compromisos||"—"}</td>
                  <td style={{ padding:"8px 12px",color:G.textMuted }}>{v.evidencia||"—"}</td>
                  <td style={{ padding:"8px 12px" }}>
                    <select style={{ ...css.select, padding:"3px 6px", width:"auto", fontSize:10 }} value={estadoActual} onChange={e=>fb.actualizar(v.id,{estado:e.target.value})}>
                      {Object.entries(VEST_COLOR).map(([e])=><option key={e} value={e}>{VEST_LABELS[e]}</option>)}
                    </select>
                  </td>
                </tr>
              );
            })}</tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── SOE ──────────────────────────────────────────────────────────────────────
// Mejora: se registra timestamp y quién aprobó/rechazó con fecha y hora exactas.
function SOEModule({ soe, fb, addToast }) {
  const [showForm,  setShowForm]  = useState(false);
  const [jefatura,  setJefatura]  = useState(null);
  const [nombreJef, setNombreJef] = useState("");
  const [obsJef,    setObsJef]    = useState("");
  const [form, setForm] = useState({ fecha:hoy(), solicitante:RESPONSABLES[0], descripcion:"", horasExtra:1, estado:"pendiente", aprobadaPor:"", observacion:"" });
  const SOE_COLOR = { pendiente:G.accentYellow, aprobada:G.accentGreen, rechazada:G.accentRed };

  async function guardar() {
    if (!form.descripcion) { addToast("Ingresa una descripción.", false); return; }
    const { id:_, ...nueva } = form;
    await fb.agregar(nueva);
    await notificarSOEJefaturas(nueva);
    addToast("Solicitud enviada. Se notificó a jefaturas.");
    setForm({ fecha:hoy(), solicitante:RESPONSABLES[0], descripcion:"", horasExtra:1, estado:"pendiente", aprobadaPor:"", observacion:"" });
    setShowForm(false);
  }

  function abrirResolver(s) { setJefatura(s); setNombreJef(""); setObsJef(""); }

  function eliminar(id) {
    if (!window.confirm("¿Eliminar esta solicitud? Esta acción no se puede deshacer.")) return;
    fb.eliminar(id);
    addToast("Solicitud eliminada.");
  }

  async function aprobar(id) {
    if (!nombreJef.trim()) { alert("Debe ingresar el nombre de quien autoriza."); return; }
    await fb.actualizar(id, {
      estado: "aprobada",
      aprobadaPor: nombreJef.trim(),
      timestampAprobacion: new Date().toISOString(),
    });
    addToast(`Solicitud aprobada por ${nombreJef.trim()}.`);
    setJefatura(null); setNombreJef(""); setObsJef("");
  }

  async function rechazar(id) {
    if (!nombreJef.trim()) { alert("Debe ingresar el nombre de quien resuelve."); return; }
    await fb.actualizar(id, {
      estado: "rechazada",
      aprobadaPor: nombreJef.trim(),
      observacion: obsJef,
      timestampAprobacion: new Date().toISOString(),
    });
    addToast(`Solicitud rechazada por ${nombreJef.trim()}.`, false);
    setJefatura(null); setNombreJef(""); setObsJef("");
  }

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
        <div style={css.sectionTitle}><span style={{ color:G.accentPurple }}>⚡</span> Solicitud Trabajo Extraordinario</div>
        <button style={css.btn("primary")} onClick={()=>setShowForm(true)}>+ Nueva Solicitud</button>
      </div>
      <div style={{ background:G.surface, border:`1px solid ${G.accentYellow}33`, borderRadius:6, padding:12, marginBottom:20, fontSize:11, color:G.accentYellow }}>
        ⚠ Las solicitudes requieren autorización de jefatura. La resolución queda registrada con nombre y timestamp.
      </div>

      {showForm && (
        <div style={css.modal} onClick={e=>e.target===e.currentTarget&&setShowForm(false)}>
          <div style={css.modalBox}>
            <div style={{ fontSize:13, fontWeight:700, marginBottom:20, color:G.accentPurple }}>SOLICITUD TRABAJO EXTRAORDINARIO</div>
            <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
              <div style={css.formGrid}>
                <Field label="Fecha"><input type="date" style={css.input} value={form.fecha} onChange={e=>setForm(p=>({...p,fecha:e.target.value}))} /></Field>
                <Field label="Solicitante"><select style={css.select} value={form.solicitante} onChange={e=>setForm(p=>({...p,solicitante:e.target.value}))}>{RESPONSABLES.map(r=><option key={r}>{r}</option>)}</select></Field>
              </div>
              <Field label="Descripción *"><textarea style={{ ...css.input, minHeight:80, resize:"vertical" }} value={form.descripcion} onChange={e=>setForm(p=>({...p,descripcion:e.target.value}))} placeholder="Justificación y descripción del trabajo..." /></Field>
              <Field label="Horas extra estimadas"><input type="number" min={1} max={24} style={css.input} value={form.horasExtra} onChange={e=>setForm(p=>({...p,horasExtra:+e.target.value}))} /></Field>
              <div style={{ display:"flex", gap:8, justifyContent:"flex-end" }}>
                <button style={css.btn("ghost")} onClick={()=>setShowForm(false)}>Cancelar</button>
                <button style={css.btn("primary")} onClick={guardar}>Enviar Solicitud</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal resolución jefatura */}
      {jefatura && (
        <div style={css.modal}>
          <div style={css.modalBox}>
            <div style={{ fontSize:13, fontWeight:700, marginBottom:16, color:G.accentPurple }}>RESOLUCIÓN JEFATURA</div>
            <div style={{ background:G.bg, border:`1px solid ${G.border}`, borderRadius:8, padding:"12px 14px", marginBottom:16 }}>
              <div style={{ fontSize:12, marginBottom:4 }}>Solicitante: <strong>{jefatura.solicitante}</strong></div>
              <div style={{ fontSize:12, marginBottom:4 }}>Fecha: {jefatura.fecha}</div>
              <div style={{ fontSize:12, marginBottom:4 }}>Descripción: {jefatura.descripcion}</div>
              <div style={{ fontSize:12 }}>Horas extra: <strong>{jefatura.horasExtra} hrs</strong></div>
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
              <Field label="Nombre completo de quien autoriza / resuelve *">
                <input style={css.input} value={nombreJef} onChange={e=>setNombreJef(e.target.value)} placeholder="Ingresa tu nombre..." />
              </Field>
              <Field label="Observación (requerida si se rechaza)">
                <textarea style={{ ...css.input, minHeight:60 }} value={obsJef} onChange={e=>setObsJef(e.target.value)} placeholder="Motivo del rechazo o comentario..." />
              </Field>
            </div>
            <div style={{ fontSize:11, color:G.textDim, marginTop:10 }}>
              ⏱ Se registrará automáticamente la fecha y hora de la resolución.
            </div>
            <div style={{ display:"flex", gap:8, marginTop:16, justifyContent:"flex-end" }}>
              <button style={css.btn("ghost")} onClick={()=>{setJefatura(null);setNombreJef("");setObsJef("");}}>Cerrar</button>
              <button style={css.btn("danger")} onClick={()=>rechazar(jefatura.id)}>Rechazar</button>
              <button style={css.btn("success")} onClick={()=>aprobar(jefatura.id)}>✓ Aprobar</button>
            </div>
          </div>
        </div>
      )}

      <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
        {soe.map(s => (
          <div key={s.id} style={{ background:G.surface, border:`1px solid ${G.border}`, borderRadius:8, padding:16, display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
            <div style={{ flex:1 }}>
              <div style={{ display:"flex", gap:8, alignItems:"center", marginBottom:6, flexWrap:"wrap" }}>
                <span style={css.badge(SOE_COLOR[s.estado]||G.textMuted)}>{s.estado}</span>
                <span style={{ fontSize:11, color:G.textMuted }}>{s.fecha} · {s.solicitante} · {s.horasExtra} hrs extra</span>
              </div>
              <div style={{ fontSize:12 }}>{s.descripcion}</div>
              {s.aprobadaPor && (
                <div style={{ fontSize:11, color:s.estado==="aprobada"?G.accentGreen:G.accentRed, marginTop:6, display:"flex", alignItems:"center", gap:6, flexWrap:"wrap" }}>
                  {s.estado==="aprobada"?"✓ Aprobada":"✗ Rechazada"} por: <strong>{s.aprobadaPor}</strong>
                  {s.timestampAprobacion && (
                    <span style={{ color:G.textDim, fontSize:10 }}>· {fmtTs(s.timestampAprobacion)}</span>
                  )}
                </div>
              )}
              {s.observacion && <div style={{ fontSize:11, color:G.textMuted, marginTop:4, fontStyle:"italic" }}>"{s.observacion}"</div>}
            </div>
            {s.estado==="pendiente"&&<button style={{ ...css.btn("primary"), marginLeft:16, whiteSpace:"nowrap" }} onClick={()=>abrirResolver(s)}>Resolver ▸</button>}
            <button title="Eliminar solicitud" onClick={()=>eliminar(s.id)} style={{ background:"none", border:"none", color:G.textDim, cursor:"pointer", fontSize:18, marginLeft:8, padding:0, flexShrink:0 }}>×</button>
          </div>
        ))}
        {soe.length===0&&<div style={{ color:G.textDim, fontSize:11, padding:20 }}>No hay solicitudes registradas.</div>}
      </div>

      {/* Tabla registro */}
      <div style={{ marginTop:32 }}>
        <div style={css.sectionTitle}><span style={{ color:G.accentGreen }}>⊞</span> Registro SOE</div>
        <div style={{ overflowX:"auto" }}>
          <table style={{ width:"100%", borderCollapse:"collapse", fontSize:11 }}>
            <thead><tr style={{ borderBottom:`1px solid ${G.border}` }}>{["Fecha","Solicitante","Descripción","Horas","Estado","Resuelto por","Timestamp resolución",""].map(h=><th key={h} style={{ padding:"8px 12px",textAlign:"left",color:G.textMuted,fontSize:10,textTransform:"uppercase",letterSpacing:"0.06em" }}>{h}</th>)}</tr></thead>
            <tbody>{soe.map(s=>(
              <tr key={s.id} style={{ borderBottom:`1px solid ${G.borderLight}` }}>
                <td style={{ padding:"8px 12px" }}>{s.fecha}</td>
                <td style={{ padding:"8px 12px" }}>{s.solicitante}</td>
                <td style={{ padding:"8px 12px",color:G.textMuted,maxWidth:200,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{s.descripcion}</td>
                <td style={{ padding:"8px 12px" }}>{s.horasExtra} hrs</td>
                <td style={{ padding:"8px 12px" }}><span style={css.badge(SOE_COLOR[s.estado]||G.textMuted)}>{s.estado}</span></td>
                <td style={{ padding:"8px 12px",color:G.textMuted }}>{s.aprobadaPor||"—"}</td>
                <td style={{ padding:"8px 12px",color:G.textDim,fontSize:10 }}>{fmtTs(s.timestampAprobacion)}</td>
                <td style={{ padding:"8px 12px" }}><button title="Eliminar" onClick={()=>eliminar(s.id)} style={{ background:"none", border:"none", color:G.textDim, cursor:"pointer", fontSize:16, padding:0 }}>×</button></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── CONTINGENCIAS ────────────────────────────────────────────────────────────
function ContingenciasModule({ contingencias, fb, addToast }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ fecha:hoy(), reportadoPor:RESPONSABLES[0], descripcion:"", impacto:"medio", accionTomada:"", tiempoAfectado:0, estado:"activa" });
  const IMP_COLOR  = { bajo:G.accentGreen, medio:G.accentYellow, alto:G.accentRed };
  const CONT_COLOR = { activa:G.accentRed, en_proceso:G.accentOrange, resuelta:G.accentGreen };

  async function guardar() {
    if (!form.descripcion) { addToast("Ingresa una descripción.", false); return; }
    const { id:_, ...fdata } = form;
    await fb.agregar(fdata);
    addToast("Contingencia registrada.");
    setForm({ fecha:hoy(), reportadoPor:RESPONSABLES[0], descripcion:"", impacto:"medio", accionTomada:"", tiempoAfectado:0, estado:"activa" });
    setShowForm(false);
  }

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
        <div style={css.sectionTitle}><span style={{ color:G.accentRed }}>◉</span> Contingencias</div>
        <button style={css.btn("primary")} onClick={()=>setShowForm(true)}>+ Registrar</button>
      </div>
      <div style={{ background:G.surface, border:`1px solid ${G.accentRed}33`, borderRadius:6, padding:12, marginBottom:20, fontSize:11, color:G.accentRed }}>
        🔴 Actividades fuera de planificación que afectan el rendimiento. Registro obligatorio.
      </div>
      {showForm && (
        <div style={css.modal} onClick={e=>e.target===e.currentTarget&&setShowForm(false)}>
          <div style={css.modalBox}>
            <div style={{ fontSize:13, fontWeight:700, marginBottom:20, color:G.accentRed }}>REGISTRAR CONTINGENCIA</div>
            <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
              <div style={css.formGrid}>
                <Field label="Fecha"><input type="date" style={css.input} value={form.fecha} onChange={e=>setForm(p=>({...p,fecha:e.target.value}))} /></Field>
                <Field label="Reportado por"><select style={css.select} value={form.reportadoPor} onChange={e=>setForm(p=>({...p,reportadoPor:e.target.value}))}>{RESPONSABLES.map(r=><option key={r}>{r}</option>)}</select></Field>
              </div>
              <Field label="Descripción *"><textarea style={{ ...css.input, minHeight:80, resize:"vertical" }} value={form.descripcion} onChange={e=>setForm(p=>({...p,descripcion:e.target.value}))} placeholder="¿Qué ocurrió?..." /></Field>
              <div style={css.formGrid}>
                <Field label="Impacto"><select style={css.select} value={form.impacto} onChange={e=>setForm(p=>({...p,impacto:e.target.value}))}>{["bajo","medio","alto"].map(i=><option key={i}>{i}</option>)}</select></Field>
                <Field label="Tiempo afectado (min)"><input type="number" min={0} style={css.input} value={form.tiempoAfectado} onChange={e=>setForm(p=>({...p,tiempoAfectado:+e.target.value}))} /></Field>
              </div>
              <Field label="Acción tomada"><textarea style={{ ...css.input, minHeight:60, resize:"vertical" }} value={form.accionTomada} onChange={e=>setForm(p=>({...p,accionTomada:e.target.value}))} placeholder="Medidas adoptadas..." /></Field>
              <Field label="Estado"><select style={css.select} value={form.estado} onChange={e=>setForm(p=>({...p,estado:e.target.value}))}>{["activa","en_proceso","resuelta"].map(e=><option key={e} value={e}>{e.replace("_"," ")}</option>)}</select></Field>
              <div style={{ display:"flex", gap:8, justifyContent:"flex-end" }}>
                <button style={css.btn("ghost")} onClick={()=>setShowForm(false)}>Cancelar</button>
                <button style={{ ...css.btn("primary"), background:G.accentRed, borderColor:G.accentRed }} onClick={guardar}>Registrar</button>
              </div>
            </div>
          </div>
        </div>
      )}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(340px,1fr))", gap:16 }}>
        {contingencias.map(c => (
          <div key={c.id} style={{ background:G.surface, border:`2px solid ${IMP_COLOR[c.impacto]}44`, borderRadius:8, padding:16 }}>
            <div style={{ display:"flex", justifyContent:"space-between", marginBottom:10 }}>
              <span style={css.badge(CONT_COLOR[c.estado]||G.textMuted)}>{c.estado.replace("_"," ")}</span>
              <span style={css.badge(IMP_COLOR[c.impacto])}>impacto {c.impacto}</span>
            </div>
            <div style={{ fontSize:12, marginBottom:8, lineHeight:1.5 }}>{c.descripcion}</div>
            <div style={{ fontSize:11, color:G.textMuted, marginBottom:4 }}>📅 {c.fecha} · 👤 {c.reportadoPor}</div>
            {c.tiempoAfectado>0&&<div style={{ fontSize:11, color:G.accentYellow }}>⏱ {c.tiempoAfectado} min afectados</div>}
            {c.accionTomada&&<div style={{ fontSize:11, color:G.accentGreen, marginTop:6 }}>✓ {c.accionTomada}</div>}
            {c.estado!=="resuelta"&&<button onClick={()=>fb.actualizar(c.id,{estado:"resuelta"})} style={{ marginTop:10, ...css.btn("success"), padding:"4px 10px", fontSize:10 }}>Marcar resuelta</button>}
          </div>
        ))}
        {contingencias.length===0&&<div style={{ color:G.textDim, fontSize:11, padding:20 }}>No hay contingencias registradas.</div>}
      </div>
      <div style={{ marginTop:32 }}>
        <div style={css.sectionTitle}><span style={{ color:G.accentGreen }}>⊞</span> Registro Contingencias</div>
        <div style={{ overflowX:"auto" }}>
          <table style={{ width:"100%", borderCollapse:"collapse", fontSize:11 }}>
            <thead><tr style={{ borderBottom:`1px solid ${G.border}` }}>{["Fecha","Reportado por","Descripción","Impacto","Tiempo","Estado","Acción"].map(h=><th key={h} style={{ padding:"8px 12px",textAlign:"left",color:G.textMuted,fontSize:10,textTransform:"uppercase",letterSpacing:"0.06em" }}>{h}</th>)}</tr></thead>
            <tbody>{contingencias.map(c=><tr key={c.id} style={{ borderBottom:`1px solid ${G.borderLight}` }}><td style={{ padding:"8px 12px" }}>{c.fecha}</td><td style={{ padding:"8px 12px" }}>{c.reportadoPor}</td><td style={{ padding:"8px 12px",color:G.textMuted }}>{c.descripcion}</td><td style={{ padding:"8px 12px" }}><span style={css.badge(IMP_COLOR[c.impacto])}>{c.impacto}</span></td><td style={{ padding:"8px 12px" }}>{c.tiempoAfectado} min</td><td style={{ padding:"8px 12px" }}><span style={css.badge(CONT_COLOR[c.estado]||G.textMuted)}>{c.estado.replace("_"," ")}</span></td><td style={{ padding:"8px 12px",color:G.textMuted }}>{c.accionTomada||"—"}</td></tr>)}</tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── DASHBOARD ────────────────────────────────────────────────────────────────
function Dashboard({ tareas, visitas, soe, contingencias }) {
  const total       = tareas.length;
  const completadas = tareas.filter(t=>t.estado==="completado").length;
  const enProgreso  = tareas.filter(t=>t.estado==="en_progreso").length;
  const revision    = tareas.filter(t=>t.estado==="revision").length;
  const pendientes  = tareas.filter(t=>t.estado==="pendiente").length;
  const porVencer   = tareas.filter(t=>t.estado!=="completado"&&diasHasta(t.fechaTermino)<=3&&diasHasta(t.fechaTermino)>=0).length;
  const vencidas    = tareas.filter(t=>t.estado!=="completado"&&diasHasta(t.fechaTermino)<0).length;
  const altaP       = tareas.filter(t=>t.prioridad==="alta"&&t.estado!=="completado").length;
  const soePend     = soe.filter(s=>s.estado==="pendiente").length;
  const contAct     = contingencias.filter(c=>c.estado==="activa").length;
  const urgentes    = tareas.filter(t=>t.estado!=="completado"&&diasHasta(t.fechaTermino)<=3).sort((a,b)=>diasHasta(a.fechaTermino)-diasHasta(b.fechaTermino));
  const estadoData  = [{ label:"Completadas",c:G.accentGreen,v:completadas },{ label:"En Progreso",c:G.accent,v:enProgreso },{ label:"En Revisión",c:G.accentOrange,v:revision },{ label:"Pendientes",c:G.textDim,v:pendientes }];
  const P  = { background:"#fff", border:`1px solid ${G.border}`, borderRadius:12, padding:20, boxShadow:"0 1px 4px rgba(0,0,0,0.05)" };
  const PT = { fontSize:11, fontWeight:600, color:G.textMuted, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:16 };

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
      {/* Chips de alerta */}
      <div style={{ display:"flex", gap:12, flexWrap:"wrap" }}>
        {vencidas>0&&<AlertChip val={vencidas} label="Vencida(s)" color={G.accentRed} bg={G.accentRedLight} />}
        {porVencer>0&&<AlertChip val={porVencer} label="Vence en ≤3 días" color={G.accentOrange} bg={G.accentOrangeLight} />}
        {altaP>0&&<AlertChip val={altaP} label="Prioridad Alta" color={G.accentRed} bg={G.accentRedLight} />}
        {soePend>0&&<AlertChip val={soePend} label="SOE pendiente(s)" color={G.accentYellow} bg="#FDF3E3" />}
        {contAct>0&&<AlertChip val={contAct} label="Contingencia(s)" color={G.accentRed} bg={G.accentRedLight} />}
      </div>

      {/* Donut | Avance | Urgentes */}
      <div style={{ display:"grid", gridTemplateColumns:"auto 1fr 1fr", gap:16 }}>
        <div style={{ ...P, minWidth:290 }}>
          <div style={PT}>Total vs Pendientes</div>
          <DonutChart pendientes={pendientes} completadas={completadas} enProgreso={enProgreso} revision={revision} />
        </div>
        <div style={P}>
          <div style={PT}>Avance por Estado</div>
          {estadoData.map(e => {
            const pct=total>0?Math.round(e.v/total*100):0;
            return (
              <div key={e.label} style={{ marginBottom:18 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:7 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                    <div style={{ width:10, height:10, borderRadius:"50%", background:e.c }} />
                    <span style={{ fontSize:13, fontWeight:500 }}>{e.label}</span>
                  </div>
                  <div style={{ display:"flex", alignItems:"baseline", gap:6 }}>
                    <span style={{ fontSize:20, fontWeight:700, color:e.c }}>{e.v}</span>
                    <span style={{ fontSize:11, color:G.textDim }}>{pct}%</span>
                  </div>
                </div>
                <div style={{ background:G.borderLight, borderRadius:99, height:10, overflow:"hidden" }}>
                  <div style={{ background:e.c, width:`${pct}%`, height:"100%", borderRadius:99, transition:"width .7s ease", minWidth:e.v>0?6:0 }} />
                </div>
              </div>
            );
          })}
        </div>
        <div style={P}>
          <div style={PT}>Tareas Urgentes</div>
          {urgentes.length===0 ? <div style={{ color:G.textDim, fontSize:13, textAlign:"center", padding:"28px 0" }}>Sin tareas urgentes</div> : (
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              {urgentes.slice(0,6).map(t => {
                const d=diasHasta(t.fechaTermino), c=d<0?G.accentRed:G.accentOrange;
                return (
                  <div key={t.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"10px 12px", background:c+"0D", border:`1px solid ${c}33`, borderRadius:8 }}>
                    <div style={{ flex:1, minWidth:0, marginRight:8 }}>
                      <div style={{ fontSize:12, fontWeight:600, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{t.titulo}</div>
                      <div style={{ fontSize:11, color:G.textMuted, marginTop:2 }}>{t.responsable}</div>
                    </div>
                    <span style={{ ...css.badge(c), fontSize:11, flexShrink:0 }}>{d<0?`−${Math.abs(d)}d`:d===0?"hoy":`${d}d`}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div style={P}>
        <div style={PT}>Resumen Semanal de Actividad</div>
        <ResumenSemanal tareas={tareas} visitas={visitas} />
      </div>

      <div style={P}>
        <div style={PT}>Próximos 7 Días</div>
        <MiniCalendario tareas={tareas} visitas={visitas} />
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
        <div style={P}>
          <div style={PT}>Semáforo de Carga del Equipo</div>
          <SemaforoCarga tareas={tareas} />
        </div>
        <div style={P}>
          <div style={PT}>¿Qué está atrasado y de quién es?</div>
          <TablaAtrasados tareas={tareas} />
        </div>
      </div>

      <div style={P}>
        <div style={PT}>Próximas Visitas</div>
        {visitas.length===0 ? <div style={{ color:G.textDim, fontSize:13, textAlign:"center", padding:"20px 0" }}>No hay visitas registradas.</div> : (
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {[...visitas].sort((a,b)=>a.fecha.localeCompare(b.fecha)).slice(0,5).map(v => {
              const d=diasHasta(v.fecha), esHoy=d===0;
              return (
                <div key={v.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"10px 14px", background:esHoy?G.accentLight:G.bg, borderRadius:8, border:`1px solid ${esHoy?G.accent:G.border}` }}>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontWeight:600, fontSize:13, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{v.lugar}</div>
                    <div style={{ fontSize:11, color:G.textMuted, marginTop:2 }}>{v.responsable}{v.asistentes&&` · ${v.asistentes.split(",").length} asistente${v.asistentes.split(",").length!==1?"s":""}`}</div>
                  </div>
                  <div style={{ textAlign:"right", flexShrink:0, marginLeft:12 }}>
                    <div style={{ fontSize:12, fontWeight:600, color:G.accent }}>{v.fecha}</div>
                    {d>=0&&<div style={{ fontSize:10, color:esHoy?G.accent:G.textDim, fontWeight:esHoy?600:400 }}>{esHoy?"Hoy":`en ${d}d`}</div>}
                  </div>
                </div>
              );
            })}
            {visitas.length>5&&<div style={{ fontSize:11, color:G.textMuted, textAlign:"center" }}>+{visitas.length-5} más — ver módulo Visitas</div>}
          </div>
        )}
      </div>

      {/* Exportar CSV */}
      <div style={{ background:"#fff", border:`1px solid ${G.border}`, borderRadius:12, padding:"14px 20px" }}>
        <div style={{ display:"flex", alignItems:"center", gap:12, flexWrap:"wrap" }}>
          <span style={{ fontSize:12, color:G.textMuted, fontWeight:600 }}>Exportar datos:</span>
          {[
            { label:"Tareas",        data:tareas,        fields:["titulo","responsable","fechaInicio","fechaTermino","estado","prioridad","horasEstimadas","descripcion"] },
            { label:"Visitas",       data:visitas,       fields:["fecha","lugar","responsable","asistentes","objetivo","resultado","compromisos","evidencia","estado"] },
            { label:"SOE",           data:soe,           fields:["fecha","solicitante","descripcion","horasExtra","estado","aprobadaPor","timestampAprobacion","observacion"] },
            { label:"Contingencias", data:contingencias, fields:["fecha","reportadoPor","descripcion","impacto","tiempoAfectado","estado","accionTomada"] },
          ].map(({ label, data, fields }) => (
            <button key={label} style={{ ...css.btn("ghost"), padding:"6px 14px", fontSize:12 }} onClick={() => {
              const csv = fields.join(",") + "\n" + data.map(row => fields.map(f=>`"${(row[f]??"").toString().replace(/"/g,'""')}"`).join(",")).join("\n");
              const a=document.createElement("a"); a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8;"})); a.download=`${label.toLowerCase()}.csv`; a.click();
            }}>↓ {label}</button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── APP ──────────────────────────────────────────────────────────────────────
const MODULOS = [
  { id:"dashboard",     label:"Resumen"          },
  { id:"kanban",        label:"Tareas"            },
  { id:"reuniones",     label:"Reuniones"         },
  { id:"visitas",       label:"Visitas"           },
  { id:"soe",           label:"Trab. Extraord."   },
  { id:"contingencias", label:"Contingencias"     },
  { id:"informe",       label:"Informe"           },
  { id:"historial",     label:"Historial Carga"   },
];

export default function App() {
  const [modulo, setModulo] = useState("dashboard");
  const [tareas,        cargandoTareas, errTareas]    = useColeccion("tareas");
  const [reuniones,     cargandoReun,  errReuniones]  = useColeccion("reuniones");
  const [visitas,       cargandoVis,   errVisitas]    = useColeccion("visitas");
  const [soe,           cargandoSoe,   errSoe]        = useColeccion("soe");
  const [contingencias, cargandoCont,  errCont]       = useColeccion("contingencias");

  const [toast, setToast] = useState(null);
  const addToast = useCallback((msg, ok=true) => setToast({ msg, ok }), []);
  const cargando = cargandoTareas||cargandoReun||cargandoVis||cargandoSoe||cargandoCont;

  // Operaciones Firebase con error handling para cada módulo
  const fbTareas    = useMemo(() => mkFb("tareas",        addToast), [addToast]);
  const fbReuniones = useMemo(() => mkFb("reuniones",     addToast), [addToast]);
  const fbVisitas   = useMemo(() => mkFb("visitas",       addToast), [addToast]);
  const fbSoe       = useMemo(() => mkFb("soe",           addToast), [addToast]);
  const fbCont      = useMemo(() => mkFb("contingencias", addToast), [addToast]);

  // Alerta diaria (una vez por sesión)
  const [mostrarAlerta, setMostrarAlerta] = useState(false);
  useEffect(() => {
    if (cargando) return;
    const k = "alertaDiaria_" + hoy();
    if (!sessionStorage.getItem(k)) { setMostrarAlerta(true); sessionStorage.setItem(k, "1"); }
  }, [cargando]);

  // Notificaciones de vencimiento próximo
  useEffect(() => {
    const alertadas = JSON.parse(sessionStorage.getItem("alertasVenc")||"[]");
    tareas.forEach(async t => {
      if (t.estado==="completado") return;
      const d=diasHasta(t.fechaTermino);
      if (d>=0&&d<=3&&!alertadas.includes(t.id)) {
        const ok=await notificarVencimiento(t,d);
        if (ok) { alertadas.push(t.id); sessionStorage.setItem("alertasVenc",JSON.stringify(alertadas)); }
      }
    });
  }, [tareas]);

  const soePendientes  = soe.filter(s=>s.estado==="pendiente").length;
  const contActivas    = contingencias.filter(c=>c.estado==="activa").length;
  const tareasUrgentes = tareas.filter(t=>t.estado!=="completado"&&diasHasta(t.fechaTermino)<=3).length;
  const errores        = [errTareas, errReuniones, errVisitas, errSoe, errCont];

  if (cargando) return (
    <div style={{ ...css.app, display:"flex", alignItems:"center", justifyContent:"center", flexDirection:"column", gap:16 }}>
      <div style={{ fontSize:36, color:G.accent }}>⬡</div>
      <div style={{ fontSize:14, color:G.textMuted, fontWeight:500 }}>Cargando datos...</div>
    </div>
  );

  return (
    <div style={css.app}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap'); *{box-sizing:border-box} body{margin:0} ::-webkit-scrollbar{width:6px;height:6px} ::-webkit-scrollbar-track{background:#F7F8FC} ::-webkit-scrollbar-thumb{background:#DDE2EF;border-radius:3px} input[type=date]::-webkit-calendar-picker-indicator{cursor:pointer;opacity:0.6} @keyframes semaforoPulse{0%,100%{opacity:1;transform:scale(1);box-shadow:0 0 8px var(--pulse-color,#C81E1E99)}50%{opacity:.75;transform:scale(1.2);box-shadow:0 0 16px var(--pulse-color,#C81E1E)}}`}</style>

      {mostrarAlerta && <AlertaDiaria tareas={tareas} onCerrar={()=>setMostrarAlerta(false)} />}

      <header style={css.header}>
        <div>
          <div style={css.logoText}>⬡ Gestión Operativa</div>
          <div style={{ fontSize:11, color:G.textMuted, marginTop:2 }}>Departamento Apoyo Diagnóstico y Terapéutico</div>
        </div>
        <nav style={css.nav}>
          {MODULOS.map(m => (
            <button key={m.id} style={css.navBtn(modulo===m.id)} onClick={()=>setModulo(m.id)}>
              {m.label}
              {m.id==="kanban"        && tareasUrgentes>0 && <span style={{ marginLeft:5, background:G.accentOrange, color:"#000", borderRadius:99, padding:"0 5px", fontSize:9 }}>{tareasUrgentes}</span>}
              {m.id==="reuniones"     && reuniones.filter(r=>r.estado!=="realizada"&&r.estado!=="cancelada").length>0 && <span style={{ marginLeft:5, background:G.accentPurple, color:"#fff", borderRadius:99, padding:"0 5px", fontSize:9 }}>{reuniones.filter(r=>r.estado!=="realizada"&&r.estado!=="cancelada").length}</span>}
              {m.id==="soe"           && soePendientes>0  && <span style={{ marginLeft:5, background:G.accentYellow, color:"#000", borderRadius:99, padding:"0 5px", fontSize:9 }}>{soePendientes}</span>}
              {m.id==="contingencias" && contActivas>0    && <span style={{ marginLeft:5, background:G.accentRed, color:"#fff", borderRadius:99, padding:"0 5px", fontSize:9 }}>{contActivas}</span>}
            </button>
          ))}
        </nav>
        <div style={{ fontSize:10, color:G.textDim }}>{new Date().toLocaleDateString("es-CL",{weekday:"short",day:"numeric",month:"short",year:"numeric"})}</div>
      </header>

      {/* Banner de error Firebase — visible en todos los módulos */}
      <FbErrorBanner errores={errores} />

      <main style={css.main}>
        {modulo==="dashboard"     && <Dashboard tareas={tareas} visitas={visitas} soe={soe} contingencias={contingencias} />}
        {modulo==="kanban"        && <KanbanModule tareas={tareas} fb={fbTareas} addToast={addToast} />}
        {modulo==="reuniones"     && <ReunionesModule reuniones={reuniones} fb={fbReuniones} addToast={addToast} />}
        {modulo==="visitas"       && <VisitasModule visitas={visitas} fb={fbVisitas} addToast={addToast} />}
        {modulo==="soe"           && <SOEModule soe={soe} fb={fbSoe} addToast={addToast} />}
        {modulo==="contingencias" && <ContingenciasModule contingencias={contingencias} fb={fbCont} addToast={addToast} />}
        {modulo==="informe"       && <InformeModule tareas={tareas} visitas={visitas} soe={soe} contingencias={contingencias} />}
        {modulo==="historial"     && <HistorialCargaModule tareas={tareas} />}
      </main>

      {toast && <Toast msg={toast.msg} ok={toast.ok} onClose={()=>setToast(null)} />}
    </div>
  );
}

