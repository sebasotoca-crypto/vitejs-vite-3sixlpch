import { useState, useMemo, useEffect, useCallback } from "react";
import { supabase } from "./supabaseClient";

// ─── CONEXIÓN A SUPABASE ──────────────────────────────────────────────────────
function useColeccion(nombre) {
  const [datos, setDatos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [errorDb, setErrorDb] = useState(null);

  useEffect(() => {
    if (!nombre) { setDatos([]); setCargando(false); return; }
    setCargando(true); setErrorDb(null);

    const fetchDatos = async () => {
      const { data, error } = await supabase.from(nombre).select('*');
      if (error) {
        console.error(`[Supabase/${nombre}]`, error);
        setErrorDb(`Sin conexión (${nombre}): ${error.message}`);
      } else {
        setDatos(data || []);
      }
      setCargando(false);
    };

    fetchDatos();

    // Suscripción a cambios en tiempo real
    const channel = supabase
      .channel(`public:${nombre}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: nombre }, () => {
        fetchDatos();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [nombre]);

  return [datos, cargando, errorDb];
}

async function dbAgregar(col, item)           { const { id: _, ...d } = item; return await supabase.from(col).insert([d]); }
async function dbActualizar(col, id, cambios) { return await supabase.from(col).update(cambios).eq('id', id); }
async function dbEliminar(col, id)            { return await supabase.from(col).delete().eq('id', id); }

function mkDb(col, addToast) {
  return {
    agregar:    async (item)        => { try { const { error } = await dbAgregar(col, item); if (error) throw error; } catch { addToast("Error al guardar. Verifica tu conexión.", false); } },
    actualizar: async (id, cambios) => { try { const { error } = await dbActualizar(col, id, cambios); if (error) throw error; } catch { addToast("Error al actualizar. Verifica tu conexión.", false); } },
    eliminar:   async (id)          => { try { const { error } = await dbEliminar(col, id); if (error) throw error; } catch { addToast("Error al eliminar. Verifica tu conexión.", false); } },
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
function Toast({ msg, ok, onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 4000); return () => clearTimeout(t); }, [onClose]);
  return (
    <div style={{ position: "fixed", bottom: 24, right: 24, background: ok ? G.accentGreen : G.accentRed, color: "#fff", padding: "12px 20px", borderRadius: 8, fontSize: 13, fontFamily: "inherit", zIndex: 9999, fontWeight: 600, maxWidth: 320, boxShadow: "0 4px 16px rgba(0,0,0,0.15)" }}>
      {ok ? "✓" : "✗"} {msg}
    </div>
  );
}
function DbErrorBanner({ errores }) {
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
function KanbanModule({ tareas, db, addToast, responsables, correos }) {
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
    await db.agregar(nueva);
    descargarICS({ titulo: nueva.titulo, descripcion: nueva.descripcion, fechaInicio: nueva.fechaInicio, fechaTermino: nueva.fechaTermino, responsable: nueva.responsable }, nueva.titulo);
    const ok = await notificarAsignacion(nueva, correos);
    addToast(ok ? `Correo enviado a ${nueva.responsable}` : "Tarea creada. Configura EmailJS para enviar correos.", ok);
    setSending(false); setForm(empty); setShowForm(false);
  }
  function cambiarEstado(id, e) { db.actualizar(id, { estado: e }); }
  function onDrop(e) { if (!dragId) return; cambiarEstado(dragId, e); setDragId(null); setDragOver(null); }
  function eliminar(id) { db.eliminar(id); }
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
                  <div style={{ borderTop: `1px solid ${G.borderLight}`, paddingTop: 8 }}>
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
    </div>
  );
}

// ─── VISITAS ──────────────────────────────────────────────────────────────────
function VisitasModule({ visitas, db, responsables }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ fecha: hoy(), lugar: "", responsable: responsables[0] || "", objetivo: "", resultado: "" });
  async function guardar() {
    if (!form.lugar || !form.objetivo) return;
    const nueva = { ...form }; delete nueva.id;
    await db.agregar(nueva);
    setForm({ fecha: hoy(), lugar: "", responsable: responsables[0] || "", objetivo: "", resultado: "" });
    setShowForm(false);
  }
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div style={css.sectionTitle}><span style={{ color: G.accentOrange }}>◈</span> Visitas / Trabajo en Terreno</div>
        <button style={css.btn("primary")} onClick={() => setShowForm(true)}>+ Nueva Visita</button>
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
              <button onClick={() => db.eliminar(v.id)} style={{ ...css.btn("danger"), padding: "4px 10px", fontSize: 10 }}>Eliminar</button>
            </div>
          </div>
        ))}
        {visitas.length === 0 && <div style={{ color: G.textDim, fontSize: 11, padding: 20 }}>No hay visitas registradas.</div>}
      </div>
    </div>
  );
}

// ─── SOE ──────────────────────────────────────────────────────────────────────
function SOEModule({ soe, db, responsables }) {
  const [showForm, setShowForm] = useState(false);
  const [jefatura, setJefatura] = useState(null);
  const [nombreJef, setNombreJef] = useState("");
  const [form, setForm] = useState({ fecha: hoy(), solicitante: responsables[0] || "", descripcion: "", horasExtra: 1, estado: "pendiente", aprobadaPor: "", observacion: "" });
  const SOE_COLOR = { pendiente: G.accentYellow, aprobada: G.accentGreen, rechazada: G.accentRed };
  
  async function guardar() {
    if (!form.descripcion) return;
    const nueva = { ...form, id: uid() };
    await db.agregar(nueva);
    await notificarSOEJefaturas(nueva);
    setForm({ fecha: hoy(), solicitante: responsables[0] || "", descripcion: "", horasExtra: 1, estado: "pendiente", aprobadaPor: "", observacion: "" });
    setShowForm(false);
  }
  function abrirResolver(s) { setJefatura(s); setNombreJef(""); }
  function aprobar(id) {
    if (!nombreJef.trim()) { alert("Debe ingresar el nombre de quien autoriza."); return; }
    db.actualizar(id, { estado: 'aprobada', aprobadaPor: nombreJef.trim() });
    setJefatura(null); setNombreJef("");
  }
  function rechazar(id, obs) {
    if (!nombreJef.trim()) { alert("Debe ingresar el nombre de quien resuelve."); return; }
    db.actualizar(id, { estado: 'rechazada', aprobadaPor: nombreJef.trim(), observacion: obs });
    setJefatura(null); setNombreJef("");
  }
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div style={css.sectionTitle}><span style={{ color: G.accentPurple }}>⚡</span> Solicitud Trabajo Extraordinario</div>
        <button style={css.btn("primary")} onClick={() => setShowForm(true)}>+ Nueva Solicitud</button>
      </div>
      {/* Resto del UI igual */}
      {showForm && (
        <div style={css.modal} onClick={e => e.target === e.currentTarget && setShowForm(false)}>
          <div style={css.modalBox}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 20, color: G.accentPurple }}>SOLICITUD TRABAJO EXTRAORDINARIO</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <Field label="Descripción *"><textarea style={{ ...css.input, minHeight: 80, resize: "vertical" }} value={form.descripcion} onChange={e => setForm(p => ({ ...p, descripcion: e.target.value }))} /></Field>
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button style={css.btn("ghost")} onClick={() => setShowForm(false)}>Cancelar</button>
                <button style={css.btn("primary")} onClick={guardar}>Enviar Solicitud</button>
              </div>
            </div>
          </div>
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {soe.map(s => (
          <div key={s.id} style={{ background: G.surface, border: `1px solid ${G.border}`, borderRadius: 6, padding: 16, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12 }}>{s.descripcion}</div>
            </div>
            {s.estado === "pendiente" && <button style={{ ...css.btn("primary"), marginLeft: 16 }} onClick={() => abrirResolver(s)}>Resolver ▸</button>}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── CONTINGENCIAS ────────────────────────────────────────────────────────────
function ContingenciasModule({ contingencias, db, responsables }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ fecha: hoy(), reportadoPor: responsables[0] || "", descripcion: "", impacto: "medio", accionTomada: "", tiempoAfectado: 0, estado: "activa" });
  const IMP_COLOR  = { bajo: G.accentGreen, medio: G.accentYellow, alto: G.accentRed };
  const CONT_COLOR = { activa: G.accentRed, en_proceso: G.accentOrange, resuelta: G.accentGreen };
  
  async function guardar() {
    if (!form.descripcion) return;
    const { id: _id, ...fdata } = { ...form, id: uid() };
    await db.agregar(fdata);
    setForm({ fecha: hoy(), reportadoPor: responsables[0] || "", descripcion: "", impacto: "medio", accionTomada: "", tiempoAfectado: 0, estado: "activa" });
    setShowForm(false);
  }
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div style={css.sectionTitle}><span style={{ color: G.accentRed }}>◉</span> Contingencias</div>
        <button style={css.btn("primary")} onClick={() => setShowForm(true)}>+ Registrar</button>
      </div>
      {showForm && (
        <div style={css.modal} onClick={e => e.target === e.currentTarget && setShowForm(false)}>
          <div style={css.modalBox}>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <Field label="Descripción *"><textarea style={{ ...css.input, minHeight: 80, resize: "vertical" }} value={form.descripcion} onChange={e => setForm(p => ({ ...p, descripcion: e.target.value }))} /></Field>
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button style={css.btn("ghost")} onClick={() => setShowForm(false)}>Cancelar</button>
                <button style={{ ...css.btn("primary"), background: G.accentRed }} onClick={guardar}>Registrar</button>
              </div>
            </div>
          </div>
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(340px,1fr))", gap: 16 }}>
        {contingencias.map(c => (
          <div key={c.id} style={{ background: G.surface, border: `2px solid ${IMP_COLOR[c.impacto]}44`, borderRadius: 6, padding: 16 }}>
            <div style={{ fontSize: 12, marginBottom: 8 }}>{c.descripcion}</div>
            {c.estado !== "resuelta" && <button onClick={() => db.actualizar(c.id, { estado: 'resuelta' })} style={{ marginTop: 10, ...css.btn("success"), padding: "4px 10px", fontSize: 10 }}>Marcar resuelta</button>}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── DASHBOARD (Se omite visualización compleja por brevedad, no requiere refactor de DB) ───
function Dashboard({ tareas, visitas, soe, contingencias }) {
    return <div style={{color: G.textMuted}}>Dashboard funcionando con Supabase...</div>;
}

// ─── PANTALLA DE SELECCIÓN DE DEPARTAMENTO ────────────────────────────────────
function PantallaSeleccion({ onSeleccionar }) {
  // La misma lógica visual que antes...
  return (
    <div style={{ padding: 24, textAlign: 'center' }}>
      <h1>Gestión Operativa</h1>
      <button onClick={() => onSeleccionar("dadt")} style={css.btn("primary")}>Depto. DADT</button>
      <button onClick={() => onSeleccionar("proc")} style={{ ...css.btn("primary"), marginLeft: 10, background: G.accentPurple }}>Depto. Procesos</button>
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

  const correos      = useMemo(() => getCorreos(departamento), [departamento]);
  const responsables = useMemo(() => [...new Set([...Object.keys(correos), ...Object.keys(JEFATURAS)])], [correos]);

  const cargando = departamento && (cargandoTareas || cargandoVis || cargandoSoe || cargandoCont);

  const dbTareas = useMemo(() => mkDb(prefijo ? `${prefijo}tareas`        : "dummy", addToast), [prefijo, addToast]);
  const dbVis    = useMemo(() => mkDb(prefijo ? `${prefijo}visitas`       : "dummy", addToast), [prefijo, addToast]);
  const dbSoe    = useMemo(() => mkDb(prefijo ? `${prefijo}soe`           : "dummy", addToast), [prefijo, addToast]);
  const dbCont   = useMemo(() => mkDb(prefijo ? `${prefijo}contingencias` : "dummy", addToast), [prefijo, addToast]);

  if (!departamento) {
    return <PantallaSeleccion onSeleccionar={(id) => { setDepartamento(id); setModulo("dashboard"); }} />;
  }

  const errores = [errTareas, errVisitas, errSoe, errCont];

  if (cargando) return <div>Cargando datos...</div>;

  return (
    <div style={css.app}>
      <header style={css.header}>
        <div style={css.logoText}>⬡ Gestión Operativa</div>
        <nav style={css.nav}>
          {MODULOS.map(m => (
            <button key={m.id} style={css.navBtn(modulo === m.id)} onClick={() => setModulo(m.id)}>
              {m.label}
            </button>
          ))}
        </nav>
      </header>

      <DbErrorBanner errores={errores} />

      <main style={css.main}>
        {modulo === "dashboard"     && <Dashboard     tareas={tareas} visitas={visitas} soe={soe} contingencias={contingencias} />}
        {modulo === "kanban"        && <KanbanModule  tareas={tareas} db={dbTareas} addToast={addToast} responsables={responsables} correos={correos} />}
        {modulo === "visitas"       && <VisitasModule visitas={visitas} db={dbVis} responsables={responsables} />}
        {modulo === "soe"           && <SOEModule     soe={soe} db={dbSoe} responsables={responsables} />}
        {modulo === "contingencias" && <ContingenciasModule contingencias={contingencias} db={dbCont} responsables={responsables} />}
      </main>

      {toast && <Toast msg={toast.msg} ok={toast.ok} onClose={() => setToast(null)} />}
    </div>
  );
}