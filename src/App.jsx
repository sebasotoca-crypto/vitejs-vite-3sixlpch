import { useState, useMemo, useEffect, useCallback } from "react";
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
  const [datos,    setDatos]    = useState([]);
  const [cargando, setCargando] = useState(true);
  const [errorFb,  setErrorFb]  = useState(null);
  useEffect(() => {
    if (!nombre) { setDatos([]); setCargando(false); return; }
    setCargando(true); setErrorFb(null);
    const unsub = onSnapshot(
      collection(db, nombre),
      snap => { setDatos(snap.docs.map(d => ({ id: d.id, ...d.data() }))); setCargando(false); setErrorFb(null); },
      err  => { console.error(`[Firebase/${nombre}]`, err); setCargando(false); setErrorFb(`Sin conexión (${nombre}): ${err.message}`); }
    );
    return unsub;
  }, [nombre]);
  return [datos, cargando, errorFb];
}

async function fbAgregar(col, item)           { const { id: _, ...d } = item; return addDoc(collection(db, col), d); }
async function fbActualizar(col, id, cambios)  { return updateDoc(doc(db, col, id), cambios); }
async function fbEliminar(col, id)             { return deleteDoc(doc(db, col, id)); }

function mkFb(col, addToast) {
  return {
    agregar:    async (item)        => { try { return await fbAgregar(col, item);           } catch { addToast("Error al guardar. Verifica tu conexión.", false); } },
    actualizar: async (id, cambios) => { try { return await fbActualizar(col, id, cambios); } catch { addToast("Error al actualizar. Verifica tu conexión.", false); } },
    eliminar:   async (id)          => { try { return await fbEliminar(col, id);            } catch { addToast("Error al eliminar. Verifica tu conexión.", false); } },
  };
}

const EMAILJS_CONFIG = {
  SERVICE_ID:           "gestion_operativa",
  TEMPLATE_ASIGNACION:  "template_04yxyyn",
  TEMPLATE_VENCIMIENTO: "template_n68j7it",
  TEMPLATE_SOE:         "TU_TEMPLATE_SOE_ID",
  PUBLIC_KEY:           "Mt6cb7NrWs_-YsfPP",
};

// ─── Correos por departamento ─────────────────────────────────────────────────
const CORREOS_DADT = {
  "Macarena Godoy": "macarena.godoy@redsalud.gob.cl",
  "Carlos Faunes":  "carlos.faunes@redsalud.gob.cl",
  "Constanza Jara": "constanza.jarau@redsalud.gob.cl",
  "Nadia Rufatt":   "nadia.rufatt@redsalud.gob.cl",
  "Tomas Chavez":   "tomas.chavez.g@redsalud.gob.cl",
  "Sebastian Soto": "sebastian.soto.c@redsalud.gob.cl",
};
const CORREOS_PROC = {
  ...CORREOS_DADT,
  "Daniela Paredes": "daniela.paredes@redsalud.gob.cl",
  "Gloria Vasquez":  "gloria.vasquezc@redsalud.gob.cl",
  "Andres Flores":   "andres.flores.m@redsalud.gob.cl",
  "Maria Piña":      "maria.pinav@redsalud.gob.cl",
  "Valentina Arcos": "valentina.arcos@redsalud.gob.cl",
  "Vicente Ojeda":   "vicente.ojeda@redsalud.gob.cl",
};
const JEFATURAS = {
  "Macarena Godoy": "macarena.godoy@redsalud.gob.cl",
  "Sebastian Soto": "sebastian.soto.c@redsalud.gob.cl",
};
function getCorreos(depto) { return depto === "proc" ? CORREOS_PROC : CORREOS_DADT; }

