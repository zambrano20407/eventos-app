import { db } from "./firebase-config.js";
import { SEDES } from "./sedes.js";
import { formatoDe } from "./formatos.js";
import {
  collection,
  addDoc,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  Timestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

console.log("asistencia.js conectado con Firebase");

/* ══════════════════════════════════════════
   VARIABLES GLOBALES
══════════════════════════════════════════ */
let eventoActivo = null;
let canvas, ctx, hint, wrap;
let drawing = false;
let hasSig = false;

/* ══════════════════════════════════════════
   INIT — espera a que el DOM esté listo
══════════════════════════════════════════ */
/* El desplegable de dependencia se arma desde sedes.js: es la misma
   lista que el panel usa para saber a quién se convocó, y así no pueden
   quedar desincronizadas. */
function llenarDependencias() {
  const sel = document.getElementById("dependencia");
  if (!sel) return;
  sel.insertAdjacentHTML(
    "beforeend",
    SEDES.map((s) => `<option>${s.nombre}</option>`).join(""),
  );
}

/* ══════════════════════════════════════════
   MAYÚSCULAS SEGÚN LA GTC 185

   La guía de documentación organizacional reserva la mayúscula
   sostenida para las etiquetas del formato (FECHA, LUGAR, ASISTENTES) y
   pide mayúscula inicial para los datos: el nombre y el cargo. Además
   se lee mejor: en mayúscula sostenida todas las letras quedan del
   mismo alto y se pierde la silueta de la palabra.
══════════════════════════════════════════ */

// En español estas palabras van en minúscula dentro de un nombre,
// salvo cuando lo encabezan
const PARTICULAS = ["de", "del", "la", "las", "los", "y", "e", "da", "do"];

/* "LILIANA CERQUERA DE LA CRUZ" → "Liliana Cerquera de la Cruz" */
function comoNombrePropio(texto) {
  return String(texto || "")
    .toLowerCase()
    .split(" ")
    .map((palabra, i) => {
      if (!palabra) return palabra;
      if (i > 0 && PARTICULAS.includes(palabra)) return palabra;
      return palabra[0].toUpperCase() + palabra.slice(1);
    })
    .join(" ");
}

/* "REGISTRADOR MUNICIPAL" → "Registrador municipal".
   Los cargos son nombres comunes, así que solo se capitaliza el
   inicio, no cada palabra. */
function comoOracion(texto) {
  const limpio = String(texto || "").toLowerCase();
  return limpio ? limpio[0].toUpperCase() + limpio.slice(1) : limpio;
}

/* ¿El evento se lleva en el formato de reuniones (SGFT07)? */
function esFormatoReuniones() {
  return formatoDe(eventoActivo).codigo === "SGFT07";
}

/* Muestra los campos del formato que corresponda. Un asistente a una
   reunión no debería ver preguntas de sexo y nivel del cargo, porque
   el SGFT07 no las imprime; y al revés con cargo, teléfono y correo. */
function aplicarFormatoAlFormulario() {
  const esReunion = esFormatoReuniones();
  const ptft = document.getElementById("camposPTFT38");
  const sgft = document.getElementById("camposSGFT07");
  // Se deja vacío en vez de "block" para que mande la hoja de estilos,
  // donde el contenedor es flex y conserva la separación entre campos
  if (ptft) ptft.style.display = esReunion ? "none" : "";
  if (sgft) sgft.style.display = esReunion ? "" : "none";

  // El teléfono es solo dígitos
  const tel = document.getElementById("telefono");
  if (tel && !tel.dataset.conectado) {
    tel.dataset.conectado = "1";
    tel.addEventListener("input", () => {
      tel.value = tel.value.replace(/[^0-9]/g, "");
    });
  }

  // El cargo es solo letras, igual que el nombre. Se filtra al escribir
  // y al pegar, que es por donde se cuela la basura.
  const cargo = document.getElementById("cargo");
  if (cargo && !cargo.dataset.conectado) {
    cargo.dataset.conectado = "1";
    const SOLO_LETRAS = /[^a-zA-ZáéíóúÁÉÍÓÚüÜñÑ\s]/g;
    cargo.addEventListener("input", () => {
      const pos = cargo.selectionStart;
      const filtrado = cargo.value.replace(SOLO_LETRAS, "");
      const limpio = comoOracion(filtrado);
      if (limpio === cargo.value) return;
      cargo.value = limpio;
      // Si solo cambió el uso de mayúsculas el largo es el mismo y el
      // cursor no se mueve; si se quitó un carácter, retrocede uno
      const quitados = cargo.value.length === filtrado.length ? 0 : 1;
      cargo.setSelectionRange(pos - quitados, pos - quitados);
    });
    cargo.addEventListener("paste", (e) => {
      e.preventDefault();
      const texto = (e.clipboardData || window.clipboardData).getData("text");
      cargo.value = comoOracion(texto.replace(SOLO_LETRAS, "").slice(0, 60));
    });
  }
}

/* El campo de texto solo se muestra al marcar "Otro". Al cambiar a
   Masculino o Femenino se limpia, para no guardar un texto que ya no
   corresponde a lo marcado. */
function conectarSexoOtro() {
  const wrap = document.getElementById("sexoOtroWrap");
  const detalle = document.getElementById("sexoDetalle");
  if (!wrap || !detalle) return;

  document.querySelectorAll('input[name="sexo"]').forEach((radio) => {
    radio.addEventListener("change", () => {
      const esOtro = radio.value === "Otro" && radio.checked;
      wrap.style.display = esOtro ? "block" : "none";
      if (esOtro) detalle.focus();
      else detalle.value = "";
    });
  });

  // Solo letras: aquí se describe una identidad, no se anotan cifras.
  // No se pasa a mayúsculas como el nombre, porque este texto no va al
  // formato oficial y es la persona quien decide cómo escribirlo.
  const SOLO_LETRAS = /[^a-zA-ZáéíóúÁÉÍÓÚüÜñÑ\s]/g;

  detalle.addEventListener("input", () => {
    const pos = detalle.selectionStart;
    const limpio = detalle.value.replace(SOLO_LETRAS, "");
    if (limpio === detalle.value) return; // nada que corregir
    detalle.value = limpio;
    detalle.setSelectionRange(pos - 1, pos - 1);
  });

  detalle.addEventListener("paste", (e) => {
    e.preventDefault();
    const texto = (e.clipboardData || window.clipboardData).getData("text");
    detalle.value = texto.replace(SOLO_LETRAS, "").slice(0, 40);
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  llenarDependencias();
  conectarSexoOtro();
  const evId = new URLSearchParams(window.location.search).get("ev");

  // Sin parámetro ev en la URL → enlace inválido
  if (!evId) {
    mostrarSinEvento();
    return;
  }

  try {
    const evDoc = await getDoc(doc(db, "eventos", evId));

    if (!evDoc.exists()) {
      mostrarSinEvento();
      return;
    }

    eventoActivo = { id: evDoc.id, ...evDoc.data() };

    // Si el administrador cerró el evento, no se permite registrar
    if (eventoActivo.cerrado) {
      mostrarEventoCerrado(eventoActivo);
      return;
    }

    mostrarFormulario(eventoActivo);
    iniciarCanvas(); // ← canvas se inicia DESPUÉS de mostrar el formulario
    iniciarInputs(); // ← restricciones de teclado
  } catch (err) {
    console.error("Error cargando evento:", err);
    mostrarSinEvento();
  }
});

/* ══════════════════════════════════════════
   MOSTRAR / OCULTAR PANELES
══════════════════════════════════════════ */
function mostrarSinEvento() {
  document.getElementById("cargando").style.display = "none";
  document.getElementById("sinEvento").style.display = "flex";
  document.getElementById("cardFormulario").style.display = "none";
}

function mostrarEventoCerrado(ev) {
  // Reutilizamos el panel "sin evento" pero con mensaje de evento cerrado
  const panel = document.getElementById("sinEvento");
  panel.querySelector(".card").innerHTML = `
    <div style="font-size: 48px; margin-bottom: 14px">🔒</div>
    <h2 class="sin-ev-titulo">Evento cerrado</h2>
    <p class="sin-ev-sub">
      El registro de asistencia para<br />
      <strong>${ev.nombre}</strong><br />
      ya fue cerrado por el administrador.<br /><br />
      Si considera que es un error, comuníquese con la
      <strong>Delegación Departamental Caquetá</strong>.
    </p>`;
  document.getElementById("cargando").style.display = "none";
  document.getElementById("cardFormulario").style.display = "none";
  panel.style.display = "flex";
}

function mostrarFormulario(ev) {
  document.getElementById("cargando").style.display = "none";
  document.getElementById("sinEvento").style.display = "none";
  document.getElementById("cardFormulario").style.display = "flex";

  document.getElementById("evNombre").textContent = ev.nombre;
  document.getElementById("evMeta").textContent = [
    ev.fecha,
    ev.horario || ev.jornada,
    ev.institucion,
  ]
    .filter(Boolean)
    .join(" · ");

  // Hasta aquí no se sabía en qué formato se lleva el evento, y de eso
  // dependen los campos que hay que mostrar
  aplicarFormatoAlFormulario();
}

/* ══════════════════════════════════════════
   RESTRICCIONES DE INPUTS
══════════════════════════════════════════ */
function iniciarInputs() {
  // ── CÉDULA: solo números, sin pegar letras ──
  const elCedula = document.getElementById("cedula");

  elCedula.addEventListener("keypress", (e) => {
    // Permitir solo dígitos 0-9
    if (
      !/[0-9]/.test(e.key) &&
      !["Backspace", "Delete", "ArrowLeft", "ArrowRight", "Tab"].includes(e.key)
    ) {
      e.preventDefault();
    }
  });

  elCedula.addEventListener("input", () => {
    // Eliminar cualquier carácter que no sea número (por si pegan con ctrl+v)
    elCedula.value = elCedula.value.replace(/[^0-9]/g, "");
  });

  elCedula.addEventListener("paste", (e) => {
    e.preventDefault();
    const texto = (e.clipboardData || window.clipboardData).getData("text");
    elCedula.value = texto.replace(/[^0-9]/g, "").slice(0, 12);
  });

  // ── NOMBRE: solo letras y espacios, con mayúscula inicial ──
  const elNombre = document.getElementById("nombre");

  elNombre.addEventListener("keypress", (e) => {
    // Permitir letras (incluyendo tildes y ñ), espacios
    if (
      !/[a-zA-ZáéíóúÁÉÍÓÚüÜñÑ\s]/.test(e.key) &&
      !["Backspace", "Delete", "ArrowLeft", "ArrowRight", "Tab"].includes(e.key)
    ) {
      e.preventDefault();
    }
  });

  elNombre.addEventListener("input", () => {
    const pos = elNombre.selectionStart;
    // Quitar lo que no sean letras y dejarlo como nombre propio
    elNombre.value = comoNombrePropio(
      elNombre.value.replace(/[^a-zA-ZáéíóúÁÉÍÓÚüÜñÑ\s]/g, ""),
    );
    // Restaurar posición del cursor
    elNombre.setSelectionRange(pos, pos);
  });

  elNombre.addEventListener("paste", (e) => {
    e.preventDefault();
    const texto = (e.clipboardData || window.clipboardData).getData("text");
    elNombre.value = comoNombrePropio(
      texto.replace(/[^a-zA-ZáéíóúÁÉÍÓÚüÜñÑ\s]/g, ""),
    );
  });
}

/* ══════════════════════════════════════════
   CANVAS FIRMA — se inicia solo cuando
   el formulario ya es visible en el DOM
══════════════════════════════════════════ */
function iniciarCanvas() {
  canvas = document.getElementById("sigCanvas");
  ctx = canvas.getContext("2d");
  hint = document.getElementById("canvasHint");
  wrap = document.getElementById("canvasWrap");

  ctx.strokeStyle = "#0d2c6e";
  ctx.lineWidth = 2.2;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  function pt(e) {
    const r = canvas.getBoundingClientRect();
    const sx = canvas.width / r.width;
    const sy = canvas.height / r.height;
    if (e.touches)
      return {
        x: (e.touches[0].clientX - r.left) * sx,
        y: (e.touches[0].clientY - r.top) * sy,
      };
    return { x: (e.clientX - r.left) * sx, y: (e.clientY - r.top) * sy };
  }

  canvas.addEventListener("mousedown", (e) => {
    drawing = true;
    const p = pt(e);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    wrap.classList.add("active");
  });
  canvas.addEventListener("mousemove", (e) => {
    if (!drawing) return;
    const p = pt(e);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    hasSig = true;
    hint.style.opacity = "0";
  });
  canvas.addEventListener("mouseup", () => (drawing = false));
  canvas.addEventListener("mouseleave", () => (drawing = false));
  canvas.addEventListener(
    "touchstart",
    (e) => {
      e.preventDefault();
      drawing = true;
      const p = pt(e);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      wrap.classList.add("active");
    },
    { passive: false },
  );
  canvas.addEventListener(
    "touchmove",
    (e) => {
      e.preventDefault();
      if (!drawing) return;
      const p = pt(e);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
      hasSig = true;
      hint.style.opacity = "0";
    },
    { passive: false },
  );
  canvas.addEventListener("touchend", () => (drawing = false));
}

/* ══════════════════════════════════════════
   BORRAR FIRMA
══════════════════════════════════════════ */
window.clearSig = function () {
  if (!canvas) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  hasSig = false;
  hint.style.opacity = "1";
  wrap.classList.remove("active");
};

/* ══════════════════════════════════════════
   ENVIAR REGISTRO → Firestore
══════════════════════════════════════════ */
window.enviar = async function () {
  if (!eventoActivo) return;

  // Validaciones
  let ok = true;
  ["cedula", "nombre"].forEach((id) => {
    const el = document.getElementById(id);
    if (!el.value.trim()) {
      el.classList.add("err");
      ok = false;
    } else el.classList.remove("err");
  });

  const dep = document.getElementById("dependencia");
  if (!dep.value) {
    dep.classList.add("err");
    ok = false;
  } else dep.classList.remove("err");

  // Cada formato exige lo suyo: pedir sexo en una reunión, o correo en
  // una capacitación, sería pedir un dato que ese formato no imprime
  if (esFormatoReuniones()) {
    ["cargo", "telefono", "correo"].forEach((id) => {
      const el = document.getElementById(id);
      if (!el.value.trim()) {
        el.classList.add("err");
        ok = false;
      } else el.classList.remove("err");
    });
    const correo = document.getElementById("correo");
    if (correo.value.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo.value.trim())) {
      correo.classList.add("err");
      alert("El correo electrónico no tiene un formato válido.");
      ok = false;
    }
  } else {
    if (!document.querySelector('input[name="sexo"]:checked')) {
      alert("Seleccione el sexo.");
      ok = false;
    }
    if (!document.querySelector('input[name="nivel"]:checked')) {
      alert("Seleccione el nivel del cargo.");
      ok = false;
    }
  }
  if (!hasSig) {
    alert("Por favor dibuje su firma en el recuadro.");
    ok = false;
  }
  if (!ok) return;

  const btn = document.getElementById("btnEnviar");
  btn.classList.add("loading");

  // Verificar que el evento siga abierto (pudo cerrarse mientras
  // el participante tenía el formulario abierto en pantalla)
  try {
    const evFresco = await getDoc(doc(db, "eventos", eventoActivo.id));
    if (evFresco.exists() && evFresco.data().cerrado) {
      btn.classList.remove("loading");
      mostrarEventoCerrado(eventoActivo);
      return;
    }
  } catch (err) {
    console.error("Error verificando estado del evento:", err);
  }

  // Verificar que la cédula no esté ya registrada en este evento
  try {
    const cedulaVal = document.getElementById("cedula").value.trim();
    const duplicado = await getDocs(
      query(
        collection(db, `eventos/${eventoActivo.id}/registros`),
        where("cedula", "==", cedulaVal)
      )
    );
    if (!duplicado.empty) {
      alert(`⚠️ La cédula ${cedulaVal} ya está registrada en este evento.`);
      btn.classList.remove("loading");
      return;
    }
  } catch (err) {
    console.error("Error verificando cédula duplicada:", err);
  }

  const sexoMarcado =
    document.querySelector('input[name="sexo"]:checked')?.value || "";
  const nivelMarcado =
    document.querySelector('input[name="nivel"]:checked')?.value || "";

  const registro = {
    eventoId: eventoActivo.id,
    eventoNombre: eventoActivo.nombre,
    eventoFecha: eventoActivo.fecha,
    cedula: document.getElementById("cedula").value.trim(),
    nombre: document.getElementById("nombre").value.trim(),
    dependencia: dep.value,
    sexo: sexoMarcado,
    // Solo se guarda cuando marcaron "Otro": si alguien escribió algo y
    // luego cambió de opción, ese texto no debe quedar colgado
    sexoDetalle:
      sexoMarcado === "Otro"
        ? document.getElementById("sexoDetalle").value.trim()
        : "",
    nivel: nivelMarcado,
    // Propios del SGFT07; en un evento de PTFT38 quedan vacíos
    cargo: document.getElementById("cargo").value.trim(),
    telefono: document.getElementById("telefono").value.trim(),
    correo: document.getElementById("correo").value.trim(),
    firma: canvas.toDataURL("image/png"),
    creadoEn: Timestamp.now(),
  };

  try {
    await addDoc(
      collection(db, `eventos/${eventoActivo.id}/registros`),
      registro,
    );

    document.getElementById("sNombre").textContent = registro.nombre;
    document.getElementById("sDep").textContent = registro.dependencia;
    document.getElementById("sEv").textContent =
      "📋 " + registro.eventoNombre + " · " + registro.eventoFecha;
    document.getElementById("formBody").classList.add("hide");
    document.getElementById("successPanel").classList.add("show");

    // Scroll suave al inicio para que el éxito quede centrado
    setTimeout(() => window.scrollTo({ top: 0, behavior: "smooth" }), 100);
  } catch (err) {
    console.error("Error guardando registro:", err);
    alert("Error al guardar. Verifique su conexión e intente de nuevo.");
  } finally {
    btn.classList.remove("loading");
  }
};

/* ══════════════════════════════════════════
   RESET FORMULARIO
══════════════════════════════════════════ */
window.resetForm = function () {
  document.getElementById("cedula").value = "";
  document.getElementById("nombre").value = "";
  document.getElementById("dependencia").value = "";
  document
    .querySelectorAll("input[type=radio]")
    .forEach((r) => (r.checked = false));
  window.clearSig();
  document.getElementById("formBody").classList.remove("hide");
  document.getElementById("successPanel").classList.remove("show");
};
