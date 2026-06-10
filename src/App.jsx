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

async function fbAgregar(col, item)          { const { id: _, ...d } = item; return addDoc(collection(db, col), d); }
async function fbActualizar(col, id, cambios) { return updateDoc(doc(db, col, id), cambios); }
async function fbEliminar(col, id)            { return deleteDoc(doc(db, col, id)); }

function mkFb(col, addToast) {
  return {
    agregar:    async (item)         => { try { return await fbAgregar(col, item);           } catch { addToast("Error al guardar. Verifica tu conexión.", false); } },
    actualizar: async (id, cambios)  => { try { return await fbActualizar(col, id, cambios); } catch { addToast("Error al actualizar. Verifica tu conexión.", false); } },
    eliminar:   async (id)           => { try { return await fbEliminar(col, id);            } catch { addToast("Error al eliminar. Verifica tu conexión.", false); } },
  };
}

const EMAILJS_CONFIG = {
  SERVICE_ID:          "gestion_operativa",
  TEMPLATE_ASIGNACION: "template_04yxyyn",
  TEMPLATE_VENCIMIENTO:"template_n68j7it",
  TEMPLATE_SOE:        "TU_TEMPLATE_SOE_ID",
  PUBLIC_KEY:          "Mt6cb7NrWs_-YsfPP",
};
const CORREOS_DADT = {
  "Macarena Godoy":  "macarena.godoy@redsalud.gob.cl",
  "Carlos Faunes":   "carlos.faunes@redsalud.gob.cl",
  "Constanza Jara":  "constanza.jarau@redsalud.gob.cl",
  "Nadia Rufatt":    "nadia.rufatt@redsalud.gob.cl",
  "Tomas Chavez":    "tomas.chavez.g@redsalud.gob.cl",
  "Sebastian Soto":  "sebastian.soto.c@redsalud.gob.cl",
};

const CORREOS_PROC = {
  ...CORREOS_DADT,
  "Daniela Paredes":  "daniela.paredes@redsalud.gob.cl",
  "Gloria Vasquez":   "gloria.vasquezc@redsalud.gob.cl",
  "Andres Flores":    "andres.flores.m@redsalud.gob.cl",
  "Maria Piña":       "maria.pinav@redsalud.gob.cl",
  "Valentina Arcos":  "valentina.arcos@redsalud.gob.cl",
  "Vicente Ojeda":    "vicente.ojeda@redsalud.gob.cl",
};

const JEFATURAS = {
  "Macarena Godoy": "macarena.godoy@redsalud.gob.cl",
  "Sebastian Soto": "sebastian.soto.c@redsalud.gob.cl",
};

// Helper para obtener los correos según el departamento activo
function getCorreos(departamento) {
  return departamento === "proc" ? CORREOS_PROC : CORREOS_DADT;
}

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
const VEST_LABELS     = { programada: "Programada", en_progreso: "En Progreso", realizada: "Realizada", cancelada: "Cancelada" };

const HORAS_CAPACIDAD_REF = 20;

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

function Field({ label, children }) { return <div><span style={css.label}>{label}</span>{children}</div>; }
... [EL RESTO DE TUS COMPONENTES: Toast, FbErrorBanner, AlertChip, DonutChart, SemaforoCarga, TablaAtrasados, ResumenSemanal, MiniCalendario, InformeModule, HistorialCargaModule, AlertaDiaria, FormTarea, FormReunion, FormVisita, TareasReunionesModule, ReunionesPanel, VisitasModule, SOEModule, FormCont, ContingenciasModule, FormAusencia, AusenciasModule, Dashboard SE MANTIENEN IGUAL] ...

