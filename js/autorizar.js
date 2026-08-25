/* ============================================================
   autorizar.js — Autorización web de solicitudes de usuarios
   El Delegado abre el enlace, revisa la solicitud y firma sin
   necesidad de imprimir el formato.
   ============================================================ */
import { db } from "./firebase-config.js";
import {
  doc,
  getDoc,
  updateDoc,
  Timestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const NOMBRES_SISTEMA = {
  correo: "Correo Institucional",
  ani: "ANI",
  webservice: "Web Service",
  gedid: "GED ID",
  gedrc: "GED RC",
  sirc: "SIRC",
  hled: "HLED",
};

let solicitud = null;
let solId = null;
let canvas, ctx, hint, wrap;
let drawing = false;
let hasSig = false;

/* ══════════ INIT ══════════ */
document.addEventListener("DOMContentLoaded", async () => {
  const params = new URLSearchParams(window.location.search);
  solId = params.get("sol");
  const token = params.get("t");

  if (!solId || !token) return mostrarNoValido();

  try {
    const snap = await getDoc(doc(db, "solicitudes_usuarios", solId));
    if (!snap.exists()) return mostrarNoValido();

    solicitud = snap.data();
    // El codigo del enlace debe coincidir con el guardado
    if (!solicitud.tokenAutorizacion || solicitud.tokenAutorizacion !== token) {
      return mostrarNoValido();
    }

    if ((solicitud.estadoAutorizacion || "Pendiente") !== "Pendiente") {
      return mostrarResuelta(solicitud);
    }

    pintarSolicitud(solicitud);
    iniciarCanvas();
    iniciarDecision();
  } catch (err) {
    console.error("Error cargando la solicitud:", err);
    mostrarNoValido();
  }
});

function mostrarNoValido() {
  document.getElementById("cargando").style.display = "none";
  document.getElementById("noValido").style.display = "flex";
}

function fFecha(iso) {
  if (!iso) return "";
  const [a, m, d] = iso.split("-");
  return `${d}/${m}/${a}`;
}

/* ══════════ PINTAR LA SOLICITUD ══════════ */
function pintarSolicitud(s) {
  document.getElementById("cargando").style.display = "none";
  document.getElementById("cardSolicitud").style.display = "flex";

  document.getElementById("solNombre").textContent =
    `${s.nombres || ""} ${s.apellidos || ""}`;
  document.getElementById("solMeta").textContent = [
    s.cargo, s.vinculacion, s.oficina,
  ].filter(Boolean).join(" · ");

  const filas = [
    ["Cédula", s.cedula],
    ["Teléfono", s.telefono],
    ["Correo", s.correo],
    ["Oficina", s.oficina],
    ["Ciudad", `${s.ciudad || ""} (${s.departamento || ""})`],
    ["Tipo de solicitud", s.tipoSolicitud],
    ["Vigencia", `${fFecha(s.vigenciaDesde)} → ${fFecha(s.vigenciaHasta)}`],
  ];
  document.getElementById("resumenFuncionario").innerHTML = filas
    .map(
      ([k, v]) =>
        `<div class="resumen-fila"><span class="resumen-k">${k}</span><span class="resumen-v">${v || "—"}</span></div>`,
    )
    .join("");

  document.getElementById("resumenSistemas").innerHTML =
    (s.sistemasSolicitados || [])
      .map((sis) => {
        const det = s.sistemas?.[sis] || {};
        const extras = []
          .concat(det.perfiles || [], det.accesos || [], det.datos || [])
          .concat(det.acceso ? [det.acceso] : []);
        return `<div class="sistema-linea">
          <span class="sistema-chip">${NOMBRES_SISTEMA[sis] || sis}</span>
          ${extras.length ? `<span class="sistema-detalles">${extras.join(" · ")}</span>` : ""}
        </div>`;
      })
      .join("") || '<div class="resumen-v">—</div>';

  document.getElementById("resumenJustificacion").textContent =
    s.justificacion || "—";

  const img = document.getElementById("firmaFuncionario");
  if (s.firma) img.src = s.firma;
  else img.replaceWith("Sin firma registrada");
}

/* ══════════ DECISIÓN: autorizar o rechazar ══════════ */
function iniciarDecision() {
  document.querySelectorAll('input[name="decision"]').forEach((r) => {
    r.addEventListener("change", () => {
      const rechaza = document.getElementById("dec_rec").checked;
      document.getElementById("campoMotivo").style.display = rechaza ? "flex" : "none";
      // Al rechazar no se pide firma
      document.getElementById("bloqueFirma").style.display = rechaza ? "none" : "block";
    });
  });
}

/* ══════════ CANVAS FIRMA ══════════ */
function iniciarCanvas() {
  canvas = document.getElementById("sigCanvas");
  ctx = canvas.getContext("2d");
  hint = document.getElementById("canvasHint");
  wrap = document.getElementById("canvasWrap");
  ctx.strokeStyle = "#0d2c6e";
  ctx.lineWidth = 2.2;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  const pt = (e) => {
    const r = canvas.getBoundingClientRect();
    const sx = canvas.width / r.width;
    const sy = canvas.height / r.height;
    if (e.touches)
      return {
        x: (e.touches[0].clientX - r.left) * sx,
        y: (e.touches[0].clientY - r.top) * sy,
      };
    return { x: (e.clientX - r.left) * sx, y: (e.clientY - r.top) * sy };
  };

  const empezar = (e) => {
    drawing = true;
    const p = pt(e);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    wrap.classList.add("active");
  };
  const mover = (e) => {
    if (!drawing) return;
    const p = pt(e);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    hasSig = true;
    hint.style.opacity = "0";
  };

  canvas.addEventListener("mousedown", empezar);
  canvas.addEventListener("mousemove", mover);
  canvas.addEventListener("mouseup", () => (drawing = false));
  canvas.addEventListener("mouseleave", () => (drawing = false));
  canvas.addEventListener("touchstart", (e) => { e.preventDefault(); empezar(e); }, { passive: false });
  canvas.addEventListener("touchmove", (e) => { e.preventDefault(); mover(e); }, { passive: false });
  canvas.addEventListener("touchend", () => (drawing = false));
}

window.clearSig = function () {
  if (!canvas) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  hasSig = false;
  hint.style.opacity = "1";
  wrap.classList.remove("active");
};

/* ══════════ ENVIAR DECISIÓN ══════════ */
window.enviarDecision = async function () {
  const decision = document.querySelector('input[name="decision"]:checked').value;
  const motivo = document.getElementById("motivo");

  if (decision === "Rechazada" && !motivo.value.trim()) {
    motivo.classList.add("err");
    alert("Indique el motivo del rechazo.");
    return;
  }
  if (decision === "Autorizada" && !hasSig) {
    alert("Por favor dibuje su firma para autorizar la solicitud.");
    return;
  }

  const btn = document.getElementById("btnEnviar");
  btn.classList.add("loading");

  try {
    await updateDoc(doc(db, "solicitudes_usuarios", solId), {
      estadoAutorizacion: decision,
      firmaAutorizador: decision === "Autorizada" ? canvas.toDataURL("image/png") : "",
      motivoRechazo: decision === "Rechazada" ? motivo.value.trim() : "",
      fechaAutorizacion: Timestamp.now(),
    });
    mostrarResuelta({
      ...solicitud,
      estadoAutorizacion: decision,
      motivoRechazo: motivo.value.trim(),
    });
  } catch (err) {
    console.error("Error registrando la decisión:", err);
    alert("No se pudo registrar la decisión. Verifique su conexión.");
  } finally {
    btn.classList.remove("loading");
  }
};

/* ══════════ PANEL FINAL ══════════ */
function mostrarResuelta(s) {
  document.getElementById("cargando").style.display = "none";
  document.getElementById("cardSolicitud").style.display = "flex";
  document.getElementById("cuerpo").classList.add("hide");

  const autorizada = s.estadoAutorizacion === "Autorizada";
  const icono = document.getElementById("iconoResuelta");
  icono.style.background = autorizada
    ? "linear-gradient(135deg, var(--teal), var(--azul-nav))"
    : "linear-gradient(135deg, #e07a6a, #c0392b)";
  if (!autorizada) icono.innerHTML = "&#10005;";

  document.getElementById("tituloResuelta").textContent = autorizada
    ? "¡Solicitud autorizada!"
    : "Solicitud rechazada";
  document.getElementById("nombreResuelta").textContent =
    `${s.nombres || ""} ${s.apellidos || ""}`;
  document.getElementById("detalleResuelta").textContent = autorizada
    ? "Su firma quedó incorporada al formato oficial. La Delegación continuará con el trámite."
    : `Motivo: ${s.motivoRechazo || "—"}`;
  document.getElementById("panelResuelta").classList.add("show");
}
