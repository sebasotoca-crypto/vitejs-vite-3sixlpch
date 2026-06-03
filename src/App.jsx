import { useState, useMemo, useEffect, useCallback } from "react";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ─── CONFIG FIREBASE ── reemplaza con tus datos de console.firebase.google.com ─
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
// Helpers: escuchar colección en tiempo real
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
async function fbAgregar(col, item) {
  const { id, ...data } = item;
  return addDoc(collection(db, col), data);
}
async function fbActualizar(col, id, cambios) {
  return updateDoc(doc(db, col, id), cambios);
}
async function fbEliminar(col, id) {
  return deleteDoc(doc(db, col, id));
}

// ─── CONFIG EMAILJS ── edita con tus datos de emailjs.com ────────────────────
const EMAILJS_CONFIG = {
  SERVICE_ID: "TU_SERVICE_ID",
  TEMPLATE_ASIGNACION: "TU_TEMPLATE_ASIGNACION_ID",
  TEMPLATE_VENCIMIENTO: "TU_TEMPLATE_VENCIMIENTO_ID",
  TEMPLATE_SOE: "TU_TEMPLATE_SOE_ID",
  PUBLIC_KEY: "TU_PUBLIC_KEY",
};

// Lista de todo el equipo (nombre → correo)
const CORREOS = {
  "Macarena Godoy": "macarena.godoy@redsalud.gob.cl",
  "Carlos Faunes": "carlos.faunes@redsalud.gob.cl",
  "Constanza Jara": "constanza.jarau@redsalud.gob.cl",
  "Nadia Rufatt": "nadia.rufatt@redsalud.gob.cl",
  "Tomas Chavez": "tomas.chavez.g@redsalud.gob.cl",
  "Sebastian Soto": "sebastian.soto.c@redsalud.gob.cl",
};

// Sólo las 2 jefaturas que reciben alertas SOE
const JEFATURAS = {
  "Jefatura 1": "correo.jefatura1@redsalud.gob.cl",
  "Jefatura 2": "correo.jefatura2@redsalud.gob.cl",
};


// ─── EmailJS helper ───────────────────────────────────────────────────────────
async function enviarCorreo(templateId, params) {
  try {
    const res = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ service_id: EMAILJS_CONFIG.SERVICE_ID, template_id: templateId, user_id: EMAILJS_CONFIG.PUBLIC_KEY, template_params: params }),
    });
    return res.status === 200;
  } catch { return false; }
}
async function notificarAsignacion(tarea) {
  const correo = CORREOS[tarea.responsable];
  if (!correo) return false;
  return enviarCorreo(EMAILJS_CONFIG.TEMPLATE_ASIGNACION, { to_email: correo, to_name: tarea.responsable, task_title: tarea.titulo, task_priority: tarea.prioridad.toUpperCase(), task_due: tarea.fechaTermino, task_description: tarea.descripcion || "Sin descripción" });
}
async function notificarVencimiento(tarea, diasRestantes) {
  const correo = CORREOS[tarea.responsable];
  if (!correo) return false;
  return enviarCorreo(EMAILJS_CONFIG.TEMPLATE_VENCIMIENTO, { to_email: correo, to_name: tarea.responsable, task_title: tarea.titulo, task_due: tarea.fechaTermino, days_left: diasRestantes, task_priority: tarea.prioridad.toUpperCase() });
}
// Notifica a AMBAS jefaturas cuando llega una solicitud SOE
async function notificarSOEJefaturas(solicitud) {
  const resultados = await Promise.all(
    Object.entries(JEFATURAS).map(([nombre, correo]) =>
      enviarCorreo(EMAILJS_CONFIG.TEMPLATE_SOE, {
        to_email: correo, to_name: nombre,
        solicitante: solicitud.solicitante, descripcion: solicitud.descripcion,
        horas_extra: solicitud.horasExtra, fecha: solicitud.fecha,
      })
    )
  );
  return resultados.some(Boolean);
}

