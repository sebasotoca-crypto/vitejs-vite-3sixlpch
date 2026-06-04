import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

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

function useColeccion(nombre) {
  const [datos, setDatos] = useState([]);
  const [cargando, setCargando] = useState(true);
  useEffect(() => {
    const unsub = onSnapshot(collection(db, nombre), snap => {
      setDatos(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setCargando(false);
    });
    return unsub;
  }, [nombre]);
  return [datos, cargando];
}
async function fbAgregar(col, item) { const { id, ...data } = item; return addDoc(collection(db, col), data); }
async function fbActualizar(col, id, cambios) { return updateDoc(doc(db, col, id), cambios); }
async function fbEliminar(col, id) { return deleteDoc(doc(db, col, id)); }

const EMAILJS_CONFIG = {
  SERVICE_ID: "gestion_operativa",
  TEMPLATE_ASIGNACION: "template_04yxyyn",
  TEMPLATE_VENCIMIENTO: "template_n68j7it",
  TEMPLATE_SOE: "TU_TEMPLATE_SOE_ID",
  PUBLIC_KEY: "Mt6cb7NrWs_-YsfPP",
};
const CORREOS = {
  "Macarena Godoy": "macarena.godoy@redsalud.gob.cl",
  "Carlos Faunes": "carlos.faunes@redsalud.gob.cl",
  "Constanza Jara": "constanza.jarau@redsalud.gob.cl",
  "Nadia Rufatt": "nadia.rufatt@redsalud.gob.cl",
  "Tomas Chavez": "tomas.chavez.g@redsalud.gob.cl",
  "Sebastian Soto": "sebastian.soto.c@redsalud.gob.cl",
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
  app: { fontFamily: "'Inter','Segoe UI',system-ui,sans-serif", background: G.bg, color: G.text, minHeight: "100vh", display: "flex", flexDirection: "column" },
  header: { background: "#FFFFFF", borderBottom: `1px solid ${G.border}`, padding: "14px 28px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 100, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" },
  logoText: { fontSize: 15, fontWeight: 700, color: G.accent, letterSpacing: "0.01em" },
  nav: { display: "flex", gap: 4, flexWrap: "wrap" },
  navBtn: (a) => ({ padding: "7px 16px", fontSize: 12, fontFamily: "inherit", fontWeight: a ? 600 : 400, background: a ? G.accent : "transparent", color: a ? "#fff" : G.textMuted, border: `1px solid ${a ? G.accent : G.border}`, borderRadius: 6, cursor: "pointer", transition: "all .15s" }),
  main: { flex: 1, padding: "28px", maxWidth: 1400, width: "100%", margin: "0 auto" },
  sectionTitle: { fontSize: 13, fontWeight: 600, color: G.text, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 },
  badge: (c) => ({ display: "inline-block", padding: "3px 10px", borderRadius: 99, fontSize: 11, fontWeight: 600, background: c + "18", color: c, border: `1px solid ${c}33` }),
  card: { background: "#fff", border: `1px solid ${G.border}`, borderRadius: 10, padding: 16, marginBottom: 10, cursor: "grab", transition: "box-shadow .15s", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" },
  input: { background: "#fff", border: `1px solid ${G.border}`, borderRadius: 6, color: G.text, padding: "9px 12px", fontSize: 13, fontFamily: "inherit", outline: "none", width: "100%", boxSizing: "border-box", transition: "border-color .15s" },
  select: { background: "#fff", border: `1px solid ${G.border}`, borderRadius: 6, color: G.text, padding: "9px 12px", fontSize: 13, fontFamily: "inherit", outline: "none", width: "100%", boxSizing: "border-box", cursor: "pointer" },
  btn: (v = "primary") => ({ padding: "9px 20px", fontSize: 13, fontFamily: "inherit", fontWeight: 600, border: "1px solid", borderRadius: 6, cursor: "pointer", transition: "all .15s", ...(v === "primary" ? { background: G.accent, color: "#fff", borderColor: G.accent } : v === "success" ? { background: G.accentGreen, color: "#fff", borderColor: G.accentGreen } : v === "danger" ? { background: "transparent", color: G.accentRed, borderColor: G.accentRed } : { background: "transparent", color: G.textMuted, borderColor: G.border }) }),
  label: { fontSize: 12, color: G.textMuted, fontWeight: 500, marginBottom: 5, display: "block" },
  formGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 },
  modal: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999 },
  modalBox: { background: "#fff", border: `1px solid ${G.border}`, borderRadius: 12, padding: 28, width: 580, maxWidth: "95vw", maxHeight: "90vh", overflowY: "auto", boxShadow: "0 8px 32px rgba(0,0,0,0.12)" },
};

const RESPONSABLES = [...new Set([...Object.keys(CORREOS), ...Object.keys(JEFATURAS)])];
const PRIORIDADES = ["baja", "media", "alta"];
const ESTADOS = ["pendiente", "en_progreso", "revision", "completado"];
const ESTADO_LABELS = { pendiente: "Pendiente", en_progreso: "En Progreso", revision: "Revisión", completado: "Completado" };
const ESTADO_ICONS = { pendiente: "○", en_progreso: "◑", revision: "◕", completado: "●" };
const PRIORIDAD_COLOR = { baja: G.accentGreen, media: G.accentOrange, alta: G.accentRed };
const ESTADO_COLOR = { pendiente: G.textMuted, en_progreso: G.accent, revision: G.accentOrange, completado: G.accentGreen };
const VEST_COLOR = { programada: G.accent, en_progreso: G.accentOrange, realizada: G.accentGreen, cancelada: G.accentRed };
const VEST_LABELS = { programada: "Programada", en_progreso: "En Progreso", realizada: "Realizada", cancelada: "Cancelada" };

function uid() { return Math.random().toString(36).slice(2, 9); }
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
  const ahora = new Date().toISOString().replace(/[-:.]/g, "").slice(0, 15);
  const dtStart = fmtICS(fechaInicio || fechaTermino);
  const dtEnd   = fmtICS(fechaTermino || fechaInicio, "170000");
  const desc = [descripcion, responsable ? `Responsable: ${responsable}` : ""].filter(Boolean).join("\\n");
  return ["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//Gestión Operativa ADAT//ES","CALSCALE:GREGORIAN","METHOD:PUBLISH","BEGIN:VEVENT",`UID:${uid_ev}`,`DTSTAMP:${ahora}`,`DTSTART:${dtStart}`,`DTEND:${dtEnd}`,`SUMMARY:${titulo}`,`DESCRIPTION:${desc}`,lugar ? `LOCATION:${lugar}` : "","BEGIN:VALARM","TRIGGER:-PT30M","ACTION:DISPLAY",`DESCRIPTION:Recordatorio: ${titulo}`,"END:VALARM","END:VEVENT","END:VCALENDAR"].filter(l => l !== "").join("\r\n");
}
function descargarICS(datos, nombreArchivo) {
  const ics = generarICS(datos);
  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = nombreArchivo.replace(/[^a-z0-9_\-]/gi, "_") + ".ics";
  document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
}

function Field({ label, children }) { return <div><span style={css.label}>{label}</span>{children}</div>; }
function Toast({ msg, ok, onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 4000); return () => clearTimeout(t); }, [onClose]);
  return <div style={{ position: "fixed", bottom: 24, right: 24, background: ok ? G.accentGreen : G.accentRed, color: "#fff", padding: "12px 20px", borderRadius: 8, fontSize: 13, fontFamily: "inherit", zIndex: 9999, fontWeight: 600, maxWidth: 320, boxShadow: "0 4px 16px rgba(0,0,0,0.15)" }}>{ok ? "✓" : "✗"} {msg}</div>;
}

// ─── ALERTA CHIP ──────────────────────────────────────────────────────────────
function AlertChip({ val, label, color, bg }) {
  return (
    <div style={{ flex: 1, minWidth: 160, background: bg, border: `1.5px solid ${color}44`, borderRadius: 10, padding: "13px 18px", display: "flex", alignItems: "center", gap: 12 }}>
      <div style={{ width: 38, height: 38, borderRadius: "50%", background: color, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <span style={{ color: "#fff", fontSize: 18, fontWeight: 700 }}>!</span>
      </div>
      <div>
        <div style={{ fontSize: 22, fontWeight: 700, color, lineHeight: 1 }}>{val}</div>
        <div style={{ fontSize: 11, color, marginTop: 3, fontWeight: 500 }}>{label}</div>
      </div>
    </div>
  );
}

// ─── DONUT SVG ────────────────────────────────────────────────────────────────
function DonutChart({ pendientes, completadas, enProgreso, revision }) {
  const total = pendientes + completadas + enProgreso + revision;
  const size = 180, cx = 90, cy = 90, r = 68, sw = 24, circ = 2 * Math.PI * r;
  const segs = [{ v: completadas, c: G.accentGreen },{ v: enProgreso, c: G.accent },{ v: revision, c: G.accentOrange },{ v: pendientes, c: G.textDim }].filter(s => s.v > 0);
  let off = 0;
  const arcs = segs.map(s => { const dash = (s.v / total) * circ; const a = { ...s, dash, gap: circ - dash, off }; off += dash; return a; });
  const pct = total > 0 ? Math.round(completadas / total * 100) : 0;
  const pColor = pct >= 75 ? G.accentGreen : pct >= 40 ? G.accent : G.accentOrange;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
      <div style={{ position: "relative", flexShrink: 0 }}>
        <svg width={size} height={size}>
          <circle cx={cx} cy={cy} r={r} fill="none" stroke={G.borderLight} strokeWidth={sw} />
          {arcs.map((a, i) => <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={a.c} strokeWidth={sw} strokeDasharray={`${a.dash} ${a.gap}`} strokeDashoffset={circ / 4 - a.off} strokeLinecap="round" style={{ transition: "stroke-dasharray .7s ease" }} />)}
        </svg>
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
          <div style={{ fontSize: 30, fontWeight: 700, color: pColor, lineHeight: 1 }}>{pct}%</div>
          <div style={{ fontSize: 10, color: G.textMuted, marginTop: 3 }}>completado</div>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
        {[{ label: "Completadas", v: completadas, c: G.accentGreen },{ label: "En Progreso", v: enProgreso, c: G.accent },{ label: "En Revisión", v: revision, c: G.accentOrange },{ label: "Pendientes", v: pendientes, c: G.textDim }].map(({ label, v, c }) => (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: c, flexShrink: 0 }} />
            <span style={{ fontSize: 12, color: G.textMuted, width: 90 }}>{label}</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: c }}>{v}</span>
          </div>
        ))}
        <div style={{ borderTop: `1px solid ${G.border}`, paddingTop: 8, display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 10, height: 10, borderRadius: "50%", background: G.border, flexShrink: 0 }} />
          <span style={{ fontSize: 12, color: G.textMuted, width: 90 }}>Total</span>
          <span style={{ fontSize: 14, fontWeight: 700, color: G.accent }}>{total}</span>
        </div>
      </div>
    </div>
  );
}