async function enviarCorreo(templateId, params) {
  try {
    const res = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ service_id: EMAILJS_CONFIG.SERVICE_ID, template_id: templateId, user_id: EMAILJS_CONFIG.PUBLIC_KEY, template_params: params }),
    });
    return res.status === 200;
  } catch { return false; }
}
// Estas funciones reciben el mapa de correos como argumento para ser independientes del depto
async function notificarAsignacion(tarea, correos) {
  const correo = correos[tarea.responsable]; if (!correo) return false;
  return enviarCorreo(EMAILJS_CONFIG.TEMPLATE_ASIGNACION, { to_email: correo, to_name: tarea.responsable, task_title: tarea.titulo, task_priority: tarea.prioridad.toUpperCase(), task_due: tarea.fechaTermino, task_description: tarea.descripcion || "Sin descripción" });
}
async function notificarVencimiento(tarea, diasRestantes, correos) {
  const correo = correos[tarea.responsable]; if (!correo) return false;
  return enviarCorreo(EMAILJS_CONFIG.TEMPLATE_VENCIMIENTO, { to_email: correo, to_name: tarea.responsable, task_title: tarea.titulo, task_due: tarea.fechaTermino, days_left: diasRestantes, task_priority: tarea.prioridad.toUpperCase() });
}
async function notificarSOEJefaturas(solicitud) {
  const resultados = await Promise.all(
    Object.entries(JEFATURAS).map(([nombre, correo]) =>
      enviarCorreo(EMAILJS_CONFIG.TEMPLATE_SOE, { to_email: correo, to_name: nombre, solicitante: solicitud.solicitante, descripcion: solicitud.descripcion, horas_extra: solicitud.horasExtra, fecha: solicitud.fecha })
    )
  );
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

const PRIORIDADES   = ["baja", "media", "alta"];
const ESTADOS       = ["pendiente", "en_progreso", "revision", "completado"];
const ESTADO_LABELS = { pendiente: "Pendiente", en_progreso: "En Progreso", revision: "Revisión", completado: "Completado" };
const ESTADO_ICONS  = { pendiente: "○", en_progreso: "◑", revision: "◕", completado: "●" };
const PRIORIDAD_COLOR = { baja: G.accentGreen, media: G.accentOrange, alta: G.accentRed };
const ESTADO_COLOR    = { pendiente: G.textMuted, en_progreso: G.accent, revision: G.accentOrange, completado: G.accentGreen };
const VEST_COLOR      = { programada: G.accent, en_progreso: G.accentOrange, realizada: G.accentGreen, cancelada: G.accentRed };

function uid()  { return Math.random().toString(36).slice(2, 9); }
function hoy()  { return new Date().toISOString().slice(0, 10); }
function diasHasta(fecha) {
  const h = new Date(); h.setHours(0,0,0,0);
  return Math.round((new Date(fecha + "T00:00:00") - h) / 86400000);
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

function Field({ label, children }) { return <div><span style={css.label}>{label}</span>{children}</div>; }
function StatCard({ label, value, color, sub }) {
  return (
    <div style={{ background: "#fff", border: `1px solid ${G.border}`, borderRadius: 10, padding: "18px 20px", boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
      <div style={{ fontSize: 12, color: G.textMuted, fontWeight: 500, marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 30, fontWeight: 700, color: color || G.accent, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: G.textDim, marginTop: 6 }}>{sub}</div>}
    </div>
  );
}
function Toast({ msg, ok, onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 4000); return () => clearTimeout(t); }, [onClose]);
  return (
    <div style={{ position: "fixed", bottom: 24, right: 24, background: ok ? G.accentGreen : G.accentRed, color: "#fff", padding: "12px 20px", borderRadius: 8, fontSize: 13, fontFamily: "inherit", zIndex: 9999, fontWeight: 600, maxWidth: 320, boxShadow: "0 4px 16px rgba(0,0,0,0.15)" }}>
      {ok ? "✓" : "✗"} {msg}
    </div>
  );
}
function FbErrorBanner({ errores }) {
  const activos = errores.filter(Boolean);
  if (!activos.length) return null;
  return (
    <div style={{ background: G.accentRedLight, borderBottom: `1px solid ${G.accentRed}33`, padding: "8px 28px", fontSize: 11, color: G.accentRed, display: "flex", gap: 8, alignItems: "center" }}>
      <span>⚠</span><span>{activos[0]}</span>
    </div>
  );
}
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

// ─── KANBAN ───────────────────────────────────────────────────────────────────
function KanbanModule({ tareas, fb, addToast, responsables, correos }) {
  const [showForm,    setShowForm]    = useState(false);
  const [dragId,      setDragId]      = useState(null);
  const [dragOver,    setDragOver]    = useState(null);
  const [hoveredCard, setHoveredCard] = useState(null);
  const [sending,     setSending]     = useState(false);
  const empty = { titulo: "", responsable: responsables[0] || "", fechaInicio: hoy(), fechaTermino: "", estado: "pendiente", prioridad: "media", descripcion: "" };
  const [form, setForm] = useState(empty);
  const byEstado = ESTADOS.reduce((acc, e) => ({ ...acc, [e]: tareas.filter(t => t.estado === e) }), {});

  async function agregarTarea() {
    if (!form.titulo || !form.fechaTermino) return;
    setSending(true);
    const nueva = { ...form }; delete nueva.id;
    await fb.agregar(nueva);
    descargarICS({ titulo: nueva.titulo, descripcion: nueva.descripcion, fechaInicio: nueva.fechaInicio, fechaTermino: nueva.fechaTermino, responsable: nueva.responsable }, nueva.titulo);
    const ok = await notificarAsignacion(nueva, correos);
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
                    {responsables.map(r => <option key={r}>{r}</option>)}
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
function VisitasModule({ visitas, fb, responsables }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ fecha: hoy(), lugar: "", responsable: responsables[0] || "", objetivo: "", resultado: "" });
  async function guardar() {
    if (!form.lugar || !form.objetivo) return;
    const nueva = { ...form }; delete nueva.id;
    await fb.agregar(nueva);
    descargarICS({ titulo: `Visita: ${nueva.lugar}`, descripcion: nueva.objetivo, fechaInicio: nueva.fecha, fechaTermino: nueva.fecha, responsable: nueva.responsable, lugar: nueva.lugar }, `Visita_${nueva.lugar}`);
    setForm({ fecha: hoy(), lugar: "", responsable: responsables[0] || "", objetivo: "", resultado: "" });
    setShowForm(false);
  }
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div style={css.sectionTitle}><span style={{ color: G.accentOrange }}>◈</span> Visitas / Trabajo en Terreno</div>
        <button style={css.btn("primary")} onClick={() => setShowForm(true)}>+ Nueva Visita</button>
      </div>
      <div style={{ background: G.surface, border: `1px solid ${G.accentOrange}33`, borderRadius: 6, padding: "10px 14px", marginBottom: 20, fontSize: 11, color: G.accentOrange }}>
        📅 Al registrar una visita se descargará automáticamente un archivo <strong>.ics</strong>.
      </div>
      {showForm && (
        <div style={css.modal} onClick={e => e.target === e.currentTarget && setShowForm(false)}>
          <div style={css.modalBox}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 20, color: G.accentOrange }}>REGISTRAR VISITA</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={css.formGrid}>
                <Field label="Fecha"><input type="date" style={css.input} value={form.fecha} onChange={e => setForm(p => ({ ...p, fecha: e.target.value }))} /></Field>
                <Field label="Responsable">
                  <select style={css.select} value={form.responsable} onChange={e => setForm(p => ({ ...p, responsable: e.target.value }))}>
                    {responsables.map(r => <option key={r}>{r}</option>)}
                  </select>
                </Field>
              </div>
              <Field label="Lugar *"><input style={css.input} value={form.lugar} onChange={e => setForm(p => ({ ...p, lugar: e.target.value }))} placeholder="Dirección o nombre del lugar..." /></Field>
              <Field label="Objetivo *"><textarea style={{ ...css.input, minHeight: 60, resize: "vertical" }} value={form.objetivo} onChange={e => setForm(p => ({ ...p, objetivo: e.target.value }))} placeholder="Objetivo de la visita..." /></Field>
              <Field label="Resultado"><textarea style={{ ...css.input, minHeight: 60, resize: "vertical" }} value={form.resultado} onChange={e => setForm(p => ({ ...p, resultado: e.target.value }))} placeholder="Resultado obtenido..." /></Field>
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
            <div style={{ marginBottom: 10 }}><span style={{ fontSize: 14, fontWeight: 600, color: G.text }}>{v.lugar}</span></div>
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
          <thead><tr style={{ borderBottom:`1px solid ${G.border}` }}>{["Fecha","Lugar","Responsable","Objetivo","Resultado"].map(h=><th key={h} style={{padding:"8px 12px",textAlign:"left",color:G.textMuted,fontSize:10,textTransform:"uppercase",letterSpacing:"0.06em"}}>{h}</th>)}</tr></thead>
          <tbody>{visitas.map(v=><tr key={v.id} style={{borderBottom:`1px solid ${G.borderLight}`}}><td style={{padding:"8px 12px"}}>{v.fecha}</td><td style={{padding:"8px 12px",fontWeight:700}}>{v.lugar}</td><td style={{padding:"8px 12px",color:G.textMuted}}>{v.responsable}</td><td style={{padding:"8px 12px",color:G.textMuted}}>{v.objetivo}</td><td style={{padding:"8px 12px",color:G.textMuted}}>{v.resultado||"—"}</td></tr>)}</tbody>
        </table>
      </div>
    </div>
  );
}

