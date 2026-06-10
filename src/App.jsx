import { useState, useMemo, useEffect, useCallback } from "react";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║  ⚠  CREDENCIALES EXPUESTAS — Leer antes de desplegar en producción          ║
// ║                                                                              ║
// ║  Firebase y EmailJS están hardcodeados en el bundle del cliente.            ║
// ║  Cualquiera que inspeccione el código puede extraerlos.                      ║
// ║                                                                              ║
// ║  Para protegerlos:                                                           ║
// ║  1. Migrar a Vite o CRA con soporte .env                                     ║
// ║  2. Mover cada clave a VITE_FIREBASE_* / REACT_APP_FIREBASE_* ║
// ║  3. Agregar .env al .gitignore antes del primer commit                       ║
// ║  4. Restringir la API Key de Firebase en console.firebase.google.com          ║
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
function useColeccion(nombre) {
  const [datos,    setDatos]    = useState([]);
  const [cargando, setCargando] = useState(true);
  const [errorFb,  setErrorFb]  = useState(null);
  useEffect(() => {
    if (!nombre) {
      setDatos([]);
      setCargando(false);
      return;
    }
    setCargando(true);
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
          {arcs.map((a,i) => <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={a.c} strokeWidth={sw} strokeDasharray={`${a.dash} ${a.gap}`} strokeDashoffset={circ/4-a.off} strokeLinecap="round" style={{ transition:"stroke-dash