// ─── PANTALLA DE SELECCIÓN DE DEPARTAMENTO ────────────────────────────────────
function PantallaSeleccion({ onSeleccionar }) {
  const [hover, setHover] = useState(null);

  const cardBase = {
    background: "#fff",
    border: "2px solid transparent",
    borderRadius: 14,
    padding: "40px 36px",
    width: 300,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 14,
    cursor: "pointer",
    transition: "all 0.2s ease",
    boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
    userSelect: "none",
  };

  const cardHover = {
    borderColor: G.accent,
    boxShadow: "0 8px 28px rgba(26,86,219,0.18)",
    transform: "translateY(-4px)",
  };

  const deptos = [
    {
      id: "dadt",
      icon: "⚕️",
      titulo: "Apoyo Diagnóstico y Terapéutico",
      desc: "Panel de control exclusivo del DADT.",
      accentColor: G.accent,
    },
    {
      id: "proc",
      icon: "📊",
      titulo: "Gestión de Procesos",
      desc: "Panel de control exclusivo de Procesos.",
      accentColor: G.accentPurple,
    },
  ];

  return (
    <div
      style={{
        fontFamily: "'Inter','Segoe UI',system-ui,sans-serif",
        background: G.bg,
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      {/* Logo + título */}
      <div style={{ textAlign: "center", marginBottom: 48 }}>
        <div
          style={{
            width: 64,
            height: 64,
            background: G.accent,
            borderRadius: 16,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 30,
            margin: "0 auto 20px",
            boxShadow: "0 4px 16px rgba(26,86,219,0.30)",
          }}
        >
          ⬡
        </div>
        <h1
          style={{
            fontSize: 26,
            fontWeight: 700,
            color: G.text,
            margin: 0,
            letterSpacing: "-0.02em",
          }}
        >
          Gestión Operativa
        </h1>
        <p
          style={{
            fontSize: 14,
            color: G.textMuted,
            marginTop: 8,
            maxWidth: 340,
            lineHeight: 1.5,
          }}
        >
          Seleccione su departamento para ingresar al panel de control
        </p>
      </div>

      {/* Cards */}
      <div style={{ display: "flex", gap: 24, flexWrap: "wrap", justifyContent: "center" }}>
        {deptos.map((d) => (
          <div
            key={d.id}
            onClick={() => onSeleccionar(d.id)}
            onMouseEnter={() => setHover(d.id)}
            onMouseLeave={() => setHover(null)}
            style={{ ...cardBase, ...(hover === d.id ? { ...cardHover, borderColor: d.accentColor, boxShadow: `0 8px 28px ${d.accentColor}28` } : {}) }}
          >
            {/* Ícono con fondo de color */}
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: 14,
                background: hover === d.id ? d.accentColor + "18" : G.bg,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 30,
                transition: "background 0.2s",
              }}
            >
              {d.icon}
            </div>

            <div
              style={{
                fontSize: 15,
                fontWeight: 700,
                color: G.text,
                textAlign: "center",
                lineHeight: 1.35,
              }}
            >
              {d.titulo}
            </div>

            <div style={{ fontSize: 12, color: G.textMuted, textAlign: "center", lineHeight: 1.5 }}>
              {d.desc}
            </div>

            {/* Botón indicador */}
            <div
              style={{
                marginTop: 6,
                padding: "7px 20px",
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 600,
                background: hover === d.id ? d.accentColor : "transparent",
                color: hover === d.id ? "#fff" : d.accentColor,
                border: `1px solid ${d.accentColor}`,
                transition: "all 0.2s",
              }}
            >
              Ingresar →
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div style={{ marginTop: 48, fontSize: 11, color: G.textDim }}>
        {new Date().toLocaleDateString("es-CL", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
      </div>
    </div>
  );
}
// ─── APP ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [modulo, setModulo] = useState("dashboard");
  const [departamento, setDepartamento] = useState(null);
  const [mostrarAlerta, setMostrarAlerta] = useState(false);

  const prefijo = departamento ? `${departamento}_` : null;

  const [tareas,        cargandoTareas, errTareas]    = useColeccion(prefijo ? `${prefijo}tareas` : null);
  const [reuniones,     cargandoReun,   errReuniones] = useColeccion(prefijo ? `${prefijo}reuniones` : null);
  const [visitas,       cargandoVis,    errVisitas]   = useColeccion(prefijo ? `${prefijo}visitas` : null);
  const [soe,           cargandoSoe,    errSoe]       = useColeccion(prefijo ? `${prefijo}soe` : null);
  const [contingencias, cargandoCont,   errCont]      = useColeccion(prefijo ? `${prefijo}contingencias` : null);
  const [ausencias,     cargandoAus,    errAus]       = useColeccion(prefijo ? `${prefijo}ausencias` : null);

  const [toast, setToast] = useState(null);
  const addToast = useCallback((msg, ok = true) => setToast({ msg, ok }), []);

  // ── Responsables dinámicos según departamento ──────────────────────────────
  const CORREOS     = useMemo(() => getCorreos(departamento), [departamento]);
  const RESPONSABLES = useMemo(() => [...new Set([...Object.keys(CORREOS), ...Object.keys(JEFATURAS)])], [CORREOS]);

  const cargando = departamento && (cargandoTareas || cargandoReun || cargandoVis || cargandoSoe || cargandoCont || cargandoAus);

  const fbTareas    = useMemo(() => mkFb(prefijo ? `${prefijo}tareas` : "dummy",        addToast), [prefijo, addToast]);
  const fbReuniones = useMemo(() => mkFb(prefijo ? `${prefijo}reuniones` : "dummy",     addToast), [prefijo, addToast]);
  const fbVisitas   = useMemo(() => mkFb(prefijo ? `${prefijo}visitas` : "dummy",       addToast), [prefijo, addToast]);
  const fbSoe       = useMemo(() => mkFb(prefijo ? `${prefijo}soe` : "dummy",           addToast), [prefijo, addToast]);
  const fbCont      = useMemo(() => mkFb(prefijo ? `${prefijo}contingencias` : "dummy", addToast), [prefijo, addToast]);
  const fbAus       = useMemo(() => mkFb(prefijo ? `${prefijo}ausencias` : "dummy",     addToast), [prefijo, addToast]);

  useEffect(() => {
    if (!departamento || cargando) return;
    const k = `alertaDiaria_${departamento}_${hoy()}`;
    if (!sessionStorage.getItem(k)) {
      setMostrarAlerta(true);
      sessionStorage.setItem(k, "1");
    }
  }, [cargando, departamento]);

  useEffect(() => {
    if (!departamento) return;
    const alertadas = JSON.parse(sessionStorage.getItem(`alertasVenc_${departamento}`) || "[]");
    tareas.forEach(async (t) => {
      if (t.estado === "completado") return;
      const d = diasHasta(t.fechaTermino);
      if (d >= 0 && d <= 3 && !alertadas.includes(t.id)) {
        const correo = CORREOS[t.responsable];
        if (!correo) return;
        const ok = await notificarVencimiento(t, d);
        if (ok) {
          alertadas.push(t.id);
          sessionStorage.setItem(`alertasVenc_${departamento}`, JSON.stringify(alertadas));
        }
      }
    });
  }, [tareas, departamento, CORREOS]);

  if (!departamento) {
    return <PantallaSeleccion onSeleccionar={(id) => { setDepartamento(id); setModulo("dashboard"); }} />;
  }

  const soePendientes  = soe.filter((s) => s.estado === "pendiente").length;
  const contActivas    = contingencias.filter((c) => c.estado === "activa").length;
  const tareasUrgentes = tareas.filter((t) => t.estado !== "completado" && diasHasta(t.fechaTermino) <= 3).length;
  const ausHoy         = ausencias.filter((a) => { const h = hoy(); return a.fechaInicio <= h && a.fechaTermino >= h; }).length;
  const errores        = [errTareas, errReuniones, errVisitas, errSoe, errCont, errAus];

  if (cargando) return (
    <div style={{ ...css.app, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16 }}>
      <div style={{ fontSize: 36, color: G.accent }}>⬡</div>
      <div style={{ fontSize: 14, color: G.textMuted, fontWeight: 500 }}>Cargando datos...</div>
    </div>
  );

  const DEPTO_LABEL = {
    dadt: "Depto. Apoyo Diagnóstico y Terapéutico",
    proc: "Depto. Gestión de Procesos",
  };

  return (
    <div style={css.app}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box }
        body { margin: 0 }
        ::-webkit-scrollbar { width: 6px; height: 6px }
        ::-webkit-scrollbar-track { background: #F7F8FC }
        ::-webkit-scrollbar-thumb { background: #DDE2EF; border-radius: 3px }
        input[type=date]::-webkit-calendar-picker-indicator { cursor: pointer; opacity: 0.6 }
        @keyframes semaforoPulse {
          0%, 100% { opacity: 1; transform: scale(1); box-shadow: 0 0 8px var(--pulse-color, #C81E1E99) }
          50%       { opacity: .75; transform: scale(1.2); box-shadow: 0 0 16px var(--pulse-color, #C81E1E) }
        }
      `}</style>

      <header style={css.header}>
        <div>
          <div style={css.logoText}>⬡ Gestión Operativa</div>
          <div style={{ fontSize: 11, color: G.textMuted, marginTop: 2, fontWeight: 600 }}>
            {DEPTO_LABEL[departamento]}
          </div>
        </div>

        <nav style={css.nav}>
          {MODULOS.map((m) => (
            <button key={m.id} style={css.navBtn(modulo === m.id)} onClick={() => setModulo(m.id)}>
              {m.label}
              {m.id === "tareas"        && tareasUrgentes > 0 && <span style={{ marginLeft: 5, background: G.accentOrange, color: "#000", borderRadius: 99, padding: "0 5px", fontSize: 9 }}>{tareasUrgentes}</span>}
              {m.id === "tareas"        && reuniones.filter((r) => r.estado !== "realizada" && r.estado !== "cancelada").length > 0 && <span style={{ marginLeft: 5, background: G.accentPurple, color: "#fff", borderRadius: 99, padding: "0 5px", fontSize: 9 }}>{reuniones.filter((r) => r.estado !== "realizada" && r.estado !== "cancelada").length}</span>}
              {m.id === "soe"           && soePendientes > 0  && <span style={{ marginLeft: 5, background: G.accentYellow, color: "#000", borderRadius: 99, padding: "0 5px", fontSize: 9 }}>{soePendientes}</span>}
              {m.id === "contingencias" && contActivas > 0    && <span style={{ marginLeft: 5, background: G.accentRed, color: "#fff", borderRadius: 99, padding: "0 5px", fontSize: 9 }}>{contActivas}</span>}
              {m.id === "ausencias"     && ausHoy > 0         && <span style={{ marginLeft: 5, background: "#0891B2", color: "#fff", borderRadius: 99, padding: "0 5px", fontSize: 9 }}>{ausHoy}</span>}
            </button>
          ))}
        </nav>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
          <div style={{ fontSize: 10, color: G.textDim }}>
            {new Date().toLocaleDateString("es-CL", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
          </div>
          <button
            onClick={() => { setDepartamento(null); setModulo("dashboard"); }}
            style={{ ...css.btn("ghost"), padding: "4px 8px", fontSize: 10, borderColor: G.borderLight }}
          >
            ⟵ Cambiar Depto.
          </button>
        </div>
      </header>

      <FbErrorBanner errores={errores} />

      <main style={css.main}>
        {modulo === "dashboard"     && <Dashboard tareas={tareas} visitas={visitas} soe={soe} contingencias={contingencias} ausencias={ausencias} />}
        {modulo === "tareas"        && <TareasReunionesModule tareas={tareas} reuniones={reuniones} fbTareas={fbTareas} fbReuniones={fbReuniones} addToast={addToast} responsables={RESPONSABLES} />}
        {modulo === "visitas"       && <VisitasModule visitas={visitas} fb={fbVisitas} addToast={addToast} responsables={RESPONSABLES} />}
        {modulo === "soe"           && <SOEModule soe={soe} fb={fbSoe} addToast={addToast} responsables={RESPONSABLES} />}
        {modulo === "contingencias" && <ContingenciasModule contingencias={contingencias} fb={fbCont} addToast={addToast} responsables={RESPONSABLES} />}
        {modulo === "ausencias"     && <AusenciasModule ausencias={ausencias} fb={fbAus} addToast={addToast} responsables={RESPONSABLES} />}
        {modulo === "informe"       && <InformeModule tareas={tareas} visitas={visitas} soe={soe} contingencias={contingencias} />}
        {modulo === "historial"     && <HistorialCargaModule tareas={tareas} />}
      </main>

      {mostrarAlerta && (
        <AlertaDiaria
          tareas={tareas}
          ausencias={ausencias}
          onClose={() => setMostrarAlerta(false)}
        />
      )}

      {toast && <Toast msg={toast.msg} ok={toast.ok} onClose={() => setToast(null)} />}
    </div>
  );
}