// ─── SOE ──────────────────────────────────────────────────────────────────────
function SOEModule({ soe, fb, responsables }) {
  const [showForm, setShowForm] = useState(false);
  const [jefatura, setJefatura] = useState(null);
  const [nombreJef, setNombreJef] = useState("");
  const [form, setForm] = useState({ fecha: hoy(), solicitante: responsables[0] || "", descripcion: "", horasExtra: 1, estado: "pendiente", aprobadaPor: "", observacion: "" });
  const SOE_COLOR = { pendiente: G.accentYellow, aprobada: G.accentGreen, rechazada: G.accentRed };
  async function guardar() {
    if (!form.descripcion) return;
    const nueva = { ...form, id: uid() };
    await fb.agregar(nueva);
    await notificarSOEJefaturas(nueva);
    setForm({ fecha: hoy(), solicitante: responsables[0] || "", descripcion: "", horasExtra: 1, estado: "pendiente", aprobadaPor: "", observacion: "" });
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
                <Field label="Solicitante">
                  <select style={css.select} value={form.solicitante} onChange={e => setForm(p => ({ ...p, solicitante: e.target.value }))}>
                    {responsables.map(r => <option key={r}>{r}</option>)}
                  </select>
                </Field>
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
function ContingenciasModule({ contingencias, fb, responsables }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ fecha: hoy(), reportadoPor: responsables[0] || "", descripcion: "", impacto: "medio", accionTomada: "", tiempoAfectado: 0, estado: "activa" });
  const IMP_COLOR  = { bajo: G.accentGreen, medio: G.accentYellow, alto: G.accentRed };
  const CONT_COLOR = { activa: G.accentRed, en_proceso: G.accentOrange, resuelta: G.accentGreen };
  async function guardar() {
    if (!form.descripcion) return;
    const { id: _id, ...fdata } = { ...form, id: uid() };
    await fb.agregar(fdata);
    setForm({ fecha: hoy(), reportadoPor: responsables[0] || "", descripcion: "", impacto: "medio", accionTomada: "", tiempoAfectado: 0, estado: "activa" });
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
                <Field label="Reportado por">
                  <select style={css.select} value={form.reportadoPor} onChange={e => setForm(p => ({ ...p, reportadoPor: e.target.value }))}>
                    {responsables.map(r => <option key={r}>{r}</option>)}
                  </select>
                </Field>
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

// ─── DONUT ────────────────────────────────────────────────────────────────────
function DonutChart({ pendientes, completadas, enProgreso, revision }) {
  const total = pendientes + completadas + enProgreso + revision;
  const size = 180, cx = 90, cy = 90, r = 68, sw = 24;
  const circ = 2 * Math.PI * r;
  const segs = [
    { v: completadas, c: G.accentGreen  },
    { v: enProgreso,  c: G.accent       },
    { v: revision,    c: G.accentOrange },
    { v: pendientes,  c: G.textDim      },
  ].filter(s => s.v > 0);
  let off = 0;
  const arcs = segs.map(s => {
    const dash = (s.v / total) * circ;
    const a = { ...s, dash, gap: circ - dash, off };
    off += dash; return a;
  });
  const pct    = total > 0 ? Math.round(completadas / total * 100) : 0;
  const pColor = pct >= 75 ? G.accentGreen : pct >= 40 ? G.accent : G.accentOrange;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
      <div style={{ position: "relative", flexShrink: 0 }}>
        <svg width={size} height={size}>
          <circle cx={cx} cy={cy} r={r} fill="none" stroke={G.borderLight} strokeWidth={sw} />
          {arcs.map((a, i) => (
            <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={a.c} strokeWidth={sw}
              strokeDasharray={`${a.dash} ${a.gap}`} strokeDashoffset={circ / 4 - a.off} strokeLinecap="round"
              style={{ transition: "stroke-dasharray .7s ease" }} />
          ))}
        </svg>
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
          <div style={{ fontSize: 30, fontWeight: 700, color: pColor, lineHeight: 1 }}>{pct}%</div>
          <div style={{ fontSize: 10, color: G.textMuted, marginTop: 3 }}>completado</div>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
        {[{ label:"Completadas",v:completadas,c:G.accentGreen },{ label:"En Progreso",v:enProgreso,c:G.accent },{ label:"En Revisión",v:revision,c:G.accentOrange },{ label:"Pendientes",v:pendientes,c:G.textDim }].map(({ label, v, c }) => (
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
  const respData    = [...new Set(tareas.map(t => t.responsable))].map(r => ({
    name: r.split(" ").slice(0, 2).join(" "),
    activas: tareas.filter(t => t.responsable === r && t.estado !== "completado").length,
    ok:      tareas.filter(t => t.responsable === r && t.estado === "completado").length,
    total:   tareas.filter(t => t.responsable === r).length,
  })).filter(r => r.total > 0).sort((a, b) => b.total - a.total);
  const maxCarga = Math.max(...respData.map(r => r.total), 1);
  const urgentes = tareas.filter(t => t.estado !== "completado" && diasHasta(t.fechaTermino) <= 3).sort((a, b) => diasHasta(a.fechaTermino) - diasHasta(b.fechaTermino));
  const estadoData = [
    { label:"Completadas", count:completadas, color:G.accentGreen,  bg:G.accentGreenLight  },
    { label:"En Progreso",  count:enProgreso,  color:G.accent,       bg:G.accentLight       },
    { label:"En Revisión",  count:revision,    color:G.accentOrange, bg:G.accentOrangeLight },
    { label:"Pendientes",   count:pendientes,  color:G.textDim,      bg:G.borderLight       },
  ];
  const P  = { background: "#fff", border: `1px solid ${G.border}`, borderRadius: 12, padding: 20, boxShadow: "0 1px 4px rgba(0,0,0,0.05)" };
  const PT = { fontSize: 11, fontWeight: 600, color: G.textMuted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 16 };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        {vencidas === 0 && porVencer === 0 && soePend === 0 && contAct === 0 && altaP === 0 ? (
          <div style={{ flex: 1, background: G.accentGreenLight, border: `1.5px solid ${G.accentGreen}44`, borderRadius: 10, padding: "13px 18px", fontSize: 13, fontWeight: 600, color: G.accentGreen }}>✓ Sin alertas críticas — operación normal</div>
        ) : (
          <>
            {vencidas > 0  && <AlertChip val={vencidas}  label="Vencida(s)"       color={G.accentRed}    bg={G.accentRedLight}    />}
            {porVencer > 0 && <AlertChip val={porVencer} label="Vence en ≤3d"     color={G.accentOrange} bg={G.accentOrangeLight} />}
            {altaP > 0     && <AlertChip val={altaP}     label="Prioridad Alta"   color={G.accentRed}    bg={G.accentRedLight}    />}
            {soePend > 0   && <AlertChip val={soePend}   label="SOE pendiente(s)" color={G.accentYellow} bg="#FDF3E3"             />}
            {contAct > 0   && <AlertChip val={contAct}   label="Contingencia(s)"  color={G.accentRed}    bg={G.accentRedLight}    />}
          </>
        )}
      </div>
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
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div style={P}>
          <div style={PT}>Carga por Responsable</div>
          {respData.length === 0 ? (
            <div style={{ color: G.textDim, fontSize: 13, textAlign: "center", padding: "20px 0" }}>Sin tareas asignadas</div>
          ) : respData.map(r => (
            <div key={r.name} style={{ marginBottom: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 500, color: G.text }}>{r.name}</span>
                <div style={{ display: "flex", gap: 10 }}>
                  <span style={{ fontSize: 11, color: G.accentGreen, fontWeight: 600 }}>{r.ok} ok</span>
                  <span style={{ fontSize: 11, color: G.textMuted }}>{r.activas} activas</span>
                </div>
              </div>
              <div style={{ background: G.borderLight, borderRadius: 99, height: 10, overflow: "hidden", display: "flex" }}>
                <div style={{ background: G.accentGreen, width: `${(r.ok / maxCarga) * 100}%`, transition: "width .6s", minWidth: r.ok > 0 ? 4 : 0 }} />
                <div style={{ background: G.accent + "66", width: `${(r.activas / maxCarga) * 100}%`, transition: "width .6s", minWidth: r.activas > 0 ? 4 : 0 }} />
              </div>
            </div>
          ))}
          <div style={{ display: "flex", gap: 16, marginTop: 4 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}><div style={{ width: 8, height: 8, borderRadius: "50%", background: G.accentGreen }} /><span style={{ fontSize: 11, color: G.textMuted }}>Completadas</span></div>
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}><div style={{ width: 8, height: 8, borderRadius: "50%", background: G.accent + "66" }} /><span style={{ fontSize: 11, color: G.textMuted }}>Activas</span></div>
          </div>
        </div>
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
      </div>
      <div style={{ ...P, padding: "14px 20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <span style={{ fontSize: 12, color: G.textMuted, fontWeight: 600 }}>Exportar datos:</span>
          {[
            { label: "Tareas",        data: tareas,        fields: ["titulo","responsable","fechaInicio","fechaTermino","estado","prioridad","descripcion"] },
            { label: "Visitas",       data: visitas,       fields: ["fecha","lugar","responsable","objetivo","resultado"] },
            { label: "SOE",           data: soe,           fields: ["fecha","solicitante","descripcion","horasExtra","estado","aprobadaPor","observacion"] },
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

// ─── PANTALLA DE SELECCIÓN DE DEPARTAMENTO ────────────────────────────────────
function PantallaSeleccion({ onSeleccionar }) {
  const [hover, setHover] = useState(null);
  const deptos = [
    { id: "dadt", icon: "⚕️", titulo: "Apoyo Diagnóstico y Terapéutico", desc: "Panel de control exclusivo del DADT.", accentColor: G.accent },
    { id: "proc", icon: "📊", titulo: "Gestión de Procesos",              desc: "Panel de control exclusivo de Procesos.", accentColor: G.accentPurple },
  ];
  const cardBase = {
    background: "#fff", border: "2px solid transparent", borderRadius: 14,
    padding: "40px 36px", width: 300, display: "flex", flexDirection: "column",
    alignItems: "center", gap: 14, cursor: "pointer", transition: "all 0.2s ease",
    boxShadow: "0 2px 12px rgba(0,0,0,0.06)", userSelect: "none",
  };
  return (
    <div style={{ fontFamily: "'Inter','Segoe UI',system-ui,sans-serif", background: G.bg, minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap'); *{box-sizing:border-box} body{margin:0}`}</style>
      <div style={{ textAlign: "center", marginBottom: 48 }}>
        <div style={{ width: 64, height: 64, background: G.accent, borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 30, margin: "0 auto 20px", boxShadow: "0 4px 16px rgba(26,86,219,0.30)", color: "#fff" }}>⬡</div>
        <h1 style={{ fontSize: 26, fontWeight: 700, color: G.text, margin: 0, letterSpacing: "-0.02em" }}>Gestión Operativa</h1>
        <p style={{ fontSize: 14, color: G.textMuted, marginTop: 8, maxWidth: 340, lineHeight: 1.5 }}>Seleccione su departamento para ingresar al panel de control</p>
      </div>
      <div style={{ display: "flex", gap: 24, flexWrap: "wrap", justifyContent: "center" }}>
        {deptos.map((d) => (
          <div key={d.id}
            onClick={() => onSeleccionar(d.id)}
            onMouseEnter={() => setHover(d.id)}
            onMouseLeave={() => setHover(null)}
            style={{ ...cardBase, ...(hover === d.id ? { borderColor: d.accentColor, boxShadow: `0 8px 28px ${d.accentColor}28`, transform: "translateY(-4px)" } : {}) }}
          >
            <div style={{ width: 64, height: 64, borderRadius: 14, background: hover === d.id ? d.accentColor + "18" : G.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 30, transition: "background 0.2s" }}>
              {d.icon}
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, color: G.text, textAlign: "center", lineHeight: 1.35 }}>{d.titulo}</div>
            <div style={{ fontSize: 12, color: G.textMuted, textAlign: "center", lineHeight: 1.5 }}>{d.desc}</div>
            <div style={{ marginTop: 6, padding: "7px 20px", borderRadius: 6, fontSize: 12, fontWeight: 600, background: hover === d.id ? d.accentColor : "transparent", color: hover === d.id ? "#fff" : d.accentColor, border: `1px solid ${d.accentColor}`, transition: "all 0.2s" }}>
              Ingresar →
            </div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 48, fontSize: 11, color: G.textDim }}>
        {new Date().toLocaleDateString("es-CL", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
      </div>
    </div>
  );
}

// ─── APP ──────────────────────────────────────────────────────────────────────
const MODULOS = [
  { id: "dashboard",     label: "Resumen"           },
  { id: "kanban",        label: "Tareas/Reuniones"  },
  { id: "visitas",       label: "Visitas"           },
  { id: "soe",           label: "Trab. Extraord."   },
  { id: "contingencias", label: "Contingencias"     },
];
const DEPTO_LABEL = {
  dadt: "Depto. Apoyo Diagnóstico y Terapéutico",
  proc: "Depto. Gestión de Procesos",
};

export default function App() {
  const [modulo,       setModulo]       = useState("dashboard");
  const [departamento, setDepartamento] = useState(null);

  const prefijo = departamento ? `${departamento}_` : null;

  const [tareas,        cargandoTareas, errTareas]   = useColeccion(prefijo ? `${prefijo}tareas`        : null);
  const [visitas,       cargandoVis,    errVisitas]  = useColeccion(prefijo ? `${prefijo}visitas`       : null);
  const [soe,           cargandoSoe,    errSoe]      = useColeccion(prefijo ? `${prefijo}soe`           : null);
  const [contingencias, cargandoCont,   errCont]     = useColeccion(prefijo ? `${prefijo}contingencias` : null);

  const [toast, setToast] = useState(null);
  const addToast = useCallback((msg, ok = true) => setToast({ msg, ok }), []);

  // Responsables y correos dinámicos según departamento
  const correos      = useMemo(() => getCorreos(departamento), [departamento]);
  const responsables = useMemo(() => [...new Set([...Object.keys(correos), ...Object.keys(JEFATURAS)])], [correos]);

  const cargando = departamento && (cargandoTareas || cargandoVis || cargandoSoe || cargandoCont);

  const fbTareas = useMemo(() => mkFb(prefijo ? `${prefijo}tareas`        : "dummy", addToast), [prefijo, addToast]);
  const fbVis    = useMemo(() => mkFb(prefijo ? `${prefijo}visitas`       : "dummy", addToast), [prefijo, addToast]);
  const fbSoe    = useMemo(() => mkFb(prefijo ? `${prefijo}soe`           : "dummy", addToast), [prefijo, addToast]);
  const fbCont   = useMemo(() => mkFb(prefijo ? `${prefijo}contingencias` : "dummy", addToast), [prefijo, addToast]);

  useEffect(() => {
    if (!departamento) return;
    const alertadas = JSON.parse(sessionStorage.getItem(`alertasVenc_${departamento}`) || "[]");
    tareas.forEach(async t => {
      if (t.estado === "completado") return;
      const d = diasHasta(t.fechaTermino);
      if (d >= 0 && d <= 3 && !alertadas.includes(t.id)) {
        const ok = await notificarVencimiento(t, d, correos);
        if (ok) { alertadas.push(t.id); sessionStorage.setItem(`alertasVenc_${departamento}`, JSON.stringify(alertadas)); }
      }
    });
  }, [tareas, departamento, correos]);

  if (!departamento) {
    return <PantallaSeleccion onSeleccionar={(id) => { setDepartamento(id); setModulo("dashboard"); }} />;
  }

  const errores        = [errTareas, errVisitas, errSoe, errCont];
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
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap'); *{box-sizing:border-box} body{margin:0} ::-webkit-scrollbar{width:6px;height:6px} ::-webkit-scrollbar-track{background:#F7F8FC} ::-webkit-scrollbar-thumb{background:#DDE2EF;border-radius:3px} input[type=date]::-webkit-calendar-picker-indicator{cursor:pointer;opacity:0.6}`}</style>

      <header style={css.header}>
        <div>
          <div style={css.logoText}>⬡ Gestión Operativa</div>
          <div style={{ fontSize: 11, color: departamento === "proc" ? G.accentPurple : G.accent, marginTop: 2, fontWeight: 600 }}>
            {DEPTO_LABEL[departamento]}
          </div>
        </div>
        <nav style={css.nav}>
          {MODULOS.map(m => (
            <button key={m.id} style={css.navBtn(modulo === m.id)} onClick={() => setModulo(m.id)}>
              {m.label}
              {m.id === "kanban"        && tareasUrgentes > 0 && <span style={{ marginLeft:5, background:G.accentOrange, color:"#000", borderRadius:99, padding:"0 5px", fontSize:9 }}>{tareasUrgentes}</span>}
              {m.id === "soe"           && soePendientes > 0  && <span style={{ marginLeft:5, background:G.accentYellow, color:"#000", borderRadius:99, padding:"0 5px", fontSize:9 }}>{soePendientes}</span>}
              {m.id === "contingencias" && contActivas > 0    && <span style={{ marginLeft:5, background:G.accentRed,    color:"#fff", borderRadius:99, padding:"0 5px", fontSize:9 }}>{contActivas}</span>}
            </button>
          ))}
        </nav>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
          <div style={{ fontSize: 10, color: G.textDim }}>{new Date().toLocaleDateString("es-CL", { weekday:"short", day:"numeric", month:"short", year:"numeric" })}</div>
          <button onClick={() => { setDepartamento(null); setModulo("dashboard"); }} style={{ ...css.btn("ghost"), padding: "4px 8px", fontSize: 10, borderColor: G.borderLight }}>
            ⟵ Cambiar Depto.
          </button>
        </div>
      </header>

      <FbErrorBanner errores={errores} />

      <main style={css.main}>
        {modulo === "dashboard"     && <Dashboard     tareas={tareas} visitas={visitas} soe={soe} contingencias={contingencias} />}
        {modulo === "kanban"        && <KanbanModule  tareas={tareas} fb={fbTareas} addToast={addToast} responsables={responsables} correos={correos} />}
        {modulo === "visitas"       && <VisitasModule visitas={visitas} fb={fbVis} responsables={responsables} />}
        {modulo === "soe"           && <SOEModule     soe={soe} fb={fbSoe} responsables={responsables} />}
        {modulo === "contingencias" && <ContingenciasModule contingencias={contingencias} fb={fbCont} responsables={responsables} />}
      </main>

      {toast && <Toast msg={toast.msg} ok={toast.ok} onClose={() => setToast(null)} />}
    </div>
  );
}