// ─── Paleta ───────────────────────────────────────────────────────────────────
const G = {
  bg: "#0d1117", surface: "#161b22", surfaceHover: "#1c2128",
  border: "#30363d", borderLight: "#21262d",
  accent: "#58a6ff", accentGreen: "#3fb950", accentOrange: "#f0883e",
  accentRed: "#f85149", accentPurple: "#bc8cff", accentYellow: "#d29922",
  text: "#e6edf3", textMuted: "#8b949e", textDim: "#484f58",
};
const css = {
  app: { fontFamily: "'IBM Plex Mono','Courier New',monospace", background: G.bg, color: G.text, minHeight: "100vh", display: "flex", flexDirection: "column" },
  header: { background: G.surface, borderBottom: `1px solid ${G.border}`, padding: "12px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 100 },
  logoText: { fontSize: 13, fontWeight: 700, color: G.accent, letterSpacing: "0.08em", textTransform: "uppercase" },
  nav: { display: "flex", gap: 4, flexWrap: "wrap" },
  navBtn: (a) => ({ padding: "6px 14px", fontSize: 11, fontFamily: "inherit", fontWeight: a ? 700 : 400, background: a ? G.accent : "transparent", color: a ? "#000" : G.textMuted, border: `1px solid ${a ? G.accent : G.border}`, borderRadius: 4, cursor: "pointer", letterSpacing: "0.06em", textTransform: "uppercase", transition: "all .15s" }),
  main: { flex: 1, padding: "24px", maxWidth: 1400, width: "100%", margin: "0 auto" },
  sectionTitle: { fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: G.textMuted, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 },
  badge: (c) => ({ display: "inline-block", padding: "2px 8px", borderRadius: 3, fontSize: 10, fontWeight: 700, background: c + "22", color: c, border: `1px solid ${c}44`, letterSpacing: "0.06em", textTransform: "uppercase" }),
  card: { background: G.surface, border: `1px solid ${G.border}`, borderRadius: 6, padding: 14, marginBottom: 10, cursor: "grab", transition: "border-color .15s, box-shadow .15s" },
  input: { background: G.bg, border: `1px solid ${G.border}`, borderRadius: 4, color: G.text, padding: "8px 12px", fontSize: 12, fontFamily: "inherit", outline: "none", width: "100%", boxSizing: "border-box" },
  select: { background: G.bg, border: `1px solid ${G.border}`, borderRadius: 4, color: G.text, padding: "8px 12px", fontSize: 12, fontFamily: "inherit", outline: "none", width: "100%", boxSizing: "border-box", cursor: "pointer" },
  btn: (v = "primary") => ({ padding: "8px 18px", fontSize: 11, fontFamily: "inherit", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", border: "1px solid", borderRadius: 4, cursor: "pointer", transition: "all .15s", ...(v === "primary" ? { background: G.accent, color: "#000", borderColor: G.accent } : v === "success" ? { background: G.accentGreen, color: "#000", borderColor: G.accentGreen } : v === "danger" ? { background: "transparent", color: G.accentRed, borderColor: G.accentRed } : { background: "transparent", color: G.textMuted, borderColor: G.border }) }),
  label: { fontSize: 10, color: G.textMuted, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 4, display: "block" },
  formGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 },
  modal: { position: "fixed", inset: 0, background: "#000b", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999 },
  modalBox: { background: G.surface, border: `1px solid ${G.border}`, borderRadius: 8, padding: 24, width: 560, maxWidth: "95vw", maxHeight: "90vh", overflowY: "auto" },
};

const RESPONSABLES = [...Object.keys(CORREOS), ...Object.keys(JEFATURAS)];
const PRIORIDADES = ["baja", "media", "alta"];
const ESTADOS = ["pendiente", "en_progreso", "revision", "completado"];
const ESTADO_LABELS = { pendiente: "Pendiente", en_progreso: "En Progreso", revision: "Revisión", completado: "Completado" };
const ESTADO_ICONS = { pendiente: "○", en_progreso: "◑", revision: "◕", completado: "●" };
const PRIORIDAD_COLOR = { baja: G.accentGreen, media: G.accentYellow, alta: G.accentRed };
const ESTADO_COLOR = { pendiente: G.textMuted, en_progreso: G.accent, revision: G.accentOrange, completado: G.accentGreen };

function uid() { return Math.random().toString(36).slice(2, 9); }
function hoy() { return new Date().toISOString().slice(0, 10); }
function diasHasta(fecha) {
  const h = new Date(); h.setHours(0,0,0,0);
  return Math.round((new Date(fecha + "T00:00:00") - h) / 86400000);
}
// ─── ICS / Outlook Calendar ───────────────────────────────────────────────────
function fmtICS(fecha, hora = "090000") {
  return fecha.replace(/-/g, "") + "T" + hora;
}
function generarICS({ titulo, descripcion = "", fechaInicio, fechaTermino, responsable = "", lugar = "" }) {
  const uid_ev = Math.random().toString(36).slice(2) + "@gestop";
  const ahora = new Date().toISOString().replace(/[-:.]/g, "").slice(0, 15);
  const dtStart = fmtICS(fechaInicio || fechaTermino);
  const dtEnd   = fmtICS(fechaTermino || fechaInicio, "170000");
  const desc = [descripcion, responsable ? `Responsable: ${responsable}` : ""].filter(Boolean).join("\\n");
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Gestión Operativa ADAT//ES",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid_ev}`,
    `DTSTAMP:${ahora}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:${titulo}`,
    `DESCRIPTION:${desc}`,
    lugar ? `LOCATION:${lugar}` : "",
    "BEGIN:VALARM",
    "TRIGGER:-PT30M",
    "ACTION:DISPLAY",
    `DESCRIPTION:Recordatorio: ${titulo}`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter(l => l !== "").join("\r\n");
}
function descargarICS(datos, nombreArchivo) {
  const ics = generarICS(datos);
  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = nombreArchivo.replace(/[^a-z0-9_\-]/gi, "_") + ".ics";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function Field({ label, children }) {
  return <div><span style={css.label}>{label}</span>{children}</div>;
}
function StatCard({ label, value, color, sub }) {
  return (
    <div style={{ background: G.surface, border: `1px solid ${G.border}`, borderRadius: 6, padding: 20 }}>
      <div style={{ fontSize: 10, color: G.textMuted, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 32, fontWeight: 700, color: color || G.text, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: G.textMuted, marginTop: 6 }}>{sub}</div>}
    </div>
  );
}
function Toast({ msg, ok, onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 4000); return () => clearTimeout(t); }, [onClose]);
  return (
    <div style={{ position: "fixed", bottom: 24, right: 24, background: ok ? G.accentGreen + "ee" : G.accentRed + "ee", color: "#000", padding: "12px 20px", borderRadius: 6, fontSize: 12, fontFamily: "inherit", zIndex: 9999, fontWeight: 700, maxWidth: 320 }}>
      {ok ? "✓" : "✗"} {msg}
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
  const empty = { titulo: "", responsable: RESPONSABLES[0], fechaInicio: hoy(), fechaTermino: "", estado: "pendiente", prioridad: "media", descripcion: "" };
  const [form, setForm] = useState(empty);

  const byEstado = ESTADOS.reduce((acc, e) => ({ ...acc, [e]: tareas.filter(t => t.estado === e) }), {});

  async function agregarTarea() {
    if (!form.titulo || !form.fechaTermino) return;
    setSending(true);
    const nueva = { ...form };
    delete nueva.id;
    await fb.agregar(nueva);
    // Descarga automática del .ics para Outlook
    descargarICS({
      titulo: nueva.titulo,
      descripcion: nueva.descripcion,
      fechaInicio: nueva.fechaInicio,
      fechaTermino: nueva.fechaTermino,
      responsable: nueva.responsable,
    }, nueva.titulo);
    const ok = await notificarAsignacion(nueva);
    addToast(ok ? `Correo enviado a ${nueva.responsable}` : "Tarea creada. Configura EmailJS para enviar correos.", ok);
    setSending(false);
    setForm(empty);
    setShowForm(false);
  }

  function cambiarEstado(id, e) { fb.actualizar(id, { estado: e }); }
  function onDrop(e) { if (!dragId) return; cambiarEstado(dragId, e); setDragId(null); setDragOver(null); }
  function eliminar(id) { fb.eliminar(id); }

  function DiasTag({ fechaTermino, estado }) {
    if (estado === "completado") return null;
    const d = diasHasta(fechaTermino);
    if (d > 7) return null;
    const c = d < 0 ? G.accentRed : d <= 3 ? G.accentOrange : G.accentYellow;
    return <span style={css.badge(c)}>{d < 0 ? `−${Math.abs(d)}d` : d === 0 ? "hoy" : `${d}d`}</span>;
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div style={css.sectionTitle}><span style={{ color: G.accent }}>▦</span> Tareas / Reuniones</div>
        <button style={css.btn("primary")} onClick={() => setShowForm(true)}>+ Nueva Tarea</button>
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
                <Field label="Responsable">
                  <select style={css.select} value={form.responsable} onChange={e => setForm(p => ({ ...p, responsable: e.target.value }))}>
                    {RESPONSABLES.map(r => <option key={r}>{r}</option>)}
                  </select>
                </Field>
                <Field label="Prioridad">
                  <select style={css.select} value={form.prioridad} onChange={e => setForm(p => ({ ...p, prioridad: e.target.value }))}>
                    {PRIORIDADES.map(p => <option key={p}>{p}</option>)}
                  </select>
                </Field>
                <Field label="Fecha Inicio"><input type="date" style={css.input} value={form.fechaInicio} onChange={e => setForm(p => ({ ...p, fechaInicio: e.target.value }))} /></Field>
                <Field label="Fecha Término *"><input type="date" style={css.input} value={form.fechaTermino} onChange={e => setForm(p => ({ ...p, fechaTermino: e.target.value }))} /></Field>
              </div>
              <Field label="Estado inicial">
                <select style={css.select} value={form.estado} onChange={e => setForm(p => ({ ...p, estado: e.target.value }))}>
                  {ESTADOS.map(e => <option key={e} value={e}>{ESTADO_LABELS[e]}</option>)}
                </select>
              </Field>
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
            style={{ background: dragOver === estado ? G.surfaceHover : G.bg, border: `1px solid ${dragOver === estado ? G.accent : G.borderLight}`, borderRadius: 8, padding: 12, minHeight: 400, transition: "all .15s" }}
            onDragOver={e => { e.preventDefault(); setDragOver(estado); }}
            onDragLeave={() => setDragOver(null)}
            onDrop={() => onDrop(estado)}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={{ fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: ESTADO_COLOR[estado], fontWeight: 700 }}>{ESTADO_ICONS[estado]} {ESTADO_LABELS[estado]}</div>
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
              {tareas.map(t => {
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
  const VEST_COLOR = { programada: G.accent, en_curso: G.accentOrange, realizada: G.accentGreen, cancelada: G.accentRed };
  async function guardar() {
    if (!form.lugar || !form.objetivo) return;
    const nueva = { ...form };
    delete nueva.id;
    await fb.agregar(nueva);
    // Descarga automática del .ics para Outlook
    descargarICS({
      titulo: `Visita: ${nueva.lugar}`,
      descripcion: nueva.objetivo,
      fechaInicio: nueva.fecha,
      fechaTermino: nueva.fecha,
      responsable: nueva.responsable,
      lugar: nueva.lugar,
    }, `Visita_${nueva.lugar}`);
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
              <Field label="Estado"><select style={css.select} value={form.estado} onChange={e => setForm(p => ({ ...p, estado: e.target.value }))}>{["programada","en_curso","realizada","cancelada"].map(e => <option key={e} value={e}>{e.replace("_"," ")}</option>)}</select></Field>
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button style={css.btn("ghost")} onClick={() => setShowForm(false)}>Cancelar</button>
                <button style={css.btn("success")} onClick={guardar}>Registrar</button>
              </div>
            </div>
          </div>
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(320px,1fr))", gap: 16 }}>
        {visitas.map(v => (
          <div key={v.id} style={{ background: G.surface, border: `1px solid ${G.border}`, borderRadius: 6, padding: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
              <span style={{ fontSize: 13, fontWeight: 700 }}>{v.lugar}</span>
              <span style={css.badge(VEST_COLOR[v.estado] || G.textMuted)}>{v.estado.replace("_"," ")}</span>
            </div>
            <div style={{ fontSize: 11, color: G.textMuted, marginBottom: 6 }}>📅 {v.fecha} · 👤 {v.responsable}</div>
            <div style={{ fontSize: 11, marginBottom: v.resultado ? 8 : 0 }}><span style={{ color: G.textMuted }}>Objetivo: </span>{v.objetivo}</div>
            {v.resultado && <div style={{ fontSize: 11, color: G.accentGreen }}><span style={{ color: G.textMuted }}>Resultado: </span>{v.resultado}</div>}
            <div style={{ marginTop: 8, display: "flex", gap: 8, alignItems: "center" }}>
              <button onClick={() => descargarICS({ titulo: `Visita: ${v.lugar}`, descripcion: v.objetivo, fechaInicio: v.fecha, fechaTermino: v.fecha, responsable: v.responsable, lugar: v.lugar }, `Visita_${v.lugar}`)}
                style={{ fontSize: 9, color: G.accentOrange, background: "transparent", border: `1px solid ${G.accentOrange}44`, borderRadius: 3, padding: "2px 7px", cursor: "pointer", fontFamily: "inherit", letterSpacing: "0.04em" }}>
                📅 Descargar .ics (Outlook)
              </button>
              <button onClick={() => fb.eliminar(v.id)} style={{ ...css.btn("danger"), padding: "4px 10px", fontSize: 10 }}>Eliminar</button>
            </div>
          </div>
        ))}
        {visitas.length === 0 && <div style={{ color: G.textDim, fontSize: 11, padding: 20 }}>No hay visitas registradas.</div>}
      </div>
      <div style={{ marginTop: 32 }}>
        <div style={css.sectionTitle}><span style={{ color: G.accentGreen }}>⊞</span> Registro Visitas</div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
          <thead><tr style={{ borderBottom:`1px solid ${G.border}` }}>{["Fecha","Lugar","Responsable","Objetivo","Resultado","Estado"].map(h=><th key={h} style={{padding:"8px 12px",textAlign:"left",color:G.textMuted,fontSize:10,textTransform:"uppercase",letterSpacing:"0.06em"}}>{h}</th>)}</tr></thead>
          <tbody>{visitas.map(v=><tr key={v.id} style={{borderBottom:`1px solid ${G.borderLight}`}}><td style={{padding:"8px 12px"}}>{v.fecha}</td><td style={{padding:"8px 12px",fontWeight:700}}>{v.lugar}</td><td style={{padding:"8px 12px",color:G.textMuted}}>{v.responsable}</td><td style={{padding:"8px 12px",color:G.textMuted}}>{v.objetivo}</td><td style={{padding:"8px 12px",color:G.textMuted}}>{v.resultado||"—"}</td><td style={{padding:"8px 12px"}}><span style={css.badge(VEST_COLOR[v.estado]||G.textMuted)}>{v.estado.replace("_"," ")}</span></td></tr>)}</tbody>
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
        ⚠ Las solicitudes requieren autorización de jefatura antes de ejecutarse. Al enviar, se notificará automáticamente a las jefaturas correspondientes.
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
            <Field label="Nombre de quien autoriza / resuelve *">
              <input style={css.input} value={nombreJef} onChange={e => setNombreJef(e.target.value)} placeholder="Ingrese su nombre completo..." />
            </Field>
            <div style={{ marginTop: 12 }}>
              <Field label="Observación"><textarea style={{ ...css.input, minHeight: 60 }} id="obs-jef" placeholder="Comentario opcional..." /></Field>
            </div>
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
  const stats = useMemo(() => ({
    totalTareas: tareas.length,
    completadas: tareas.filter(t => t.estado === "completado").length,
    enProgreso: tareas.filter(t => t.estado === "en_progreso").length,
    porVencer: tareas.filter(t => t.estado !== "completado" && diasHasta(t.fechaTermino) <= 3 && diasHasta(t.fechaTermino) >= 0).length,
    vencidas: tareas.filter(t => t.estado !== "completado" && diasHasta(t.fechaTermino) < 0).length,
    altaPrioridad: tareas.filter(t => t.prioridad === "alta").length,
    visitasRealizadas: visitas.filter(v => v.estado === "realizada").length,
    visitasProgramadas: visitas.filter(v => v.estado === "programada").length,
    soePendientes: soe.filter(s => s.estado === "pendiente").length,
    totalHorasExtra: soe.filter(s => s.estado === "aprobada").reduce((a, s) => a + s.horasExtra, 0),
    contingenciasActivas: contingencias.filter(c => c.estado === "activa").length,
    minutosAfectados: contingencias.reduce((a, c) => a + c.tiempoAfectado, 0),
    tasaCompletado: tareas.length > 0 ? Math.round(tareas.filter(t => t.estado === "completado").length / tareas.length * 100) : 0,
  }), [tareas, visitas, soe, contingencias]);

  const barData = RESPONSABLES.map(r => ({ name: r.split(" ")[0], total: tareas.filter(t => t.responsable === r).length, completadas: tareas.filter(t => t.responsable === r && t.estado === "completado").length }));
  const maxBar = Math.max(...barData.map(b => b.total), 1);

  return (
    <div>
      <div style={css.sectionTitle}><span style={{ color: G.accent }}>◐</span> Resumen Operativo</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(170px,1fr))", gap: 16, marginBottom: 32 }}>
        <StatCard label="Total Tareas" value={stats.totalTareas} />
        <StatCard label="Completadas" value={stats.completadas} color={G.accentGreen} sub={`${stats.tasaCompletado}% del total`} />
        <StatCard label="En Progreso" value={stats.enProgreso} color={G.accent} />
        <StatCard label="Por Vencer ≤3d" value={stats.porVencer} color={G.accentOrange} sub={`${stats.vencidas} vencidas`} />
        <StatCard label="Prioridad Alta" value={stats.altaPrioridad} color={G.accentRed} />
        <StatCard label="Visitas Realizadas" value={stats.visitasRealizadas} color={G.accentOrange} sub={`${stats.visitasProgramadas} programadas`} />
        <StatCard label="SOE Pendientes" value={stats.soePendientes} color={G.accentYellow} sub={`${stats.totalHorasExtra} hrs aprobadas`} />
        <StatCard label="Contingencias" value={stats.contingenciasActivas} color={G.accentRed} sub={`${stats.minutosAfectados} min afectados`} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 24 }}>
        <div style={{ background: G.surface, border: `1px solid ${G.border}`, borderRadius: 6, padding: 20 }}>
          <div style={{ fontSize: 10, color: G.textMuted, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 16 }}>Tareas por Estado</div>
          {ESTADOS.map(e => { const count = tareas.filter(t => t.estado === e).length; const pct = tareas.length > 0 ? (count / tareas.length) * 100 : 0; return (
            <div key={e} style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}><span style={{ fontSize: 11, color: ESTADO_COLOR[e] }}>{ESTADO_ICONS[e]} {ESTADO_LABELS[e]}</span><span style={{ fontSize: 11, color: G.textMuted }}>{count}</span></div>
              <div style={{ background: G.borderLight, borderRadius: 2, height: 6 }}><div style={{ background: ESTADO_COLOR[e], width: `${pct}%`, height: "100%", borderRadius: 2, transition: "width .5s" }} /></div>
            </div>
          ); })}
        </div>
        <div style={{ background: G.surface, border: `1px solid ${G.border}`, borderRadius: 6, padding: 20 }}>
          <div style={{ fontSize: 10, color: G.textMuted, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 16 }}>Carga por Responsable</div>
          {barData.map(b => (
            <div key={b.name} style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}><span style={{ fontSize: 11 }}>{b.name}</span><span style={{ fontSize: 11, color: G.textMuted }}>{b.completadas}/{b.total}</span></div>
              <div style={{ display: "flex", gap: 2, height: 10 }}>
                <div style={{ background: G.accentGreen, width: `${(b.completadas / maxBar) * 100}%`, borderRadius: 2, transition: "width .5s", minWidth: b.completadas > 0 ? 4 : 0 }} />
                <div style={{ background: G.border, width: `${((b.total - b.completadas) / maxBar) * 100}%`, borderRadius: 2 }} />
              </div>
            </div>
          ))}
        </div>
      </div>
      {(stats.porVencer > 0 || stats.vencidas > 0) && (
        <div style={{ background: G.surface, border: `1px solid ${G.accentOrange}44`, borderRadius: 6, padding: 20, marginBottom: 24 }}>
          <div style={{ fontSize: 10, color: G.accentOrange, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 12 }}>⚠ Tareas urgentes</div>
          {tareas.filter(t => t.estado !== "completado" && diasHasta(t.fechaTermino) <= 3).sort((a,b) => diasHasta(a.fechaTermino) - diasHasta(b.fechaTermino)).map(t => {
            const d = diasHasta(t.fechaTermino);
            return (
              <div key={t.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: `1px solid ${G.borderLight}` }}>
                <div><div style={{ fontSize: 12, fontWeight: 700 }}>{t.titulo}</div><div style={{ fontSize: 10, color: G.textMuted }}>{t.responsable} · {t.fechaTermino}</div></div>
                <span style={css.badge(d < 0 ? G.accentRed : G.accentOrange)}>{d < 0 ? `−${Math.abs(d)}d` : d === 0 ? "hoy" : `${d}d`}</span>
              </div>
            );
          })}
        </div>
      )}
      <div style={css.sectionTitle}><span style={{ color: G.accentRed }}>⚠</span> Alertas Activas</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 32 }}>
        {stats.vencidas > 0 && <div style={{ background:G.accentRed+"11", border:`1px solid ${G.accentRed}33`, borderRadius:4, padding:"10px 14px", fontSize:11, color:G.accentRed }}>🔴 {stats.vencidas} tarea(s) VENCIDA(s) sin completar</div>}
        {stats.porVencer > 0 && <div style={{ background:G.accentOrange+"11", border:`1px solid ${G.accentOrange}33`, borderRadius:4, padding:"10px 14px", fontSize:11, color:G.accentOrange }}>⏰ {stats.porVencer} tarea(s) vence(n) en ≤ 3 días</div>}
        {stats.contingenciasActivas > 0 && <div style={{ background:G.accentRed+"11", border:`1px solid ${G.accentRed}33`, borderRadius:4, padding:"10px 14px", fontSize:11, color:G.accentRed }}>🔴 {stats.contingenciasActivas} contingencia(s) activa(s)</div>}
        {stats.soePendientes > 0 && <div style={{ background:G.accentYellow+"11", border:`1px solid ${G.accentYellow}33`, borderRadius:4, padding:"10px 14px", fontSize:11, color:G.accentYellow }}>⚡ {stats.soePendientes} solicitud(es) SOE pendiente(s) de aprobación</div>}
        {stats.vencidas===0 && stats.porVencer===0 && stats.contingenciasActivas===0 && stats.soePendientes===0 && <div style={{ background:G.accentGreen+"11", border:`1px solid ${G.accentGreen}33`, borderRadius:4, padding:"10px 14px", fontSize:11, color:G.accentGreen }}>✓ Sin alertas críticas activas</div>}
      </div>
      <div style={{ background: G.surface, border: `1px solid ${G.border}`, borderRadius: 6, padding: 20 }}>
        <div style={{ fontSize: 10, color: G.textMuted, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 12 }}>Exportar Datos (CSV)</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {[
            { label: "Tareas", data: tareas, fields: ["titulo","responsable","fechaInicio","fechaTermino","estado","prioridad","descripcion"] },
            { label: "Visitas", data: visitas, fields: ["fecha","lugar","responsable","objetivo","resultado","estado"] },
            { label: "SOE", data: soe, fields: ["fecha","solicitante","descripcion","horasExtra","estado","aprobadaPor","observacion"] },
            { label: "Contingencias", data: contingencias, fields: ["fecha","reportadoPor","descripcion","impacto","tiempoAfectado","estado","accionTomada"] },
          ].map(({ label, data, fields }) => (
            <button key={label} style={css.btn("ghost")} onClick={() => {
              const csv = fields.join(",") + "\n" + data.map(row => fields.map(f => `"${(row[f]??"").toString().replace(/"/g,'""')}"`).join(",")).join("\n");
              const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8;"})); a.download = `${label.toLowerCase()}.csv`; a.click();
            }}>↓ {label}.csv</button>
          ))}
        </div>
        <div style={{ fontSize: 10, color: G.textDim, marginTop: 8 }}>CSV compatible con Excel y Google Sheets.</div>
      </div>
    </div>
  );
}