// ─── 1. SEMÁFORO DE CARGA ─────────────────────────────────────────────────────
function SemaforoCarga({ tareas }) {
  const datos = RESPONSABLES.map(r => {
    const activas  = tareas.filter(t => t.responsable === r && t.estado !== "completado").length;
    const total    = tareas.filter(t => t.responsable === r).length;
    const vencidas = tareas.filter(t => t.responsable === r && t.estado !== "completado" && diasHasta(t.fechaTermino) < 0).length;
    return { nombre: r, activas, total, vencidas };
  }).filter(r => r.total > 0);

  if (datos.length === 0) return <div style={{ color: G.textDim, fontSize: 12, textAlign: "center", padding: "20px 0" }}>Sin tareas asignadas</div>;

  const maxActivas = Math.max(...datos.map(d => d.activas), 1);
  const promedio   = datos.reduce((s, d) => s + d.activas, 0) / datos.length;

  function colorSemaforo(activas) {
    if (activas === 0) return G.accentGreen;
    const ratio = activas / Math.max(promedio, 1);
    if (ratio <= 1.0) return G.accentGreen;
    if (ratio <= 1.6) return G.accentOrange;
    return G.accentRed;
  }
  function labelSemaforo(activas) {
    if (activas === 0) return "Libre";
    const ratio = activas / Math.max(promedio, 1);
    if (ratio <= 1.0) return "Normal";
    if (ratio <= 1.6) return "Alta";
    return "Critica";
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {datos.sort((a, b) => b.activas - a.activas).map(d => {
        const c = colorSemaforo(d.activas);
        const esCritica = labelSemaforo(d.activas) === "Critica";
        return (
          <div key={d.nombre} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", background: c + "0D", border: `1px solid ${c}33`, borderRadius: 8 }}>
            <div style={{ position: "relative", flexShrink: 0, width: 20, height: 20 }}>
              <div style={{ width: 20, height: 20, borderRadius: "50%", background: c, boxShadow: `0 0 8px ${c}99`, animation: esCritica ? "semaforoPulse 1.4s ease-in-out infinite" : "none" }} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: G.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{d.nombre}</div>
              <div style={{ fontSize: 10, color: G.textMuted, marginTop: 2 }}>
                {d.activas} activa{d.activas !== 1 ? "s" : ""}
                {d.vencidas > 0 && <span style={{ color: G.accentRed, fontWeight: 700, marginLeft: 6 }}>· {d.vencidas} vencida{d.vencidas !== 1 ? "s" : ""}</span>}
                {" · "}{d.total} total
              </div>
            </div>
            <div style={{ textAlign: "right", flexShrink: 0 }}>
              <span style={{ ...css.badge(c), fontSize: 10 }}>{labelSemaforo(d.activas)}</span>
            </div>
            <div style={{ width: 80, background: G.borderLight, borderRadius: 99, height: 6, overflow: "hidden", flexShrink: 0 }}>
              <div style={{ background: c, width: `${(d.activas / maxActivas) * 100}%`, height: "100%", borderRadius: 99, transition: "width .6s" }} />
            </div>
          </div>
        );
      })}
      <div style={{ fontSize: 10, color: G.textDim, marginTop: 4 }}>
        Promedio equipo: <strong>{promedio.toFixed(1)}</strong> tareas activas
        {" · "}<span style={{ color: G.accentGreen }}>●</span> Normal
        {" · "}<span style={{ color: G.accentOrange }}>●</span> Alta (&gt;1×)
        {" · "}<span style={{ color: G.accentRed }}>●</span> Critica (&gt;1.6×)
      </div>
    </div>
  );
}

// ─── 2. TABLA ATRASADOS ───────────────────────────────────────────────────────
function TablaAtrasados({ tareas }) {
  const atrasadas = tareas
    .filter(t => t.estado !== "completado" && diasHasta(t.fechaTermino) < 0)
    .sort((a, b) => diasHasta(a.fechaTermino) - diasHasta(b.fechaTermino));

  if (atrasadas.length === 0) return (
    <div style={{ textAlign: "center", padding: "20px 0", color: G.accentGreen, fontSize: 13, fontWeight: 600 }}>✓ Sin tareas atrasadas</div>
  );

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
        <thead>
          <tr style={{ borderBottom: `2px solid ${G.border}` }}>
            {["Tarea", "Responsable", "Atraso", "Prioridad"].map(h => (
              <th key={h} style={{ padding: "6px 10px", textAlign: "left", color: G.textMuted, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {atrasadas.map(t => {
            const d = Math.abs(diasHasta(t.fechaTermino));
            const nivel = d >= 14 ? "critico" : d >= 7 ? "grave" : "atraso";
            const bgRow = d >= 14 ? G.accentRedLight : d >= 7 ? G.accentOrangeLight + "88" : "transparent";
            const colorAtraso = d >= 7 ? G.accentRed : G.accentOrange;
            return (
              <tr key={t.id} style={{ borderBottom: `1px solid ${G.borderLight}`, background: bgRow }}>
                <td style={{ padding: "8px 10px" }}>
                  <div style={{ fontWeight: 600, fontSize: 12, color: G.text }}>{t.titulo}</div>
                  <div style={{ fontSize: 9, color: G.textDim, marginTop: 2 }}>venció {t.fechaTermino}</div>
                </td>
                <td style={{ padding: "8px 10px", color: G.textMuted, fontSize: 11 }}>{t.responsable.split(" ")[0]}</td>
                <td style={{ padding: "8px 10px" }}>
                  <span style={{ ...css.badge(colorAtraso), fontWeight: 700, fontSize: 11 }}>−{d}d</span>
                  {d >= 14 && <div style={{ fontSize: 9, color: G.accentRed, marginTop: 3, fontWeight: 600 }}>CRITICO</div>}
                </td>
                <td style={{ padding: "8px 10px" }}>
                  <span style={css.badge(PRIORIDAD_COLOR[t.prioridad])}>{t.prioridad}</span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div style={{ fontSize: 10, color: G.textMuted, marginTop: 8, paddingTop: 8, borderTop: `1px solid ${G.borderLight}` }}>
        Total: <strong>{atrasadas.length}</strong> tarea{atrasadas.length !== 1 ? "s" : ""} atrasada{atrasadas.length !== 1 ? "s" : ""}
        {atrasadas.filter(t => Math.abs(diasHasta(t.fechaTermino)) >= 7).length > 0 && (
          <span style={{ color: G.accentRed, marginLeft: 8, fontWeight: 600 }}>
            · {atrasadas.filter(t => Math.abs(diasHasta(t.fechaTermino)) >= 7).length} con 7+ días de atraso
          </span>
        )}
      </div>
    </div>
  );
}

// ─── 3. RESUMEN SEMANAL ───────────────────────────────────────────────────────
function ResumenSemanal({ tareas, visitas }) {
  const iSemAct  = inicioSemana(0);
  const fSemAct  = finSemana(0);
  const iSemAnt  = inicioSemana(-1);
  const fSemAnt  = finSemana(-1);

  function enRango(fecha, desde, hasta) { return fecha >= desde && fecha <= hasta; }

  const compAct = tareas.filter(t => t.estado === "completado" && t.fechaTermino && enRango(t.fechaTermino, iSemAct, fSemAct)).length;
  const compAnt = tareas.filter(t => t.estado === "completado" && t.fechaTermino && enRango(t.fechaTermino, iSemAnt, fSemAnt)).length;
  const visAct  = visitas.filter(v => enRango(v.fecha, iSemAct, fSemAct)).length;
  const visAnt  = visitas.filter(v => enRango(v.fecha, iSemAnt, fSemAnt)).length;
  const nuevAct = tareas.filter(t => t.fechaInicio && enRango(t.fechaInicio, iSemAct, fSemAct)).length;
  const nuevAnt = tareas.filter(t => t.fechaInicio && enRango(t.fechaInicio, iSemAnt, fSemAnt)).length;

  function DeltaBar({ actual, anterior, color }) {
    const max = Math.max(actual, anterior, 1);
    const diff = actual - anterior;
    const diffColor = diff > 0 ? G.accentGreen : diff < 0 ? G.accentRed : G.textDim;
    return (
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
          <span style={{ fontSize: 10, color: G.textMuted, width: 60 }}>Esta sem.</span>
          <div style={{ flex: 1, background: G.borderLight, borderRadius: 99, height: 8, overflow: "hidden" }}>
            <div style={{ background: color, width: `${(actual / max) * 100}%`, height: "100%", borderRadius: 99, transition: "width .5s" }} />
          </div>
          <span style={{ fontSize: 12, fontWeight: 700, color, width: 20, textAlign: "right" }}>{actual}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 10, color: G.textDim, width: 60 }}>Sem. ant.</span>
          <div style={{ flex: 1, background: G.borderLight, borderRadius: 99, height: 8, overflow: "hidden" }}>
            <div style={{ background: color + "55", width: `${(anterior / max) * 100}%`, height: "100%", borderRadius: 99 }} />
          </div>
          <span style={{ fontSize: 12, color: G.textDim, width: 20, textAlign: "right" }}>{anterior}</span>
        </div>
        {diff !== 0 && (
          <div style={{ marginTop: 6, fontSize: 10, color: diffColor, fontWeight: 600 }}>
            {diff > 0 ? "▲" : "▼"} {Math.abs(diff)} vs semana anterior
          </div>
        )}
      </div>
    );
  }

  const items = [
    { label: "Tareas completadas", actual: compAct, anterior: compAnt, color: G.accentGreen, icon: "✓" },
    { label: "Tareas nuevas",      actual: nuevAct, anterior: nuevAnt, color: G.accent,      icon: "+" },
    { label: "Visitas realizadas", actual: visAct,  anterior: visAnt,  color: G.accentOrange, icon: "◈" },
  ];

  return (
    <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
      {items.map(item => (
        <div key={item.label} style={{ flex: 1, minWidth: 160, background: item.color + "08", border: `1px solid ${item.color}33`, borderRadius: 10, padding: "14px 16px" }}>
          <div style={{ fontSize: 11, color: G.textMuted, marginBottom: 10, fontWeight: 600 }}>{item.icon} {item.label}</div>
          <div style={{ fontSize: 32, fontWeight: 700, color: item.color, lineHeight: 1, marginBottom: 10 }}>{item.actual}</div>
          <DeltaBar actual={item.actual} anterior={item.anterior} color={item.color} />
        </div>
      ))}
    </div>
  );
}

// ─── 4. MINI-CALENDARIO 7 DÍAS ────────────────────────────────────────────────
function MiniCalendario({ tareas, visitas, soe = [], contingencias = [] }) {
  const dias = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate() + i);
    const fecha = d.toISOString().slice(0, 10);
    const tareasDelDia  = tareas.filter(t => t.fechaTermino === fecha && t.estado !== "completado").length;
    const visitasDelDia = visitas.filter(v => v.fecha === fecha).length;
    const total = tareasDelDia + visitasDelDia;
    const esHoy = i === 0;
    const nombreDia = d.toLocaleDateString("es-CL", { weekday: "short" });
    const numDia    = d.getDate();
    return { fecha, tareasDelDia, visitasDelDia, total, esHoy, nombreDia, numDia };
  });

  const maxTotal = Math.max(...dias.map(d => d.total), 1);

  return (
    <div>
      <div style={{ display: "flex", gap: 6 }}>
        {dias.map(d => {
          const carga = d.total / maxTotal;
          const bgColor = d.esHoy ? G.accent : carga > 0.7 ? G.accentRed : carga > 0.3 ? G.accentOrange : G.accentGreen;
          const hasEvents = d.total > 0;
          return (
            <div key={d.fecha} style={{ flex: 1, textAlign: "center", padding: "10px 4px", borderRadius: 8, background: d.esHoy ? G.accent + "0F" : G.bg, border: `1.5px solid ${d.esHoy ? G.accent : G.border}` }}>
              <div style={{ fontSize: 10, color: d.esHoy ? G.accent : G.textMuted, fontWeight: d.esHoy ? 700 : 400, textTransform: "capitalize" }}>{d.nombreDia}</div>
              <div style={{ fontSize: 17, fontWeight: 700, color: d.esHoy ? G.accent : G.text, marginTop: 2, lineHeight: 1 }}>{d.numDia}</div>
              <div style={{ marginTop: 8, height: 36, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", gap: 3 }}>
                {hasEvents ? (
                  <>
                    <div style={{ width: "80%", background: bgColor, borderRadius: 3, height: Math.max(4, carga * 28), transition: "height .4s" }} />
                    <div style={{ fontSize: 11, fontWeight: 700, color: bgColor }}>{d.total}</div>
                  </>
                ) : (
                  <div style={{ fontSize: 10, color: G.textDim }}>—</div>
                )}
              </div>
              <div style={{ marginTop: 4, minHeight: 28 }}>
                {d.tareasDelDia > 0 && <div style={{ fontSize: 9, color: G.textMuted }}>📋{d.tareasDelDia}</div>}
                {d.visitasDelDia > 0 && <div style={{ fontSize: 9, color: G.textMuted }}>📍{d.visitasDelDia}</div>}
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", gap: 12, marginTop: 8, fontSize: 10, color: G.textDim }}>
        <span>📋 tareas por vencer</span><span>📍 visitas programadas</span>
      </div>
    </div>
  );
}

// ─── 5. MÓDULO INFORME DE GESTIÓN ─────────────────────────────────────────────
function InformeModule({ tareas, visitas, soe, contingencias }) {
  const [periodo, setPeriodo] = useState("semana");
  const [generando, setGenerando] = useState(false);

  function calcularFechas() {
    if (periodo === "semana") return { desde: inicioSemana(0), hasta: finSemana(0) };
    const hoyStr = hoy();
    const d = new Date(hoyStr + "T00:00:00");
    const desde = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
    const hasta = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10);
    return { desde, hasta };
  }

  function enRango(fecha, desde, hasta) { return fecha >= desde && fecha <= hasta; }

  function generarTexto() {
    const { desde, hasta } = calcularFechas();
    const label = periodo === "semana" ? `Semana ${desde} al ${hasta}` : `Mes ${desde.slice(0, 7)}`;

    const tareasComp  = tareas.filter(t => t.estado === "completado" && t.fechaTermino && enRango(t.fechaTermino, desde, hasta));
    const tareasPend  = tareas.filter(t => t.estado !== "completado");
    const tareasVenc  = tareas.filter(t => t.estado !== "completado" && diasHasta(t.fechaTermino) < 0);
    const visitasReal = visitas.filter(v => enRango(v.fecha, desde, hasta));
    const soeAprobados = soe.filter(s => s.estado === "aprobada" && enRango(s.fecha, desde, hasta));
    const contResueltas = contingencias.filter(c => c.estado === "resuelta" && enRango(c.fecha, desde, hasta));
    const contActivas   = contingencias.filter(c => c.estado === "activa");

    const cargaPorPersona = RESPONSABLES.map(r => ({
      nombre: r,
      activas: tareas.filter(t => t.responsable === r && t.estado !== "completado").length,
      completadas: tareas.filter(t => t.responsable === r && t.estado === "completado").length,
    })).filter(r => r.activas + r.completadas > 0);

    return `INFORME DE GESTIÓN OPERATIVA
Departamento Apoyo Diagnóstico y Terapéutico
${label}
Generado: ${new Date().toLocaleDateString("es-CL", { weekday:"long", year:"numeric", month:"long", day:"numeric" })}

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
CARGA POR PERSONA
════════════════════════════════════════
${cargaPorPersona.map(p => `• ${p.nombre.padEnd(22)} Activas: ${p.activas}  |  Completadas: ${p.completadas}`).join("\n")}

════════════════════════════════════════
TAREAS COMPLETADAS EN EL PERÍODO
════════════════════════════════════════
${tareasComp.length === 0 ? "  (ninguna)" : tareasComp.map(t => `• [${t.prioridad.toUpperCase()}] ${t.titulo} — ${t.responsable} (${t.fechaTermino})`).join("\n")}

════════════════════════════════════════
TAREAS VENCIDAS SIN COMPLETAR
════════════════════════════════════════
${tareasVenc.length === 0 ? "  (ninguna)" : tareasVenc.sort((a,b) => diasHasta(a.fechaTermino) - diasHasta(b.fechaTermino)).map(t => `• [${t.prioridad.toUpperCase()}] ${t.titulo} — ${t.responsable} — ATRASO: ${Math.abs(diasHasta(t.fechaTermino))} días`).join("\n")}

════════════════════════════════════════
VISITAS REALIZADAS
════════════════════════════════════════
${visitasReal.length === 0 ? "  (ninguna)" : visitasReal.map(v => `• ${v.fecha} | ${v.lugar} — ${v.responsable}\n  Objetivo: ${v.objetivo}${v.resultado ? "\n  Resultado: " + v.resultado : ""}`).join("\n\n")}

════════════════════════════════════════
SOLICITUDES DE TRABAJO EXTRAORDINARIO
════════════════════════════════════════
${soeAprobados.length === 0 ? "  (ninguna aprobada en el período)" : soeAprobados.map(s => `• ${s.fecha} | ${s.solicitante} — ${s.horasExtra} hrs | Aprobado por: ${s.aprobadaPor}`).join("\n")}

════════════════════════════════════════
CONTINGENCIAS
════════════════════════════════════════
Resueltas en el período: ${contResueltas.length}
${contResueltas.map(c => `• [${c.impacto.toUpperCase()}] ${c.descripcion} — Acción: ${c.accionTomada || "no registrada"}`).join("\n") || "  (ninguna)"}

Activas al cierre del informe: ${contActivas.length}
${contActivas.map(c => `• [${c.impacto.toUpperCase()}] ${c.descripcion} — Reportado por: ${c.reportadoPor}`).join("\n") || "  (ninguna)"}

════════════════════════════════════════
Fin del informe
════════════════════════════════════════`;
  }

  function exportarTexto() {
    const txt = generarTexto();
    const blob = new Blob([txt], { type: "text/plain;charset=utf-8;" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = `informe_gestion_${periodo}_${hoy()}.txt`; a.click();
  }

  function exportarHTML() {
    const txt = generarTexto();
    const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Informe Gestión</title>
    <style>body{font-family:monospace;max-width:900px;margin:40px auto;padding:0 20px;color:#111;line-height:1.6}pre{white-space:pre-wrap;word-wrap:break-word}h1{color:#1A56DB}</style>
    </head><body><pre>${txt.replace(/</g,"&lt;").replace(/>/g,"&gt;")}</pre></body></html>`;
    const blob = new Blob([html], { type: "text/html;charset=utf-8;" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = `informe_gestion_${periodo}_${hoy()}.html`; a.click();
  }

  const [preview, setPreview] = useState(false);
  const textoPreview = useMemo(() => generarTexto(), [tareas, visitas, soe, contingencias, periodo]);

  const P = { background: "#fff", border: `1px solid ${G.border}`, borderRadius: 12, padding: 20, boxShadow: "0 1px 4px rgba(0,0,0,0.05)" };
  const PT = { fontSize: 11, fontWeight: 600, color: G.textMuted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 16 };
  const { desde, hasta } = calcularFechas();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={css.sectionTitle}><span style={{ color: G.accentPurple }}>📄</span> Informe de Gestión</div>
      </div>

      {/* Selector de período y acciones */}
      <div style={{ ...P, display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <div>
          <div style={css.label}>Período del informe</div>
          <div style={{ display: "flex", gap: 8 }}>
            {["semana", "mes"].map(p => (
              <button key={p} style={{ ...css.btn(periodo === p ? "primary" : "ghost"), padding: "7px 18px", fontSize: 12 }} onClick={() => setPeriodo(p)}>
                {p === "semana" ? "Esta semana" : "Este mes"}
              </button>
            ))}
          </div>
        </div>
        <div style={{ color: G.textMuted, fontSize: 12 }}>
          {desde} → {hasta}
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <button style={{ ...css.btn("ghost"), fontSize: 12, padding: "7px 16px" }} onClick={() => setPreview(p => !p)}>
            {preview ? "Ocultar vista previa" : "Vista previa"}
          </button>
          <button style={{ ...css.btn("ghost"), fontSize: 12, padding: "7px 16px" }} onClick={exportarTexto}>↓ .txt</button>
          <button style={{ ...css.btn("primary"), fontSize: 12, padding: "7px 16px" }} onClick={exportarHTML}>↓ .html (para imprimir)</button>
        </div>
      </div>

      {/* Métricas del período */}
      {(() => {
        const tareasComp   = tareas.filter(t => t.estado === "completado" && t.fechaTermino && t.fechaTermino >= desde && t.fechaTermino <= hasta).length;
        const tareasPend   = tareas.filter(t => t.estado !== "completado").length;
        const tareasVenc   = tareas.filter(t => t.estado !== "completado" && diasHasta(t.fechaTermino) < 0).length;
        const visitasReal  = visitas.filter(v => v.fecha >= desde && v.fecha <= hasta).length;
        const soeAprobados = soe.filter(s => s.estado === "aprobada" && s.fecha >= desde && s.fecha <= hasta).length;
        const contRes      = contingencias.filter(c => c.estado === "resuelta" && c.fecha >= desde && c.fecha <= hasta).length;
        const stats = [
          { label: "Tareas completadas", val: tareasComp, color: G.accentGreen },
          { label: "Tareas pendientes",  val: tareasPend, color: G.accent      },
          { label: "Vencidas",           val: tareasVenc, color: G.accentRed   },
          { label: "Visitas realizadas", val: visitasReal, color: G.accentOrange },
          { label: "SOE aprobados",      val: soeAprobados, color: G.accentPurple },
          { label: "Contingencias resueltas", val: contRes, color: G.accentGreen },
        ];
        return (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(160px,1fr))", gap: 12 }}>
            {stats.map(s => (
              <div key={s.label} style={{ ...P, padding: "14px 16px", borderTop: `3px solid ${s.color}` }}>
                <div style={{ fontSize: 11, color: G.textMuted, marginBottom: 6 }}>{s.label}</div>
                <div style={{ fontSize: 26, fontWeight: 700, color: s.color }}>{s.val}</div>
              </div>
            ))}
          </div>
        );
      })()}

      {/* Carga por persona en el período */}
      <div style={P}>
        <div style={PT}>Carga del equipo en el período</div>
        <SemaforoCarga tareas={tareas} />
      </div>

      {/* Vista previa del texto */}
      {preview && (
        <div style={P}>
          <div style={PT}>Vista previa del informe</div>
          <pre style={{ fontSize: 11, color: G.text, background: G.bg, padding: 16, borderRadius: 8, overflowX: "auto", whiteSpace: "pre-wrap", wordWrap: "break-word", lineHeight: 1.7, fontFamily: "monospace", maxHeight: 500, overflowY: "auto" }}>
            {textoPreview}
          </pre>
        </div>
      )}
    </div>
  );
}

// ─── 6. HISTORIAL DE CARGA ────────────────────────────────────────────────────
function HistorialCargaModule({ tareas }) {
  // Genera los últimos 6 meses
  const meses = Array.from({ length: 6 }, (_, i) => {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - (5 - i));
    const desde = d.toISOString().slice(0, 7) + "-01";
    const hasta = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10);
    return { label: d.toLocaleDateString("es-CL", { month: "short", year: "2-digit" }), desde, hasta };
  });

  const datos = RESPONSABLES.map(r => ({
    nombre: r.split(" ")[0],
    nombreCompleto: r,
    serie: meses.map(m => tareas.filter(t => t.responsable === r && t.fechaInicio >= m.desde && t.fechaInicio <= m.hasta).length),
  })).filter(r => r.serie.some(v => v > 0));

  const maxVal = Math.max(...datos.flatMap(d => d.serie), 1);
  const colores = [G.accent, G.accentGreen, G.accentOrange, G.accentRed, G.accentPurple, "#0891B2"];
  const H = 120;

  const P = { background: "#fff", border: `1px solid ${G.border}`, borderRadius: 12, padding: 20, boxShadow: "0 1px 4px rgba(0,0,0,0.05)" };

  if (datos.length === 0) return (
    <div style={{ ...P }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: G.textMuted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 16 }}>Historial de Carga por Persona</div>
      <div style={{ color: G.textDim, fontSize: 12, textAlign: "center", padding: "20px 0" }}>Sin datos históricos aún</div>
    </div>
  );

  return (
    <div style={P}>
      <div style={{ fontSize: 11, fontWeight: 600, color: G.textMuted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 20 }}>Historial de Carga por Persona (últimos 6 meses)</div>

      {/* Gráfico de barras agrupadas */}
      <div style={{ display: "flex", gap: 12, alignItems: "flex-end", marginBottom: 8 }}>
        {meses.map((mes, mi) => (
          <div key={mes.label} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: H }}>
              {datos.map((d, di) => {
                const val = d.serie[mi];
                const barH = val > 0 ? Math.max(4, (val / maxVal) * H) : 0;
                return (
                  <div key={d.nombre} title={`${d.nombreCompleto}: ${val} tareas`}
                    style={{ width: 14, height: barH, background: colores[di % colores.length], borderRadius: "3px 3px 0 0", transition: "height .5s", cursor: "default" }} />
                );
              })}
            </div>
            <div style={{ fontSize: 10, color: G.textMuted, textAlign: "center" }}>{mes.label}</div>
          </div>
        ))}
      </div>

      {/* Leyenda */}
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 12, paddingTop: 12, borderTop: `1px solid ${G.borderLight}` }}>
        {datos.map((d, di) => (
          <div key={d.nombre} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: colores[di % colores.length], flexShrink: 0 }} />
            <span style={{ fontSize: 11, color: G.textMuted }}>{d.nombre}</span>
          </div>
        ))}
      </div>

      {/* Tabla detalle */}
      <div style={{ marginTop: 20, overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${G.border}` }}>
              <th style={{ padding: "6px 10px", textAlign: "left", color: G.textMuted, fontSize: 10, textTransform: "uppercase" }}>Persona</th>
              {meses.map(m => <th key={m.label} style={{ padding: "6px 10px", textAlign: "center", color: G.textMuted, fontSize: 10, textTransform: "uppercase" }}>{m.label}</th>)}
              <th style={{ padding: "6px 10px", textAlign: "center", color: G.textMuted, fontSize: 10, textTransform: "uppercase" }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {datos.map((d, di) => {
              const total = d.serie.reduce((a, b) => a + b, 0);
              return (
                <tr key={d.nombre} style={{ borderBottom: `1px solid ${G.borderLight}` }}>
                  <td style={{ padding: "7px 10px", display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 8, height: 8, borderRadius: 2, background: colores[di % colores.length] }} />
                    {d.nombreCompleto}
                  </td>
                  {d.serie.map((v, mi) => (
                    <td key={mi} style={{ padding: "7px 10px", textAlign: "center", fontWeight: v === Math.max(...d.serie) ? 700 : 400, color: v === Math.max(...d.serie) ? G.accentRed : G.text }}>{v || "—"}</td>
                  ))}
                  <td style={{ padding: "7px 10px", textAlign: "center", fontWeight: 700, color: G.accent }}>{total}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── 9. MODAL ALERTA DIARIA ───────────────────────────────────────────────────
function AlertaDiaria({ tareas, onCerrar }) {
  const vencidas  = tareas.filter(t => t.estado !== "completado" && diasHasta(t.fechaTermino) < 0);
  const hoyTareas = tareas.filter(t => t.estado !== "completado" && diasHasta(t.fechaTermino) === 0);
  const manana    = tareas.filter(t => t.estado !== "completado" && diasHasta(t.fechaTermino) === 1);
  const total     = vencidas.length + hoyTareas.length;

  if (total === 0 && manana.length === 0) return null;

  const hora = new Date().getHours();
  const saludo = hora < 12 ? "Buenos días" : hora < 19 ? "Buenas tardes" : "Buenas noches";

  return (
    <div style={{ ...css.modal, zIndex: 1200 }}>
      <div style={{ ...css.modalBox, width: 560, maxWidth: "95vw", padding: 0, overflow: "hidden" }}>
        {/* Header de color según urgencia */}
        <div style={{ background: vencidas.length > 0 ? G.accentRed : G.accentOrange, padding: "20px 28px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.75)", fontWeight: 500, marginBottom: 3 }}>{saludo} — {new Date().toLocaleDateString("es-CL", { weekday: "long", day: "numeric", month: "long" })}</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#fff" }}>
              {vencidas.length > 0 ? `⚠ ${vencidas.length + hoyTareas.length} tarea${vencidas.length + hoyTareas.length !== 1 ? "s" : ""} requieren atención` : `🟡 ${hoyTareas.length} tarea${hoyTareas.length !== 1 ? "s" : ""} vence${hoyTareas.length === 1 ? "" : n => ""} hoy`}
            </div>
          </div>
          <button onClick={onCerrar} style={{ background: "rgba(255,255,255,0.2)", border: "none", color: "#fff", width: 32, height: 32, borderRadius: "50%", fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>×</button>
        </div>

        <div style={{ padding: "20px 28px", display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Resumen de chips */}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {vencidas.length > 0 && (
              <div style={{ flex: 1, minWidth: 120, background: G.accentRedLight, border: `1px solid ${G.accentRed}33`, borderRadius: 8, padding: "10px 14px", textAlign: "center" }}>
                <div style={{ fontSize: 28, fontWeight: 700, color: G.accentRed, lineHeight: 1 }}>{vencidas.length}</div>
                <div style={{ fontSize: 11, color: G.accentRed, marginTop: 3, fontWeight: 600 }}>Vencida{vencidas.length !== 1 ? "s" : ""}</div>
              </div>
            )}
            {hoyTareas.length > 0 && (
              <div style={{ flex: 1, minWidth: 120, background: G.accentOrangeLight, border: `1px solid ${G.accentOrange}33`, borderRadius: 8, padding: "10px 14px", textAlign: "center" }}>
                <div style={{ fontSize: 28, fontWeight: 700, color: G.accentOrange, lineHeight: 1 }}>{hoyTareas.length}</div>
                <div style={{ fontSize: 11, color: G.accentOrange, marginTop: 3, fontWeight: 600 }}>Vence hoy</div>
              </div>
            )}
            {manana.length > 0 && (
              <div style={{ flex: 1, minWidth: 120, background: G.accentLight, border: `1px solid ${G.accent}33`, borderRadius: 8, padding: "10px 14px", textAlign: "center" }}>
                <div style={{ fontSize: 28, fontWeight: 700, color: G.accent, lineHeight: 1 }}>{manana.length}</div>
                <div style={{ fontSize: 11, color: G.accent, marginTop: 3, fontWeight: 600 }}>Mañana</div>
              </div>
            )}
          </div>

          {/* Detalle vencidas */}
          {vencidas.length > 0 && (
            <div style={{ background: G.accentRedLight, border: `1px solid ${G.accentRed}33`, borderRadius: 8, padding: "12px 14px" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: G.accentRed, marginBottom: 8 }}>🔴 Tareas vencidas — requieren acción inmediata</div>
              {vencidas.slice(0, 5).map(t => (
                <div key={t.id} style={{ fontSize: 11, color: G.text, marginBottom: 5, paddingLeft: 8, display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <span>• <strong>{t.titulo}</strong> — {t.responsable}</span>
                  <span style={{ color: G.accentRed, fontWeight: 700, whiteSpace: "nowrap" }}>{Math.abs(diasHasta(t.fechaTermino))}d atraso</span>
                </div>
              ))}
              {vencidas.length > 5 && <div style={{ fontSize: 11, color: G.textMuted, paddingLeft: 8 }}>+{vencidas.length - 5} más...</div>}
            </div>
          )}

          {/* Detalle vence hoy */}
          {hoyTareas.length > 0 && (
            <div style={{ background: G.accentOrangeLight, border: `1px solid ${G.accentOrange}33`, borderRadius: 8, padding: "12px 14px" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: G.accentOrange, marginBottom: 8 }}>🟡 Vencen hoy</div>
              {hoyTareas.slice(0, 4).map(t => (
                <div key={t.id} style={{ fontSize: 11, color: G.text, marginBottom: 5, paddingLeft: 8 }}>
                  • <strong>{t.titulo}</strong> — {t.responsable}
                </div>
              ))}
              {hoyTareas.length > 4 && <div style={{ fontSize: 11, color: G.textMuted, paddingLeft: 8 }}>+{hoyTareas.length - 4} más...</div>}
            </div>
          )}

          {/* Detalle mañana */}
          {manana.length > 0 && (
            <div style={{ background: G.accentLight, border: `1px solid ${G.accent}33`, borderRadius: 8, padding: "12px 14px" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: G.accent, marginBottom: 8 }}>🔵 Vencen mañana</div>
              {manana.slice(0, 3).map(t => (
                <div key={t.id} style={{ fontSize: 11, color: G.text, marginBottom: 5, paddingLeft: 8 }}>
                  • <strong>{t.titulo}</strong> — {t.responsable}
                </div>
              ))}
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "flex-end", paddingTop: 4 }}>
            <button style={css.btn("primary")} onClick={onCerrar}>Entendido, ir al sistema →</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── KANBAN ───────────────────────────────────────────────────────────────────
function KanbanModule({ tareas, fb, addToast }) {
  const [showForm, setShowForm] = useState(false);
  const [dragId, setDragId] = useState(null);
  const [dragOver, setDragOver] = useState(null);
  const [hoveredCard, setHoveredCard] = useState(null);
  const [sending, setSending] = useState(false);
  // ─── 7. Filtro por responsable ─────────────────────────────────────────────
  const [filtroResp, setFiltroResp] = useState("todos");

  const empty = { titulo: "", responsable: RESPONSABLES[0], fechaInicio: hoy(), fechaTermino: "", estado: "pendiente", prioridad: "media", descripcion: "" };
  const [form, setForm] = useState(empty);

  const tareasFiltradas = filtroResp === "todos" ? tareas : tareas.filter(t => t.responsable === filtroResp);
  const byEstado = ESTADOS.reduce((acc, e) => ({ ...acc, [e]: tareasFiltradas.filter(t => t.estado === e) }), {});

  async function agregarTarea() {
    if (!form.titulo || !form.fechaTermino) return;
    setSending(true);
    const nueva = { ...form }; delete nueva.id;
    await fb.agregar(nueva);
    descargarICS({ titulo: nueva.titulo, descripcion: nueva.descripcion, fechaInicio: nueva.fechaInicio, fechaTermino: nueva.fechaTermino, responsable: nueva.responsable }, nueva.titulo);
    const ok = await notificarAsignacion(nueva);
    addToast(ok ? `Correo enviado a ${nueva.responsable}` : "Tarea creada. Configura EmailJS para enviar correos.", ok);
    setSending(false); setForm(empty); setShowForm(false);
  }

  function cambiarEstado(id, e) { fb.actualizar(id, { estado: e }); }
  function onDrop(e) { if (!dragId) return; cambiarEstado(dragId, e); setDragId(null); setDragOver(null); }
  function eliminar(id) { fb.eliminar(id); }

  function DiasTag({ fechaTermino, estado }) {
    if (estado === "completado") return null;
    const d = diasHasta(fechaTermino); if (d > 7) return null;
    const c = d < 0 ? G.accentRed : d <= 3 ? G.accentOrange : G.accentYellow;
    return <span style={css.badge(c)}>{d < 0 ? `−${Math.abs(d)}d` : d === 0 ? "hoy" : `${d}d`}</span>;
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div style={css.sectionTitle}><span style={{ color: G.accent }}>▦</span> Tareas / Reuniones</div>
        <button style={css.btn("primary")} onClick={() => setShowForm(true)}>+ Nueva Tarea</button>
      </div>

      {/* Filtro por responsable */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
        <button onClick={() => setFiltroResp("todos")} style={{ ...css.navBtn(filtroResp === "todos"), fontSize: 11 }}>Todos ({tareas.length})</button>
        {RESPONSABLES.map(r => {
          const cnt = tareas.filter(t => t.responsable === r && t.estado !== "completado").length;
          if (tareas.filter(t => t.responsable === r).length === 0) return null;
          return (
            <button key={r} onClick={() => setFiltroResp(r)} style={{ ...css.navBtn(filtroResp === r), fontSize: 11 }}>
              {r.split(" ")[0]} {cnt > 0 && <span style={{ background: filtroResp === r ? "#ffffff44" : G.accentOrange, color: filtroResp === r ? "#fff" : "#000", borderRadius: 99, padding: "0 5px", fontSize: 9, marginLeft: 4 }}>{cnt}</span>}
            </button>
          );
        })}
      </div>

      <div style={{ background: G.surface, border: `1px solid ${G.accent}33`, borderRadius: 6, padding: "10px 14px", marginBottom: 20, fontSize: 11, color: G.accent }}>
        📅 Al guardar una tarea se descargará automáticamente un archivo <strong>.ics</strong> — ábrelo y Outlook lo agrega al calendario del responsable con un clic.
      </div>

      {showForm && (
        <div style={css.modal} onClick={e => e.target === e.currentTarget && setShowForm(false)}>
          <div style={css.modalBox}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 20, color: G.accent }}>NUEVA TAREA</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <Field label="Título *"><input style={css.input} value={form.titulo} onChange={e => setForm(p => ({ ...p, titulo: e.target.value }))} placeholder="Descripción breve..." /></Field>
              <div style={css.formGrid}>
                <Field label="Responsable"><select style={css.select} value={form.responsable} onChange={e => setForm(p => ({ ...p, responsable: e.target.value }))}>{RESPONSABLES.map(r => <option key={r}>{r}</option>)}</select></Field>
                <Field label="Prioridad"><select style={css.select} value={form.prioridad} onChange={e => setForm(p => ({ ...p, prioridad: e.target.value }))}>{PRIORIDADES.map(p => <option key={p}>{p}</option>)}</select></Field>
                <Field label="Fecha Inicio"><input type="date" style={css.input} value={form.fechaInicio} onChange={e => setForm(p => ({ ...p, fechaInicio: e.target.value }))} /></Field>
                <Field label="Fecha Término *"><input type="date" style={css.input} value={form.fechaTermino} onChange={e => setForm(p => ({ ...p, fechaTermino: e.target.value }))} /></Field>
              </div>
              <Field label="Estado inicial"><select style={css.select} value={form.estado} onChange={e => setForm(p => ({ ...p, estado: e.target.value }))}>{ESTADOS.map(e => <option key={e} value={e}>{ESTADO_LABELS[e]}</option>)}</select></Field>
              <Field label="Descripción"><textarea style={{ ...css.input, minHeight: 60, resize: "vertical" }} value={form.descripcion} onChange={e => setForm(p => ({ ...p, descripcion: e.target.value }))} placeholder="Detalles adicionales..." /></Field>
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 8 }}>
                <button style={css.btn("ghost")} onClick={() => setShowForm(false)}>Cancelar</button>
                <button style={css.btn("primary")} onClick={agregarTarea} disabled={sending}>{sending ? "Guardando..." : "Guardar Tarea"}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
        {ESTADOS.map(estado => (
          <div key={estado}
            style={{ background: dragOver === estado ? G.accentLight : "#F7F8FC", border: `2px solid ${dragOver === estado ? G.accent : G.border}`, borderRadius: 10, padding: 12, minHeight: 400, transition: "all .15s" }}
            onDragOver={e => { e.preventDefault(); setDragOver(estado); }}
            onDragLeave={() => setDragOver(null)}
            onDrop={() => onDrop(estado)}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={{ fontSize: 12, color: ESTADO_COLOR[estado], fontWeight: 600 }}>{ESTADO_ICONS[estado]} {ESTADO_LABELS[estado]}</div>
              <span style={{ fontSize: 11, color: G.textDim, background: G.border + "55", padding: "1px 7px", borderRadius: 99 }}>{byEstado[estado].length}</span>
            </div>
            {byEstado[estado].map(tarea => {
              const urgente = tarea.estado !== "completado" && diasHasta(tarea.fechaTermino) <= 3;
              return (
                <div key={tarea.id} draggable
                  onDragStart={() => setDragId(tarea.id)}
                  onDragEnd={() => { setDragId(null); setDragOver(null); }}
                  onMouseEnter={() => setHoveredCard(tarea.id)}
                  onMouseLeave={() => setHoveredCard(null)}
                  style={{ ...css.card, borderColor: urgente ? G.accentOrange : (hoveredCard === tarea.id ? PRIORIDAD_COLOR[tarea.prioridad] : G.border), opacity: dragId === tarea.id ? 0.4 : 1, boxShadow: urgente ? `0 0 0 1px ${G.accentOrange}44` : "none" }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, lineHeight: 1.4, flex: 1 }}>{tarea.titulo}</div>
                    <button onClick={() => eliminar(tarea.id)} style={{ background: "none", border: "none", color: G.textDim, cursor: "pointer", fontSize: 14, padding: 0, marginLeft: 6 }}>×</button>
                  </div>
                  {tarea.descripcion && <div style={{ fontSize: 10, color: G.textMuted, marginBottom: 6, lineHeight: 1.5 }}>{tarea.descripcion}</div>}
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 8 }}>
                    <span style={css.badge(PRIORIDAD_COLOR[tarea.prioridad])}>{tarea.prioridad}</span>
                    <DiasTag fechaTermino={tarea.fechaTermino} estado={tarea.estado} />
                  </div>
                  <div style={{ fontSize: 10, color: G.textMuted, marginBottom: 8 }}>
                    <div>👤 {tarea.responsable}</div>
                    <div style={{ marginTop: 2 }}>📅 {tarea.fechaTermino}</div>
                  </div>
                  <div style={{ marginBottom: 8 }}>
                    <button onClick={() => descargarICS({ titulo: tarea.titulo, descripcion: tarea.descripcion, fechaInicio: tarea.fechaInicio, fechaTermino: tarea.fechaTermino, responsable: tarea.responsable }, tarea.titulo)}
                      style={{ fontSize: 9, color: G.accent, background: "transparent", border: `1px solid ${G.accent}44`, borderRadius: 3, padding: "2px 7px", cursor: "pointer", fontFamily: "inherit", letterSpacing: "0.04em" }}>
                      📅 Descargar .ics (Outlook)
                    </button>
                  </div>
                  <div style={{ borderTop: `1px solid ${G.borderLight}`, paddingTop: 8 }}>
                    <div style={{ fontSize: 9, color: G.textDim, marginBottom: 4, letterSpacing: "0.06em", textTransform: "uppercase" }}>Mover a:</div>
                    <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
                      {ESTADOS.filter(e => e !== tarea.estado).map(e => (
                        <button key={e} onClick={() => cambiarEstado(tarea.id, e)}
                          style={{ padding: "3px 7px", fontSize: 9, fontFamily: "inherit", fontWeight: 700, background: "transparent", color: ESTADO_COLOR[e], border: `1px solid ${ESTADO_COLOR[e]}55`, borderRadius: 3, cursor: "pointer", transition: "all .1s" }}>
                          {ESTADO_ICONS[e]} {ESTADO_LABELS[e]}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <div style={{ marginTop: 32 }}>
        <div style={css.sectionTitle}><span style={{ color: G.accentGreen }}>⊞</span> Registro Completo</div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${G.border}` }}>
                {["Título","Responsable","Inicio","Término","Días","Estado","Prioridad"].map(h => (
                  <th key={h} style={{ padding: "8px 12px", textAlign: "left", color: G.textMuted, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tareasFiltradas.map(t => {
                const d = diasHasta(t.fechaTermino);
                const dc = t.estado === "completado" ? G.textDim : d < 0 ? G.accentRed : d <= 3 ? G.accentOrange : G.textMuted;
                return (
                  <tr key={t.id} style={{ borderBottom: `1px solid ${G.borderLight}` }}>
                    <td style={{ padding: "8px 12px" }}>{t.titulo}</td>
                    <td style={{ padding: "8px 12px", color: G.textMuted }}>{t.responsable}</td>
                    <td style={{ padding: "8px 12px", color: G.textMuted }}>{t.fechaInicio}</td>
                    <td style={{ padding: "8px 12px", color: G.textMuted }}>{t.fechaTermino}</td>
                    <td style={{ padding: "8px 12px", color: dc, fontWeight: d <= 3 && t.estado !== "completado" ? 700 : 400 }}>{t.estado === "completado" ? "—" : d < 0 ? `−${Math.abs(d)}d` : `${d}d`}</td>
                    <td style={{ padding: "8px 12px" }}>
                      <select style={{ ...css.select, padding: "3px 6px", width: "auto", fontSize: 10 }} value={t.estado} onChange={e => cambiarEstado(t.id, e.target.value)}>
                        {ESTADOS.map(e => <option key={e} value={e}>{ESTADO_LABELS[e]}</option>)}
                      </select>
                    </td>
                    <td style={{ padding: "8px 12px" }}><span style={css.badge(PRIORIDAD_COLOR[t.prioridad])}>{t.prioridad}</span></td>
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

// ─── VISITAS ──────────────────────────────────────────────────────────────────
function VisitasModule({ visitas, fb }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ fecha: hoy(), lugar: "", responsable: RESPONSABLES[0], objetivo: "", resultado: "", estado: "programada" });
  const [filtroEstadoVis, setFiltroEstadoVis] = useState("todos");

  async function guardar() {
    if (!form.lugar || !form.objetivo) return;
    const nueva = { ...form }; delete nueva.id;
    await fb.agregar(nueva);
    descargarICS({ titulo: `Visita: ${nueva.lugar}`, descripcion: nueva.objetivo, fechaInicio: nueva.fecha, fechaTermino: nueva.fecha, responsable: nueva.responsable, lugar: nueva.lugar }, `Visita_${nueva.lugar}`);
    setForm({ fecha: hoy(), lugar: "", responsable: RESPONSABLES[0], objetivo: "", resultado: "", estado: "programada" });
    setShowForm(false);
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div style={css.sectionTitle}><span style={{ color: G.accentOrange }}>◈</span> Visitas / Trabajo en Terreno</div>
        <button style={css.btn("primary")} onClick={() => setShowForm(true)}>+ Nueva Visita</button>
      </div>
      <div style={{ background: G.surface, border: `1px solid ${G.accentOrange}33`, borderRadius: 6, padding: "10px 14px", marginBottom: 20, fontSize: 11, color: G.accentOrange }}>
        📅 Al registrar una visita se descargará automáticamente un archivo <strong>.ics</strong> — ábrelo y Outlook lo agrega al calendario del responsable con un clic.
      </div>
      {showForm && (
        <div style={css.modal} onClick={e => e.target === e.currentTarget && setShowForm(false)}>
          <div style={css.modalBox}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 20, color: G.accentOrange }}>REGISTRAR VISITA</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={css.formGrid}>
                <Field label="Fecha"><input type="date" style={css.input} value={form.fecha} onChange={e => setForm(p => ({ ...p, fecha: e.target.value }))} /></Field>
                <Field label="Responsable"><select style={css.select} value={form.responsable} onChange={e => setForm(p => ({ ...p, responsable: e.target.value }))}>{RESPONSABLES.map(r => <option key={r}>{r}</option>)}</select></Field>
              </div>
              <Field label="Lugar *"><input style={css.input} value={form.lugar} onChange={e => setForm(p => ({ ...p, lugar: e.target.value }))} placeholder="Dirección o nombre del lugar..." /></Field>
              <Field label="Objetivo *"><textarea style={{ ...css.input, minHeight: 60, resize: "vertical" }} value={form.objetivo} onChange={e => setForm(p => ({ ...p, objetivo: e.target.value }))} placeholder="Objetivo de la visita..." /></Field>
              <Field label="Resultado"><textarea style={{ ...css.input, minHeight: 60, resize: "vertical" }} value={form.resultado} onChange={e => setForm(p => ({ ...p, resultado: e.target.value }))} placeholder="Resultado obtenido..." /></Field>
              <Field label="Estado">
                <select style={css.select} value={form.estado} onChange={e => setForm(p => ({ ...p, estado: e.target.value }))}>
                  {Object.keys(VEST_COLOR).map(e => <option key={e} value={e}>{VEST_LABELS[e]}</option>)}
                </select>
              </Field>
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button style={css.btn("ghost")} onClick={() => setShowForm(false)}>Cancelar</button>
                <button style={css.btn("success")} onClick={guardar}>Registrar</button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Filtro por estado */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
        <button onClick={() => setFiltroEstadoVis("todos")} style={{ ...css.navBtn(filtroEstadoVis === "todos"), fontSize: 11 }}>Todas ({visitas.length})</button>
        {Object.entries(VEST_COLOR).map(([estado, color]) => {
          const cnt = visitas.filter(v => (v.estado || "programada") === estado).length;
          if (cnt === 0) return null;
          return (
            <button key={estado} onClick={() => setFiltroEstadoVis(estado)} style={{ ...css.navBtn(filtroEstadoVis === estado), fontSize: 11, ...(filtroEstadoVis === estado ? { background: color, borderColor: color } : {}) }}>
              {VEST_LABELS[estado]} <span style={{ marginLeft: 4, background: filtroEstadoVis === estado ? "#ffffff44" : color + "22", color: filtroEstadoVis === estado ? "#fff" : color, borderRadius: 99, padding: "0 5px", fontSize: 9 }}>{cnt}</span>
            </button>
          );
        })}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(320px,1fr))", gap: 16 }}>
        {(filtroEstadoVis === "todos" ? visitas : visitas.filter(v => (v.estado || "programada") === filtroEstadoVis)).map(v => {
          const estadoActual = v.estado || "pendiente";
          const colorEstado = VEST_COLOR[estadoActual] || G.textMuted;
          return (
            <div key={v.id} style={{ background: G.surface, border: `2px solid ${colorEstado}33`, borderRadius: 6, padding: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: G.text }}>{v.lugar}</span>
                <span style={css.badge(colorEstado)}>{VEST_LABELS[estadoActual] || estadoActual}</span>
              </div>
              <div style={{ fontSize: 11, color: G.textMuted, marginBottom: 6 }}>📅 {v.fecha} · 👤 {v.responsable}</div>
              <div style={{ fontSize: 11, marginBottom: v.resultado ? 8 : 0 }}><span style={{ color: G.textMuted }}>Objetivo: </span>{v.objetivo}</div>
              {v.resultado && <div style={{ fontSize: 11, color: G.accentGreen, marginBottom: 8 }}><span style={{ color: G.textMuted }}>Resultado: </span>{v.resultado}</div>}
              <div style={{ borderTop: `1px solid ${G.borderLight}`, paddingTop: 10, marginTop: 10 }}>
                <div style={{ fontSize: 9, color: G.textDim, marginBottom: 6, letterSpacing: "0.06em", textTransform: "uppercase" }}>Cambiar estado:</div>
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                  {Object.keys(VEST_COLOR).filter(e => e !== estadoActual).map(e => (
                    <button key={e} onClick={() => fb.actualizar(v.id, { estado: e })}
                      style={{ padding: "3px 8px", fontSize: 9, fontFamily: "inherit", fontWeight: 700, background: "transparent", color: VEST_COLOR[e], border: `1px solid ${VEST_COLOR[e]}55`, borderRadius: 3, cursor: "pointer", transition: "all .1s" }}>
                      {VEST_LABELS[e]}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ marginTop: 10, display: "flex", gap: 8, alignItems: "center" }}>
                <button onClick={() => descargarICS({ titulo: `Visita: ${v.lugar}`, descripcion: v.objetivo, fechaInicio: v.fecha, fechaTermino: v.fecha, responsable: v.responsable, lugar: v.lugar }, `Visita_${v.lugar}`)}
                  style={{ fontSize: 9, color: G.accentOrange, background: "transparent", border: `1px solid ${G.accentOrange}44`, borderRadius: 3, padding: "2px 7px", cursor: "pointer", fontFamily: "inherit", letterSpacing: "0.04em" }}>
                  📅 Descargar .ics (Outlook)
                </button>
                <button onClick={() => fb.eliminar(v.id)} style={{ ...css.btn("danger"), padding: "4px 10px", fontSize: 10 }}>Eliminar</button>
              </div>
            </div>
          );
        })}
        {visitas.length === 0 && <div style={{ color: G.textDim, fontSize: 11, padding: 20 }}>No hay visitas registradas.</div>}
      </div>
      <div style={{ marginTop: 32 }}>
        <div style={css.sectionTitle}><span style={{ color: G.accentGreen }}>⊞</span> Registro Visitas</div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
          <thead><tr style={{ borderBottom:`1px solid ${G.border}` }}>{["Fecha","Lugar","Responsable","Objetivo","Resultado","Estado"].map(h=><th key={h} style={{padding:"8px 12px",textAlign:"left",color:G.textMuted,fontSize:10,textTransform:"uppercase",letterSpacing:"0.06em"}}>{h}</th>)}</tr></thead>
          <tbody>{visitas.map(v => {
            const estadoActual = v.estado || "pendiente";
            return (
              <tr key={v.id} style={{borderBottom:`1px solid ${G.borderLight}`}}>
                <td style={{padding:"8px 12px"}}>{v.fecha}</td>
                <td style={{padding:"8px 12px",fontWeight:700}}>{v.lugar}</td>
                <td style={{padding:"8px 12px",color:G.textMuted}}>{v.responsable}</td>
                <td style={{padding:"8px 12px",color:G.textMuted}}>{v.objetivo}</td>
                <td style={{padding:"8px 12px",color:G.textMuted}}>{v.resultado||"—"}</td>
                <td style={{padding:"8px 12px"}}>
                  <select style={{ ...css.select, padding: "3px 6px", width: "auto", fontSize: 10 }} value={estadoActual} onChange={e => fb.actualizar(v.id, { estado: e.target.value })}>
                    {Object.entries(VEST_COLOR).map(([e, _]) => <option key={e} value={e}>{VEST_LABELS[e]}</option>)}
                  </select>
                </td>
              </tr>
            );
          })}</tbody>
        </table>
      </div>
    </div>
  );
}

// ─── SOE ──────────────────────────────────────────────────────────────────────
function SOEModule({ soe, fb }) {
  const [showForm, setShowForm] = useState(false);
  const [jefatura, setJefatura] = useState(null);
  const [nombreJef, setNombreJef] = useState("");
  const [form, setForm] = useState({ fecha: hoy(), solicitante: RESPONSABLES[0], descripcion: "", horasExtra: 1, estado: "pendiente", aprobadaPor: "", observacion: "" });
  const SOE_COLOR = { pendiente: G.accentYellow, aprobada: G.accentGreen, rechazada: G.accentRed };
  async function guardar() {
    if (!form.descripcion) return;
    const nueva = { ...form, id: uid() };
    await fb.agregar(nueva);
    await notificarSOEJefaturas(nueva);
    setForm({ fecha: hoy(), solicitante: RESPONSABLES[0], descripcion: "", horasExtra: 1, estado: "pendiente", aprobadaPor: "", observacion: "" });
    setShowForm(false);
  }
  function abrirResolver(s) { setJefatura(s); setNombreJef(""); }
  function aprobar(id) {
    if (!nombreJef.trim()) { alert("Debe ingresar el nombre de quien autoriza."); return; }
    fb.actualizar(id, { estado: 'aprobada', aprobadaPor: nombreJef.trim() });
    setJefatura(null); setNombreJef("");
  }
  function rechazar(id, obs) {
    if (!nombreJef.trim()) { alert("Debe ingresar el nombre de quien resuelve."); return; }
    fb.actualizar(id, { estado: 'rechazada', aprobadaPor: nombreJef.trim(), observacion: obs });
    setJefatura(null); setNombreJef("");
  }
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div style={css.sectionTitle}><span style={{ color: G.accentPurple }}>⚡</span> Solicitud Trabajo Extraordinario</div>
        <button style={css.btn("primary")} onClick={() => setShowForm(true)}>+ Nueva Solicitud</button>
      </div>
      <div style={{ background: G.surface, border: `1px solid ${G.accentYellow}33`, borderRadius: 6, padding: 12, marginBottom: 20, fontSize: 11, color: G.accentYellow }}>
        ⚠ Las solicitudes requieren autorización de jefatura antes de ejecutarse.
      </div>
      {showForm && (
        <div style={css.modal} onClick={e => e.target === e.currentTarget && setShowForm(false)}>
          <div style={css.modalBox}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 20, color: G.accentPurple }}>SOLICITUD TRABAJO EXTRAORDINARIO</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={css.formGrid}>
                <Field label="Fecha"><input type="date" style={css.input} value={form.fecha} onChange={e => setForm(p => ({ ...p, fecha: e.target.value }))} /></Field>
                <Field label="Solicitante"><select style={css.select} value={form.solicitante} onChange={e => setForm(p => ({ ...p, solicitante: e.target.value }))}>{RESPONSABLES.map(r=><option key={r}>{r}</option>)}</select></Field>
              </div>
              <Field label="Descripción *"><textarea style={{ ...css.input, minHeight: 80, resize: "vertical" }} value={form.descripcion} onChange={e => setForm(p => ({ ...p, descripcion: e.target.value }))} placeholder="Justificación y descripción del trabajo..." /></Field>
              <Field label="Horas extra estimadas"><input type="number" min={1} max={24} style={css.input} value={form.horasExtra} onChange={e => setForm(p => ({ ...p, horasExtra: +e.target.value }))} /></Field>
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button style={css.btn("ghost")} onClick={() => setShowForm(false)}>Cancelar</button>
                <button style={css.btn("primary")} onClick={guardar}>Enviar Solicitud</button>
              </div>
            </div>
          </div>
        </div>
      )}
      {jefatura && (
        <div style={css.modal}>
          <div style={css.modalBox}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 16, color: G.accentPurple }}>RESOLUCIÓN JEFATURA</div>
            <div style={{ fontSize: 12, marginBottom: 4 }}>Solicitante: <strong>{jefatura.solicitante}</strong></div>
            <div style={{ fontSize: 12, marginBottom: 4 }}>Descripción: {jefatura.descripcion}</div>
            <div style={{ fontSize: 12, marginBottom: 16 }}>Horas extra: <strong>{jefatura.horasExtra} hrs</strong></div>
            <Field label="Nombre de quien autoriza / resuelve *"><input style={css.input} value={nombreJef} onChange={e => setNombreJef(e.target.value)} placeholder="Ingrese su nombre completo..." /></Field>
            <div style={{ marginTop: 12 }}><Field label="Observación"><textarea style={{ ...css.input, minHeight: 60 }} id="obs-jef" placeholder="Comentario opcional..." /></Field></div>
            <div style={{ display: "flex", gap: 8, marginTop: 16, justifyContent: "flex-end" }}>
              <button style={css.btn("ghost")} onClick={() => { setJefatura(null); setNombreJef(""); }}>Cerrar</button>
              <button style={css.btn("danger")} onClick={() => rechazar(jefatura.id, document.getElementById("obs-jef").value)}>Rechazar</button>
              <button style={css.btn("success")} onClick={() => aprobar(jefatura.id)}>✓ Aprobar</button>
            </div>
          </div>
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {soe.map(s => (
          <div key={s.id} style={{ background: G.surface, border: `1px solid ${G.border}`, borderRadius: 6, padding: 16, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6, flexWrap: "wrap" }}>
                <span style={css.badge(SOE_COLOR[s.estado] || G.textMuted)}>{s.estado}</span>
                <span style={{ fontSize: 11, color: G.textMuted }}>{s.fecha} · {s.solicitante} · {s.horasExtra} hrs extra</span>
              </div>
              <div style={{ fontSize: 12 }}>{s.descripcion}</div>
              {s.aprobadaPor && <div style={{ fontSize: 11, color: G.accentGreen, marginTop: 4 }}>✓ Aprobada por: {s.aprobadaPor}</div>}
              {s.observacion && <div style={{ fontSize: 11, color: G.accentRed, marginTop: 4 }}>✗ {s.observacion}</div>}
            </div>
            {s.estado === "pendiente" && <button style={{ ...css.btn("primary"), marginLeft: 16, whiteSpace: "nowrap" }} onClick={() => abrirResolver(s)}>Resolver ▸</button>}
          </div>
        ))}
        {soe.length === 0 && <div style={{ color: G.textDim, fontSize: 11, padding: 20 }}>No hay solicitudes registradas.</div>}
      </div>
      <div style={{ marginTop: 32 }}>
        <div style={css.sectionTitle}><span style={{ color: G.accentGreen }}>⊞</span> Registro SOE</div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
          <thead><tr style={{ borderBottom:`1px solid ${G.border}` }}>{["Fecha","Solicitante","Descripción","Horas","Estado","Aprobado por"].map(h=><th key={h} style={{padding:"8px 12px",textAlign:"left",color:G.textMuted,fontSize:10,textTransform:"uppercase",letterSpacing:"0.06em"}}>{h}</th>)}</tr></thead>
          <tbody>{soe.map(s=><tr key={s.id} style={{borderBottom:`1px solid ${G.borderLight}`}}><td style={{padding:"8px 12px"}}>{s.fecha}</td><td style={{padding:"8px 12px"}}>{s.solicitante}</td><td style={{padding:"8px 12px",color:G.textMuted}}>{s.descripcion}</td><td style={{padding:"8px 12px"}}>{s.horasExtra} hrs</td><td style={{padding:"8px 12px"}}><span style={css.badge(SOE_COLOR[s.estado]||G.textMuted)}>{s.estado}</span></td><td style={{padding:"8px 12px",color:G.textMuted}}>{s.aprobadaPor||"—"}</td></tr>)}</tbody>
        </table>
      </div>
    </div>
  );
}

// ─── CONTINGENCIAS ────────────────────────────────────────────────────────────
function ContingenciasModule({ contingencias, fb }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ fecha: hoy(), reportadoPor: RESPONSABLES[0], descripcion: "", impacto: "medio", accionTomada: "", tiempoAfectado: 0, estado: "activa" });
  const IMP_COLOR = { bajo: G.accentGreen, medio: G.accentYellow, alto: G.accentRed };
  const CONT_COLOR = { activa: G.accentRed, en_proceso: G.accentOrange, resuelta: G.accentGreen };
  async function guardar() {
    if (!form.descripcion) return;
    const { id: _id, ...fdata } = { ...form, id: uid() };
    await fb.agregar(fdata);
    setForm({ fecha: hoy(), reportadoPor: RESPONSABLES[0], descripcion: "", impacto: "medio", accionTomada: "", tiempoAfectado: 0, estado: "activa" });
    setShowForm(false);
  }
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div style={css.sectionTitle}><span style={{ color: G.accentRed }}>◉</span> Contingencias</div>
        <button style={css.btn("primary")} onClick={() => setShowForm(true)}>+ Registrar</button>
      </div>
      <div style={{ background: G.surface, border: `1px solid ${G.accentRed}33`, borderRadius: 6, padding: 12, marginBottom: 20, fontSize: 11, color: G.accentRed }}>
        🔴 Actividades fuera de planificación que afectan el rendimiento. Registro obligatorio.
      </div>
      {showForm && (
        <div style={css.modal} onClick={e => e.target === e.currentTarget && setShowForm(false)}>
          <div style={css.modalBox}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 20, color: G.accentRed }}>REGISTRAR CONTINGENCIA</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={css.formGrid}>
                <Field label="Fecha"><input type="date" style={css.input} value={form.fecha} onChange={e => setForm(p => ({ ...p, fecha: e.target.value }))} /></Field>
                <Field label="Reportado por"><select style={css.select} value={form.reportadoPor} onChange={e => setForm(p => ({ ...p, reportadoPor: e.target.value }))}>{RESPONSABLES.map(r=><option key={r}>{r}</option>)}</select></Field>
              </div>
              <Field label="Descripción *"><textarea style={{ ...css.input, minHeight: 80, resize: "vertical" }} value={form.descripcion} onChange={e => setForm(p => ({ ...p, descripcion: e.target.value }))} placeholder="¿Qué ocurrió?..." /></Field>
              <div style={css.formGrid}>
                <Field label="Impacto"><select style={css.select} value={form.impacto} onChange={e => setForm(p => ({ ...p, impacto: e.target.value }))}>{["bajo","medio","alto"].map(i=><option key={i}>{i}</option>)}</select></Field>
                <Field label="Tiempo afectado (min)"><input type="number" min={0} style={css.input} value={form.tiempoAfectado} onChange={e => setForm(p => ({ ...p, tiempoAfectado: +e.target.value }))} /></Field>
              </div>
              <Field label="Acción tomada"><textarea style={{ ...css.input, minHeight: 60, resize: "vertical" }} value={form.accionTomada} onChange={e => setForm(p => ({ ...p, accionTomada: e.target.value }))} placeholder="Medidas adoptadas..." /></Field>
              <Field label="Estado"><select style={css.select} value={form.estado} onChange={e => setForm(p => ({ ...p, estado: e.target.value }))}>{["activa","en_proceso","resuelta"].map(e=><option key={e} value={e}>{e.replace("_"," ")}</option>)}</select></Field>
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button style={css.btn("ghost")} onClick={() => setShowForm(false)}>Cancelar</button>
                <button style={{ ...css.btn("primary"), background: G.accentRed, borderColor: G.accentRed }} onClick={guardar}>Registrar</button>
              </div>
            </div>
          </div>
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(340px,1fr))", gap: 16 }}>
        {contingencias.map(c => (
          <div key={c.id} style={{ background: G.surface, border: `2px solid ${IMP_COLOR[c.impacto]}44`, borderRadius: 6, padding: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
              <span style={css.badge(CONT_COLOR[c.estado] || G.textMuted)}>{c.estado.replace("_"," ")}</span>
              <span style={css.badge(IMP_COLOR[c.impacto])}>impacto {c.impacto}</span>
            </div>
            <div style={{ fontSize: 12, marginBottom: 8, lineHeight: 1.5 }}>{c.descripcion}</div>
            <div style={{ fontSize: 11, color: G.textMuted, marginBottom: 4 }}>📅 {c.fecha} · 👤 {c.reportadoPor}</div>
            {c.tiempoAfectado > 0 && <div style={{ fontSize: 11, color: G.accentYellow }}>⏱ {c.tiempoAfectado} min afectados</div>}
            {c.accionTomada && <div style={{ fontSize: 11, color: G.accentGreen, marginTop: 6 }}>✓ {c.accionTomada}</div>}
            {c.estado !== "resuelta" && <button onClick={() => fb.actualizar(c.id, { estado: 'resuelta' })} style={{ marginTop: 10, ...css.btn("success"), padding: "4px 10px", fontSize: 10 }}>Marcar resuelta</button>}
          </div>
        ))}
        {contingencias.length === 0 && <div style={{ color: G.textDim, fontSize: 11, padding: 20 }}>No hay contingencias registradas.</div>}
      </div>
      <div style={{ marginTop: 32 }}>
        <div style={css.sectionTitle}><span style={{ color: G.accentGreen }}>⊞</span> Registro Contingencias</div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
          <thead><tr style={{ borderBottom:`1px solid ${G.border}` }}>{["Fecha","Reportado por","Descripción","Impacto","Tiempo","Estado","Acción"].map(h=><th key={h} style={{padding:"8px 12px",textAlign:"left",color:G.textMuted,fontSize:10,textTransform:"uppercase",letterSpacing:"0.06em"}}>{h}</th>)}</tr></thead>
          <tbody>{contingencias.map(c=><tr key={c.id} style={{borderBottom:`1px solid ${G.borderLight}`}}><td style={{padding:"8px 12px"}}>{c.fecha}</td><td style={{padding:"8px 12px"}}>{c.reportadoPor}</td><td style={{padding:"8px 12px",color:G.textMuted}}>{c.descripcion}</td><td style={{padding:"8px 12px"}}><span style={css.badge(IMP_COLOR[c.impacto])}>{c.impacto}</span></td><td style={{padding:"8px 12px"}}>{c.tiempoAfectado} min</td><td style={{padding:"8px 12px"}}><span style={css.badge(CONT_COLOR[c.estado]||G.textMuted)}>{c.estado.replace("_"," ")}</span></td><td style={{padding:"8px 12px",color:G.textMuted}}>{c.accionTomada||"—"}</td></tr>)}</tbody>
        </table>
      </div>
    </div>
  );
}

// ─── DASHBOARD ────────────────────────────────────────────────────────────────
function Dashboard({ tareas, visitas, soe, contingencias }) {
  const total       = tareas.length;
  const completadas = tareas.filter(t => t.estado === "completado").length;
  const enProgreso  = tareas.filter(t => t.estado === "en_progreso").length;
  const revision    = tareas.filter(t => t.estado === "revision").length;
  const pendientes  = tareas.filter(t => t.estado === "pendiente").length;
  const porVencer   = tareas.filter(t => t.estado !== "completado" && diasHasta(t.fechaTermino) <= 3 && diasHasta(t.fechaTermino) >= 0).length;
  const vencidas    = tareas.filter(t => t.estado !== "completado" && diasHasta(t.fechaTermino) < 0).length;
  const altaP       = tareas.filter(t => t.prioridad === "alta" && t.estado !== "completado").length;
  const soePend     = soe.filter(s => s.estado === "pendiente").length;
  const contAct     = contingencias.filter(c => c.estado === "activa").length;

  const urgentes = tareas.filter(t => t.estado !== "completado" && diasHasta(t.fechaTermino) <= 3).sort((a, b) => diasHasta(a.fechaTermino) - diasHasta(b.fechaTermino));

  const estadoData = [
    { label: "Completadas", count: completadas, color: G.accentGreen },
    { label: "En Progreso",  count: enProgreso,  color: G.accent      },
    { label: "En Revisión",  count: revision,    color: G.accentOrange },
    { label: "Pendientes",   count: pendientes,  color: G.textDim     },
  ];

  const P  = { background: "#fff", border: `1px solid ${G.border}`, borderRadius: 12, padding: 20, boxShadow: "0 1px 4px rgba(0,0,0,0.05)" };
  const PT = { fontSize: 11, fontWeight: 600, color: G.textMuted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 16 };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      {/* Banda de alertas */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        {vencidas === 0 && porVencer === 0 && soePend === 0 && contAct === 0 && altaP === 0 ? (
          <div style={{ flex: 1, background: G.accentGreenLight, border: `1.5px solid ${G.accentGreen}44`, borderRadius: 10, padding: "13px 18px", fontSize: 13, fontWeight: 600, color: G.accentGreen }}>
            ✓ Sin alertas críticas — operación normal
          </div>
        ) : (
          <>
            {vencidas > 0 && <AlertChip val={vencidas} label="Vencida(s)" color={G.accentRed} bg={G.accentRedLight} />}
            {porVencer > 0 && <AlertChip val={porVencer} label="Vence en ≤3d" color={G.accentOrange} bg={G.accentOrangeLight} />}
            {altaP > 0 && <AlertChip val={altaP} label="Prioridad Alta" color={G.accentRed} bg={G.accentRedLight} />}
            {soePend > 0 && <AlertChip val={soePend} label="SOE pendiente(s)" color={G.accentYellow} bg="#FDF3E3" />}
            {contAct > 0 && <AlertChip val={contAct} label="Contingencia(s)" color={G.accentRed} bg={G.accentRedLight} />}
          </>
        )}
      </div>

      {/* Fila 1: Donut | Avance por estado | Urgentes */}
      <div style={{ display: "grid", gridTemplateColumns: "auto 1fr 1fr", gap: 16 }}>
        <div style={{ ...P, minWidth: 290 }}>
          <div style={PT}>Total vs Pendientes</div>
          <DonutChart pendientes={pendientes} completadas={completadas} enProgreso={enProgreso} revision={revision} />
        </div>
        <div style={P}>
          <div style={PT}>Avance por Estado</div>
          {estadoData.map(e => {
            const pct = total > 0 ? Math.round(e.count / total * 100) : 0;
            return (
              <div key={e.label} style={{ marginBottom: 18 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 7 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 10, height: 10, borderRadius: "50%", background: e.color }} />
                    <span style={{ fontSize: 13, fontWeight: 500, color: G.text }}>{e.label}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                    <span style={{ fontSize: 20, fontWeight: 700, color: e.color, lineHeight: 1 }}>{e.count}</span>
                    <span style={{ fontSize: 11, color: G.textDim }}>{pct}%</span>
                  </div>
                </div>
                <div style={{ background: G.borderLight, borderRadius: 99, height: 10, overflow: "hidden" }}>
                  <div style={{ background: e.color, width: `${pct}%`, height: "100%", borderRadius: 99, transition: "width .7s ease", minWidth: e.count > 0 ? 6 : 0 }} />
                </div>
              </div>
            );
          })}
        </div>
        <div style={P}>
          <div style={PT}>Tareas Urgentes</div>
          {urgentes.length === 0 ? (
            <div style={{ color: G.textDim, fontSize: 13, textAlign: "center", padding: "28px 0" }}>Sin tareas urgentes</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {urgentes.slice(0, 6).map(t => {
                const d = diasHasta(t.fechaTermino);
                const c = d < 0 ? G.accentRed : G.accentOrange;
                return (
                  <div key={t.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", background: c + "0D", border: `1px solid ${c}33`, borderRadius: 8 }}>
                    <div style={{ flex: 1, minWidth: 0, marginRight: 8 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: G.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.titulo}</div>
                      <div style={{ fontSize: 11, color: G.textMuted, marginTop: 2 }}>{t.responsable}</div>
                    </div>
                    <span style={{ ...css.badge(c), fontSize: 11, flexShrink: 0 }}>{d < 0 ? `−${Math.abs(d)}d` : d === 0 ? "hoy" : `${d}d`}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ─── 3. RESUMEN SEMANAL ── */}
      <div style={P}>
        <div style={PT}>Resumen Semanal de Actividad</div>
        <ResumenSemanal tareas={tareas} visitas={visitas} />
      </div>

      {/* ─── 4. MINI CALENDARIO ── */}
      <div style={P}>
        <div style={PT}>Próximos 7 Días</div>
        <MiniCalendario tareas={tareas} visitas={visitas} soe={soe} contingencias={contingencias} />
      </div>

      {/* Fila: Semáforo carga | Tabla atrasados */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {/* ─── 1. SEMÁFORO ── */}
        <div style={P}>
          <div style={PT}>Semáforo de Carga del Equipo</div>
          <SemaforoCarga tareas={tareas} />
        </div>
        {/* ─── 2. TABLA ATRASADOS ── */}
        <div style={P}>
          <div style={PT}>¿Qué está atrasado y de quién es?</div>
          <TablaAtrasados tareas={tareas} />
        </div>
      </div>

      {/* Próximas visitas */}
      <div style={P}>
        <div style={PT}>Próximas Visitas</div>
        {visitas.length === 0 ? (
          <div style={{ color: G.textDim, fontSize: 13, textAlign: "center", padding: "20px 0" }}>No hay visitas registradas.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[...visitas].sort((a, b) => a.fecha.localeCompare(b.fecha)).slice(0, 5).map(v => {
              const d = diasHasta(v.fecha); const esHoy = d === 0;
              return (
                <div key={v.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", background: esHoy ? G.accentLight : G.bg, borderRadius: 8, border: `1px solid ${esHoy ? G.accent : G.border}` }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{v.lugar}</div>
                    <div style={{ fontSize: 11, color: G.textMuted, marginTop: 2 }}>{v.responsable}</div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 12 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: G.accent }}>{v.fecha}</div>
                    {d >= 0 && <div style={{ fontSize: 10, color: esHoy ? G.accent : G.textDim, fontWeight: esHoy ? 600 : 400 }}>{esHoy ? "Hoy" : `en ${d}d`}</div>}
                  </div>
                </div>
              );
            })}
            {visitas.length > 5 && <div style={{ fontSize: 11, color: G.textMuted, textAlign: "center" }}>+{visitas.length - 5} más — ver módulo Visitas</div>}
          </div>
        )}
      </div>

      {/* Exportar CSV */}
      <div style={{ ...P, padding: "14px 20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <span style={{ fontSize: 12, color: G.textMuted, fontWeight: 600 }}>Exportar datos:</span>
          {[
            { label: "Tareas", data: tareas, fields: ["titulo","responsable","fechaInicio","fechaTermino","estado","prioridad","descripcion"] },
            { label: "Visitas", data: visitas, fields: ["fecha","lugar","responsable","objetivo","resultado","estado"] },
            { label: "SOE", data: soe, fields: ["fecha","solicitante","descripcion","horasExtra","estado","aprobadaPor","observacion"] },
            { label: "Contingencias", data: contingencias, fields: ["fecha","reportadoPor","descripcion","impacto","tiempoAfectado","estado","accionTomada"] },
          ].map(({ label, data, fields }) => (
            <button key={label} style={{ ...css.btn("ghost"), padding: "6px 14px", fontSize: 12 }} onClick={() => {
              const csv = fields.join(",") + "\n" + data.map(row => fields.map(f => `"${(row[f]??"").toString().replace(/"/g,'""')}"`).join(",")).join("\n");
              const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8;"})); a.download = `${label.toLowerCase()}.csv`; a.click();
            }}>↓ {label}</button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── APP ──────────────────────────────────────────────────────────────────────
const MODULOS = [
  { id: "dashboard",    label: "Resumen"         },
  { id: "kanban",       label: "Tareas/Reuniones" },
  { id: "visitas",      label: "Visitas"          },
  { id: "soe",          label: "Trab. Extraord."  },
  { id: "contingencias",label: "Contingencias"    },
  { id: "informe",      label: "Informe"          },
  { id: "historial",    label: "Historial Carga"  },
];

export default function App() {
  const [modulo, setModulo] = useState("dashboard");
  const [tareas,        cargandoTareas] = useColeccion("tareas");
  const [visitas,       cargandoVis]   = useColeccion("visitas");
  const [soe,           cargandoSoe]   = useColeccion("soe");
  const [contingencias, cargandoCont]  = useColeccion("contingencias");
  const [toast, setToast] = useState(null);
  const addToast = useCallback((msg, ok = true) => setToast({ msg, ok }), []);
  const cargando = cargandoTareas || cargandoVis || cargandoSoe || cargandoCont;

  // ─── 9. Alerta diaria (una vez por sesión) ────────────────────────────────
  const [mostrarAlerta, setMostrarAlerta] = useState(false);
  useEffect(() => {
    if (cargando) return;
    const yaVisto = sessionStorage.getItem("alertaDiaria_" + hoy());
    if (!yaVisto) {
      setMostrarAlerta(true);
      sessionStorage.setItem("alertaDiaria_" + hoy(), "1");
    }
  }, [cargando]);

  const fbTareas  = { agregar: (item) => fbAgregar("tareas", item), actualizar: (id, cambios) => fbActualizar("tareas", id, cambios), eliminar: (id) => fbEliminar("tareas", id) };
  const fbVisitas = { agregar: (item) => fbAgregar("visitas", item), eliminar: (id) => fbEliminar("visitas", id), actualizar: (id, cambios) => fbActualizar("visitas", id, cambios) };
  const fbSoe     = { agregar: (item) => fbAgregar("soe", item), actualizar: (id, cambios) => fbActualizar("soe", id, cambios) };
  const fbCont    = { agregar: (item) => fbAgregar("contingencias", item), actualizar: (id, cambios) => fbActualizar("contingencias", id, cambios) };

  useEffect(() => {
    const alertadas = JSON.parse(sessionStorage.getItem("alertasVenc") || "[]");
    tareas.forEach(async t => {
      if (t.estado === "completado") return;
      const d = diasHasta(t.fechaTermino);
      if (d >= 0 && d <= 3 && !alertadas.includes(t.id)) {
        const ok = await notificarVencimiento(t, d);
        if (ok) { alertadas.push(t.id); sessionStorage.setItem("alertasVenc", JSON.stringify(alertadas)); }
      }
    });
  }, [tareas]);

  const soePendientes  = soe.filter(s => s.estado === "pendiente").length;
  const contActivas    = contingencias.filter(c => c.estado === "activa").length;
  const tareasUrgentes = tareas.filter(t => t.estado !== "completado" && diasHasta(t.fechaTermino) <= 3).length;

  if (cargando) return (
    <div style={{ ...css.app, display:"flex", alignItems:"center", justifyContent:"center", flexDirection:"column", gap:16 }}>
      <div style={{ fontSize: 36, color: G.accent }}>⬡</div>
      <div style={{ fontSize: 14, color: G.textMuted, fontWeight: 500 }}>Cargando datos...</div>
    </div>
  );

  return (
    <div style={css.app}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap'); *{box-sizing:border-box} body{margin:0} ::-webkit-scrollbar{width:6px;height:6px} ::-webkit-scrollbar-track{background:#F7F8FC} ::-webkit-scrollbar-thumb{background:#DDE2EF;border-radius:3px} input[type=date]::-webkit-calendar-picker-indicator{cursor:pointer;opacity:0.6} @keyframes semaforoPulse{0%,100%{opacity:1;transform:scale(1);box-shadow:0 0 8px var(--pulse-color,#C81E1E99)}50%{opacity:.75;transform:scale(1.2);box-shadow:0 0 16px var(--pulse-color,#C81E1E)}}`}</style>

      {/* ─── 9. Modal alerta diaria ── */}
      {mostrarAlerta && <AlertaDiaria tareas={tareas} onCerrar={() => setMostrarAlerta(false)} />}

      <header style={css.header}>
        <div>
          <div style={css.logoText}>⬡ Gestión Operativa</div>
          <div style={{ fontSize: 11, color: G.textMuted, marginTop: 2 }}>Departamento Apoyo Diagnóstico y Terapéutico</div>
        </div>
        <nav style={css.nav}>
          {MODULOS.map(m => (
            <button key={m.id} style={css.navBtn(modulo === m.id)} onClick={() => setModulo(m.id)}>
              {m.label}
              {m.id === "kanban"        && tareasUrgentes > 0 && <span style={{ marginLeft:5, background:G.accentOrange, color:"#000", borderRadius:99, padding:"0 5px", fontSize:9 }}>{tareasUrgentes}</span>}
              {m.id === "soe"           && soePendientes > 0  && <span style={{ marginLeft:5, background:G.accentYellow, color:"#000", borderRadius:99, padding:"0 5px", fontSize:9 }}>{soePendientes}</span>}
              {m.id === "contingencias" && contActivas > 0    && <span style={{ marginLeft:5, background:G.accentRed, color:"#fff", borderRadius:99, padding:"0 5px", fontSize:9 }}>{contActivas}</span>}
            </button>
          ))}
        </nav>
        <div style={{ fontSize: 10, color: G.textDim }}>{new Date().toLocaleDateString("es-CL", { weekday:"short", day:"numeric", month:"short", year:"numeric" })}</div>
      </header>
      <main style={css.main}>
        {modulo === "dashboard"     && <Dashboard tareas={tareas} visitas={visitas} soe={soe} contingencias={contingencias} />}
        {modulo === "kanban"        && <KanbanModule tareas={tareas} fb={fbTareas} addToast={addToast} />}
        {modulo === "visitas"       && <VisitasModule visitas={visitas} fb={fbVisitas} />}
        {modulo === "soe"           && <SOEModule soe={soe} fb={fbSoe} />}
        {modulo === "contingencias" && <ContingenciasModule contingencias={contingencias} fb={fbCont} />}
        {modulo === "informe"       && <InformeModule tareas={tareas} visitas={visitas} soe={soe} contingencias={contingencias} />}
        {modulo === "historial"     && <HistorialCargaModule tareas={tareas} />}
      </main>
      {toast && <Toast msg={toast.msg} ok={toast.ok} onClose={() => setToast(null)} />}
    </div>
  );
}