// ─── APP ──────────────────────────────────────────────────────────────────────
const MODULOS = [
  { id: "dashboard", label: "Resumen" },
  { id: "kanban", label: "Tareas/Reuniones" },
  { id: "visitas", label: "Visitas" },
  { id: "soe", label: "Trab. Extraord." },
  { id: "contingencias", label: "Contingencias" },
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

  // Funciones Firebase para pasar a módulos hijos
  const fbTareas = {
    agregar: (item) => fbAgregar("tareas", item),
    actualizar: (id, cambios) => fbActualizar("tareas", id, cambios),
    eliminar: (id) => fbEliminar("tareas", id),
  };
  const fbVisitas = {
    agregar: (item) => fbAgregar("visitas", item),
    eliminar: (id) => fbEliminar("visitas", id),
    actualizar: (id, cambios) => fbActualizar("visitas", id, cambios),
  };
  const fbSoe = {
    agregar: (item) => fbAgregar("soe", item),
    actualizar: (id, cambios) => fbActualizar("soe", id, cambios),
  };
  const fbCont = {
    agregar: (item) => fbAgregar("contingencias", item),
    actualizar: (id, cambios) => fbActualizar("contingencias", id, cambios),
  };

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

  const soePendientes = soe.filter(s => s.estado === "pendiente").length;
  const contActivas = contingencias.filter(c => c.estado === "activa").length;
  const tareasUrgentes = tareas.filter(t => t.estado !== "completado" && diasHasta(t.fechaTermino) <= 3).length;

  if (cargando) return (
    <div style={{ ...css.app, display:"flex", alignItems:"center", justifyContent:"center", flexDirection:"column", gap:16 }}>
      <div style={{ fontSize: 28 }}>⬡</div>
      <div style={{ fontSize: 12, color: G.textDim, letterSpacing: "0.1em" }}>CARGANDO DATOS...</div>
    </div>
  );

  return (
    <div style={css.app}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;700&display=swap'); *{box-sizing:border-box} ::-webkit-scrollbar{width:6px;height:6px} ::-webkit-scrollbar-track{background:#0d1117} ::-webkit-scrollbar-thumb{background:#30363d;border-radius:3px}`}</style>
      <header style={css.header}>
        <div>
          <div style={css.logoText}>⬡ GESTIÓN OPERATIVA</div>
          <div style={{ fontSize: 9, color: G.textDim, letterSpacing: "0.06em", marginTop: 2 }}>DEPARTAMENTO APOYO DIAGNÓSTICO Y TERAPÉUTICO</div>
        </div>
        <nav style={css.nav}>
          {MODULOS.map(m => (
            <button key={m.id} style={css.navBtn(modulo === m.id)} onClick={() => setModulo(m.id)}>
              {m.label}
              {m.id === "kanban" && tareasUrgentes > 0 && <span style={{ marginLeft:5, background:G.accentOrange, color:"#000", borderRadius:99, padding:"0 5px", fontSize:9 }}>{tareasUrgentes}</span>}
              {m.id === "soe" && soePendientes > 0 && <span style={{ marginLeft:5, background:G.accentYellow, color:"#000", borderRadius:99, padding:"0 5px", fontSize:9 }}>{soePendientes}</span>}
              {m.id === "contingencias" && contActivas > 0 && <span style={{ marginLeft:5, background:G.accentRed, color:"#fff", borderRadius:99, padding:"0 5px", fontSize:9 }}>{contActivas}</span>}
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
      </main>
      {toast && <Toast msg={toast.msg} ok={toast.ok} onClose={() => setToast(null)} />}
    </div>
  );
}
