/* ============================================================
   usuarios.js — Solicitud unificada de usuarios de sistemas
   (Correo, ANI, Web Service, GED ID/RC, SIRC, HLED).
   Guarda en la coleccion 'solicitudes_usuarios'.
   ============================================================ */
import { db } from "./firebase-config.js";
import {
  collection,
  addDoc,
  Timestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

console.log("usuarios.js conectado con Firebase");

const SISTEMAS = ["correo", "ani", "webservice", "gedid", "gedrc", "sirc", "hled"];
const NOMBRES_SISTEMA = {
  correo: "Correo Institucional",
  ani: "ANI",
  webservice: "Web Service",
  gedid: "GED ID",
  gedrc: "GED RC",
  sirc: "SIRC",
  hled: "HLED",
};

let canvas, ctx, hint, wrap;
let drawing = false;
let hasSig = false;

/* ══════════ INIT ══════════ */
document.addEventListener("DOMContentLoaded", () => {
  iniciarCanvas();
  iniciarInputs();

  // El campo "usuario actual" solo aplica cuando la cuenta ya existe
  document.querySelectorAll('input[name="tipoSolicitud"]').forEach((r) => {
    r.addEventListener("change", () => {
      const yaExiste = ["Actualización", "Actualización de datos",
                        "Cambio de Responsable", "Bloqueo", "Eliminación"]
        .includes(r.value);
      document.getElementById("campoUsuario").style.display = yaExiste ? "flex" : "none";
    });
  });

  // Mostrar/ocultar el detalle de cada sistema al marcarlo
  SISTEMAS.forEach((sis) => {
    const chk = document.getElementById("sis_" + (sis === "webservice" ? "ws" : sis));
    const det = document.getElementById("det_" + sis);
    if (!chk) return;
    chk.addEventListener("change", () => {
      if (det) det.style.display = chk.checked ? "flex" : "none";
      aplicarExclusionCorreo(chk);
      actualizarTipoSolicitud();
    });
  });

  // Oficina → ciudad automatica y bloqueada
  const selOficina = document.getElementById("oficina");
  const inCiudad = document.getElementById("ciudad");
  selOficina.addEventListener("change", () => {
    const of = selOficina.value;
    if (!of) { inCiudad.value = ""; return; }
    const m = of.match(/^Registraduría Municipal de (.+)$/);
    inCiudad.value = m ? m[1] : "Florencia";
    inCiudad.classList.remove("err");
  });

  // Vigencia: desde = hoy (fijo), hasta >= hoy
  const hoy = new Date().toISOString().split("T")[0];
  const vigDesde = document.getElementById("vigDesde");
  vigDesde.value = hoy;
  document.getElementById("vigHasta").min = hoy;

  // Los números del asistente sirven para saltar de paso sin tener
  // que devolverse uno por uno
  [1, 2, 3].forEach((n) => {
    const dot = document.getElementById("dot" + n);
    if (!dot) return;
    dot.addEventListener("click", () => window.irPaso(n));
  });
});

/* ══════════ CORREO APARTE DE LOS DEMÁS SISTEMAS ══════════
   El Correo se tramita con el formato GIFT05, de otro proceso
   institucional, que pide datos y opciones distintas. Por eso no
   puede ir en la misma solicitud que los sistemas CDFT. */
function casillaDe(sis) {
  return document.getElementById("sis_" + (sis === "webservice" ? "ws" : sis));
}

function aplicarExclusionCorreo(cambiada) {
  const correo = casillaDe("correo");
  const otros = SISTEMAS.filter((s) => s !== "correo").map(casillaDe);

  // Al marcar Correo se bloquean los demás, y viceversa
  const hayOtros = otros.some((c) => c?.checked);
  const bloquearOtros = correo.checked;
  const bloquearCorreo = hayOtros;

  otros.forEach((c) => {
    if (!c) return;
    c.disabled = bloquearOtros;
    c.closest(".sistema-card")?.classList.toggle("bloqueada", bloquearOtros);
  });
  correo.disabled = bloquearCorreo;
  correo.closest(".sistema-card")?.classList.toggle("bloqueada", bloquearCorreo);

  if (cambiada?.checked && (bloquearOtros || bloquearCorreo)) {
    const aviso = document.getElementById("avisoExclusion");
    if (aviso) {
      aviso.textContent = correo.checked
        ? "El Correo Institucional va en una solicitud aparte: los demás sistemas quedaron deshabilitados."
        : "El Correo Institucional se solicita por separado, por eso quedó deshabilitado.";
      aviso.classList.add("show");
    }
  } else {
    document.getElementById("avisoExclusion")?.classList.remove("show");
  }
}

/* Muestra las opciones de solicitud que pide el formato elegido:
   los CDFT solo manejan Creación/Actualización, mientras el GIFT05
   de Correo tiene cinco. */
function actualizarTipoSolicitud() {
  const esCorreo = casillaDe("correo").checked;
  const hayAlguno = SISTEMAS.some((s) => casillaDe(s)?.checked);
  const bloque = document.getElementById("bloqueTipoSolicitud");
  bloque.style.display = hayAlguno ? "block" : "none";
  if (!hayAlguno) return;

  const grupo = esCorreo ? "correo" : "cdft";
  document.querySelectorAll("#pillsTipoSolicitud .pill").forEach((pill) => {
    const visible = pill.dataset.solo === grupo;
    pill.style.display = visible ? "" : "none";
    const radio = pill.querySelector("input");
    if (!visible && radio.checked) {
      radio.checked = false;
      document.getElementById("campoUsuario").style.display = "none";
    }
  });
  document.getElementById("notaTipoSolicitud").textContent = esCorreo
    ? "Opciones del formato GIFT05 de Correo Institucional."
    : "Opciones de los formatos CDFT de los sistemas seleccionados.";
}

/* ══════════ ASISTENTE POR PASOS ══════════ */
let pasoActual = 1;

function validarPaso1() {
  let ok = true;
  // El tipo de solicitud se pide en el paso 2, junto con el sistema
  const campos = ["nombres", "apellidos", "cedula", "telefono", "correo", "oficina", "ciudad", "vigHasta"];
  campos.forEach((id) => {
    const el = document.getElementById(id);
    if (!el.value.trim()) { el.classList.add("err"); ok = false; }
    else el.classList.remove("err");
  });
  const tel = document.getElementById("telefono");
  if (tel.value.trim() && tel.value.trim().length !== 10) {
    tel.classList.add("err");
    alert("El teléfono debe tener exactamente 10 dígitos.");
    return false;
  }
  if (!document.querySelector('input[name="cargo"]:checked')) {
    alert("Seleccione su cargo."); return false;
  }
  if (!document.querySelector('input[name="vinculacion"]:checked')) {
    alert("Seleccione el tipo de vinculación."); return false;
  }
  const hoyISO = new Date().toISOString().split("T")[0];
  const hasta = document.getElementById("vigHasta").value;
  if (hasta && hasta < hoyISO) {
    alert("La vigencia 'Hasta' no puede ser anterior a hoy."); return false;
  }
  if (!ok) alert("Complete los campos marcados en rojo.");
  return ok;
}

function validarPaso2() {
  const marcados = SISTEMAS.filter((sis) => {
    const chk = document.getElementById("sis_" + (sis === "webservice" ? "ws" : sis));
    return chk?.checked;
  });
  if (!marcados.length) {
    alert("Marque al menos un sistema.");
    return false;
  }
  // El tipo de solicitud se elige aqui porque depende del formato
  const tipo = document.querySelector('input[name="tipoSolicitud"]:checked');
  if (!tipo) {
    alert("Seleccione el tipo de solicitud.");
    return false;
  }
  const usuario = document.getElementById("nombreUsuario");
  if (document.getElementById("campoUsuario").style.display !== "none" &&
      !usuario.value.trim()) {
    usuario.classList.add("err");
    alert("Indique el nombre de usuario actual.");
    return false;
  }
  usuario.classList.remove("err");

  if (marcados.includes("gedid") && !document.querySelector('input[name="gedidAcceso"]:checked')) {
    alert("Seleccione el tipo de acceso para GED ID."); return false;
  }
  if (marcados.includes("gedrc") && !document.querySelector('input[name="gedrcAcceso"]:checked')) {
    alert("Seleccione el tipo de acceso para GED RC."); return false;
  }
  for (const sis of ["ani", "webservice", "sirc"]) {
    if (marcados.includes(sis) &&
        !document.querySelectorAll(`input[data-sis="${sis}"]:checked`).length) {
      alert(`Marque al menos una opción en el detalle de ${NOMBRES_SISTEMA[sis]}.`);
      return false;
    }
  }
  // Si se seleccionó ANI, la IP es obligatoria y debe ser válida
  const ip = document.getElementById("aniIp");
  const ipError = document.getElementById("aniIpError");
  if (marcados.includes("ani")) {
    if (!ip.value.trim() || !esIPValida(ip.value.trim())) {
      ip.classList.add("err");
      if (ipError) { ipError.textContent = "La dirección IP es obligatoria para ANI y debe tener formato válido. Ej: 172.27.20.30"; ipError.classList.add("show"); }
      return false;
    }
  }
  if (ip) ip.classList.remove("err");
  if (ipError) { ipError.textContent = ""; ipError.classList.remove("show"); }
  return true;
}

/* ── Cargos que pueden autorizar segun cada formato oficial ── */
const CARGOS_PERMITIDOS = {
  correo:     ["Delegado Departamental", "Registrador Distrital", "Directivo", "Coordinador de Área"],
  ani:        ["Delegado Departamental", "Registrador Distrital", "Directivo", "Coordinador de Área"],
  webservice: ["Delegado Departamental", "Registrador Distrital", "Directivo", "Coordinador de Área"],
  gedid:      ["Delegado Departamental", "Registrador Distrital", "Directivo", "Coordinador de Área"],
  gedrc:      ["Delegado Departamental", "Registrador Distrital", "Directivo", "Coordinador de Área"],
  sirc:       ["Delegado Departamental", "Registrador Distrital", "Formador"],
  hled:       ["Delegado Departamental", "Registrador Distrital"],
};

/* Jefe inmediato segun la oficina donde trabaja el funcionario.
   El formato de Correo (GIFT05) no trae lista de cargos: pide el jefe
   inmediato, que depende de la oficina. */
function jefeInmediatoDe(oficina) {
  const of = oficina || "";
  if (of.startsWith("Delegación")) {
    return { cargo: "Delegado Departamental", dependencia: of };
  }
  if (of.startsWith("Registraduría Especial")) {
    return { cargo: "Registrador Especial", dependencia: of };
  }
  if (of.startsWith("Registraduría Municipal")) {
    return { cargo: "Registrador Municipal", dependencia: of };
  }
  return { cargo: "", dependencia: of };
}

/* Ajusta el paso 3 al formato elegido: el de Correo pide jefe
   inmediato (deducido de la oficina) y no exige justificacion. */
function actualizarPaso3SegunSistema() {
  const esCorreo = casillaDe("correo").checked;
  const oficina = document.getElementById("oficina").value;
  const jefe = jefeInmediatoDe(oficina);

  // Cargo: lista de opciones (CDFT) o texto deducido (Correo)
  document.getElementById("campoAutCargoLista").style.display = esCorreo ? "none" : "flex";
  document.getElementById("campoAutCargoTexto").style.display = esCorreo ? "block" : "none";
  if (esCorreo) {
    document.getElementById("autCargoTexto").value = jefe.cargo;
    // La dependencia del jefe es la misma oficina del funcionario
    document.getElementById("autDependencia").value = jefe.dependencia;
    document.getElementById("tituloAutoriza").textContent =
      "3 · Autorización del jefe inmediato";
    //document.getElementById("notaFirmaAutoriza").innerHTML =
      //"ℹ️ La firma del jefe inmediato se estampa a mano sobre el formato impreso.";
  } else {
    document.getElementById("autDependencia").value =
      "DELEGACIÓN DEPARTAMENTAL DEL CAQUETÁ";
    document.getElementById("tituloAutoriza").textContent =
      "3 · Datos de quien autoriza";
    //document.getElementById("notaFirmaAutoriza").innerHTML =
     // "ℹ️ La firma de quien autoriza se estampa a mano sobre cada formato impreso.";
  }

  // El formato de Correo no incluye justificación de acceso
  document.getElementById("bloqueJustificacion").style.display = esCorreo ? "none" : "block";
  document.getElementById("sepJustificacion").style.display = esCorreo ? "none" : "block";
}

// Muestra solo los cargos permitidos por TODOS los sistemas marcados
// (una sola persona firma todos los formatos de la solicitud)
function actualizarCargosAutoriza() {
  const marcados = SISTEMAS.filter((sis) => {
    const chk = document.getElementById("sis_" + (sis === "webservice" ? "ws" : sis));
    return chk?.checked;
  });

  // Interseccion de los permitidos de cada sistema marcado
  let permitidos = ["Delegado Departamental", "Registrador Distrital", "Formador", "Directivo", "Coordinador de Área"];
  marcados.forEach((sis) => {
    permitidos = permitidos.filter((c) => CARGOS_PERMITIDOS[sis].includes(c));
  });

  document.querySelectorAll("#pillsAutCargo .pill").forEach((pill) => {
    const radio = pill.querySelector("input");
    const ok = permitidos.includes(radio.value);
    pill.style.display = ok ? "" : "none";
    if (!ok && radio.checked) radio.checked = false; // desmarcar si quedo prohibido
  });

  const nota = document.getElementById("notaAutCargo");
  if (marcados.length) {
    nota.textContent =
      `Según los formatos de los sistemas seleccionados, pueden autorizar: ${permitidos.join(", ")}.`;
  } else {
    nota.textContent = "";
  }
}

window.irPaso = function (destino) {
  // Validar solo al avanzar (atras siempre se permite)
  if (destino > pasoActual) {
    if (pasoActual === 1 && !validarPaso1()) return;
    if (pasoActual === 2 && !validarPaso2()) return;
  }
  pasoActual = destino;

  // Al entrar al paso 3, ajustarlo al formato elegido en el paso 2
  if (destino === 3) {
    actualizarPaso3SegunSistema();
    actualizarCargosAutoriza();
  }

  for (let p = 1; p <= 3; p++) {
    document.getElementById("paso" + p).classList.toggle("activo", p === destino);
    const dot = document.getElementById("dot" + p);
    dot.classList.toggle("activo", p === destino);
    dot.classList.toggle("completo", p < destino);
  }
  document.getElementById("linea1").classList.toggle("completo", destino > 1);
  document.getElementById("linea2").classList.toggle("completo", destino > 2);

  document.getElementById("cardFormulario")
    .scrollIntoView({ behavior: "smooth", block: "start" });
};

/* Codigo secreto del enlace de autorizacion: sin el, nadie puede
   abrir la solicitud para firmarla aunque conozca su identificador. */
function crearToken() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/* ══════════ RESTRICCIONES ══════════ */
function soloNumeros(el) {
  el.addEventListener("input", () => (el.value = el.value.replace(/[^0-9]/g, "")));
}
function mayusculas(el, soloLetras) {
  el.addEventListener("input", () => {
    const pos = el.selectionStart;
    el.value = (soloLetras
      ? el.value.replace(/[^a-zA-ZáéíóúÁÉÍÓÚüÜñÑ\s]/g, "")
      : el.value
    ).toUpperCase();
    el.setSelectionRange(pos, pos);
  });
}
/* Direccion IP: solo digitos y puntos, con el punto puesto solo
   cada vez que se completa un grupo de tres cifras. */
function formatoIP(el) {
  el.addEventListener("input", () => {
    const alFinal = el.selectionStart === el.value.length;
    // Dejar solo numeros y puntos, sin puntos repetidos ni mas de 4 grupos
    let limpio = el.value.replace(/[^0-9.]/g, "").replace(/\.{2,}/g, ".");
    let grupos = limpio.split(".").slice(0, 4);
    grupos = grupos.map((g) => {
      g = g.slice(0, 3);
      // Un grupo no puede pasar de 255
      return g && Number(g) > 255 ? "255" : g;
    });
    limpio = grupos.join(".");
    // Al completar 3 cifras, saltar solo al siguiente grupo
    if (alFinal && grupos.length < 4 && /^\d{3}$/.test(grupos[grupos.length - 1])) {
      limpio += ".";
    }
    el.value = limpio;
  });
}

/* Valida que sean cuatro grupos de 0 a 255 */
function esIPValida(valor) {
  const partes = (valor || "").split(".");
  return (
    partes.length === 4 &&
    partes.every((p) => /^\d{1,3}$/.test(p) && Number(p) <= 255)
  );
}

function iniciarInputs() {
  ["cedula", "telefono", "correoResNum", "correoResAno"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) soloNumeros(el);
  });
  ["nombres", "apellidos", "autNombres", "autApellidos"].forEach((id) =>
    mayusculas(document.getElementById(id), true),
  );
  const ip = document.getElementById("aniIp");
  if (ip) formatoIP(ip);
  if (ip) {
    ip.addEventListener("input", () => {
      const ipError = document.getElementById("aniIpError");
      if (esIPValida(ip.value.trim())) {
        ip.classList.remove("err");
        if (ipError) { ipError.textContent = ""; ipError.classList.remove("show"); }
      }
    });
  }

  // Nombre de usuario: solo letras, en minusculas (asi se asignan
  // los usuarios institucionales, ej. ommojica)
  const usuario = document.getElementById("nombreUsuario");
  if (usuario) {
    usuario.addEventListener("input", () => {
      const pos = usuario.selectionStart;
      usuario.value = usuario.value
        .replace(/[^a-zA-ZáéíóúÁÉÍÓÚüÜñÑ]/g, "")
        .toLowerCase()
        .slice(0, 15);
      usuario.setSelectionRange(pos, pos);
    });
  }
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

  function pt(e) {
    const r = canvas.getBoundingClientRect();
    const sx = canvas.width / r.width;
    const sy = canvas.height / r.height;
    if (e.touches)
      return { x: (e.touches[0].clientX - r.left) * sx, y: (e.touches[0].clientY - r.top) * sy };
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
  canvas.addEventListener("touchstart", (e) => {
    e.preventDefault();
    drawing = true;
    const p = pt(e);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    wrap.classList.add("active");
  }, { passive: false });
  canvas.addEventListener("touchmove", (e) => {
    e.preventDefault();
    if (!drawing) return;
    const p = pt(e);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    hasSig = true;
    hint.style.opacity = "0";
  }, { passive: false });
  canvas.addEventListener("touchend", () => (drawing = false));
}

window.clearSig = function () {
  if (!canvas) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  hasSig = false;
  hint.style.opacity = "1";
  wrap.classList.remove("active");
};

/* ══════════ ENVIAR ══════════ */
window.enviar = async function () {
  let ok = true;

  const tipoSol = document.querySelector('input[name="tipoSolicitud"]:checked');
  if (!tipoSol) { alert("Seleccione el tipo de solicitud (módulo 1)."); return; }

  const cargoSel = document.querySelector('input[name="cargo"]:checked');
  const vinc = document.querySelector('input[name="vinculacion"]:checked');
  const autCargo = document.querySelector('input[name="autCargo"]:checked');
  // El formato de Correo deduce el cargo del jefe y no pide justificación
  const esCorreo = casillaDe("correo").checked;

  const obligatorios = [
    "nombres", "apellidos", "cedula", "telefono", "correo",
    "oficina", "ciudad", "vigDesde", "vigHasta",
    "autNombres", "autApellidos",
  ];
  if (!esCorreo) obligatorios.push("justificacion");
  if (tipoSol.value !== "Creación") obligatorios.push("nombreUsuario");

  obligatorios.forEach((id) => {
    const el = document.getElementById(id);
    if (!el.value.trim()) { el.classList.add("err"); ok = false; }
    else el.classList.remove("err");
  });

  const tel = document.getElementById("telefono");
  if (tel.value.trim() && tel.value.trim().length !== 10) {
    tel.classList.add("err");
    alert("El teléfono debe tener exactamente 10 dígitos.");
    ok = false;
  }

  if (!cargoSel) { alert("Seleccione su cargo (paso 1)."); ok = false; }
  if (!vinc) { alert("Seleccione el tipo de vinculación (paso 1)."); ok = false; }
  if (!esCorreo && !autCargo) {
    alert("Seleccione el cargo de quien autoriza."); ok = false;
  }
  if (!hasSig) { alert("Por favor dibuje su firma en el recuadro."); ok = false; }

  // Sistemas marcados
  const marcados = SISTEMAS.filter((sis) => {
    const chk = document.getElementById("sis_" + (sis === "webservice" ? "ws" : sis));
    return chk?.checked;
  });
  if (!marcados.length) {
    alert("Marque al menos un sistema en el módulo 3.");
    ok = false;
  }

  // Detalles obligatorios por sistema
  if (marcados.includes("gedid") && !document.querySelector('input[name="gedidAcceso"]:checked')) {
    alert("Seleccione el tipo de acceso para GED ID."); ok = false;
  }
  if (marcados.includes("gedrc") && !document.querySelector('input[name="gedrcAcceso"]:checked')) {
    alert("Seleccione el tipo de acceso para GED RC."); ok = false;
  }
  ["ani", "webservice", "sirc"].forEach((sis) => {
    if (marcados.includes(sis)) {
      const algo = document.querySelectorAll(`input[data-sis="${sis}"]:checked`).length;
      if (!algo) {
        alert(`Marque al menos una opción en el detalle de ${NOMBRES_SISTEMA[sis]}.`);
        ok = false;
      }
    }
  });
  // Validación específica: si ANI está marcado, la IP es obligatoria
  const ip = document.getElementById("aniIp");
  const ipError = document.getElementById("aniIpError");
  if (marcados.includes("ani")) {
    if (!ip.value.trim() || !esIPValida(ip.value.trim())) {
      ip.classList.add("err");
      if (ipError) { ipError.textContent = "La dirección IP es obligatoria para ANI y debe tener formato válido. Ej: 172.27.20.30"; ipError.classList.add("show"); }
      ok = false;
    } else {
      ip.classList.remove("err");
      if (ipError) { ipError.textContent = ""; ipError.classList.remove("show"); }
    }
  }
  if (!ok) return;

  const hoyISO = new Date().toISOString().split("T")[0];
  if (document.getElementById("vigHasta").value < hoyISO) {
    alert("La vigencia 'Hasta' no puede ser anterior a la fecha de hoy.");
    return;
  }

  const btn = document.getElementById("btnEnviar");
  btn.classList.add("loading");

  const v = (id) => document.getElementById(id)?.value.trim() || "";
  const checks = (sel) =>
    Array.from(document.querySelectorAll(sel)).map((c) => c.value);

  // Detalle y estado inicial por sistema
  const sistemas = {};
  marcados.forEach((sis) => {
    const det = {};
    if (sis === "ani") {
      det.perfiles = checks('input[data-sis="ani"]:checked');
      det.datos = checks("input[data-ani-dato]:checked");
      det.ip = v("aniIp");
    }
    if (sis === "webservice") det.accesos = checks('input[data-sis="webservice"]:checked');
    if (sis === "sirc") det.accesos = checks('input[data-sis="sirc"]:checked');
    if (sis === "gedid") det.acceso = document.querySelector('input[name="gedidAcceso"]:checked')?.value || "";
    if (sis === "gedrc") det.acceso = document.querySelector('input[name="gedrcAcceso"]:checked')?.value || "";
    if (sis === "correo") {
      det.resNumero = v("correoResNum");
      det.resAno = v("correoResAno");
      det.buzon =
        document.querySelector('input[name="correoBuzon"]:checked')?.value || "Sí";
    }
    sistemas[sis] = {
      ...det,
      estado: "Pendiente",
      usuarioAsignado: "",
    };
  });

  const solicitud = {
    tipoSolicitud: tipoSol.value,
    nombreUsuario: tipoSol.value === "Actualización" ? v("nombreUsuario") : "",
    nombres: v("nombres"),
    apellidos: v("apellidos"),
    cedula: v("cedula"),
    telefono: v("telefono"),
    correo: v("correo").toLowerCase(),
    cargo: cargoSel.value,
    vinculacion: vinc.value,
    oficina: v("oficina"),
    departamento: v("departamento"),
    ciudad: v("ciudad"),
    vigenciaDesde: v("vigDesde"),
    vigenciaHasta: v("vigHasta"),
    autNombres: v("autNombres"),
    autApellidos: v("autApellidos"),
    // En Correo el cargo del jefe se deduce de la oficina; en los demás
    // formatos lo elige el funcionario de la lista
    autCargo: esCorreo ? v("autCargoTexto") : autCargo.value,
    autDependencia: v("autDependencia"),
    sistemasSolicitados: marcados,
    sistemas,
    justificacion: v("justificacion"),
    firma: canvas.toDataURL("image/png"),
    // Autorizacion por la web: el Delegado entra con este enlace y firma
    tokenAutorizacion: crearToken(),
    estadoAutorizacion: "Pendiente",
    firmaAutorizador: "",
    creadoEn: Timestamp.now(),
  };

  try {
    await addDoc(collection(db, "solicitudes_usuarios"), solicitud);
    document.getElementById("sNombre").textContent =
      `${solicitud.nombres} ${solicitud.apellidos}`;
    document.getElementById("sSistemas").textContent =
      "Sistemas: " + marcados.map((s) => NOMBRES_SISTEMA[s]).join(" · ");
    document.getElementById("formBody").classList.add("hide");
    document.getElementById("successPanel").classList.add("show");
    setTimeout(() => window.scrollTo({ top: 0, behavior: "smooth" }), 100);
  } catch (err) {
    console.error("Error guardando solicitud:", err);
    alert("Error al enviar. Verifique su conexión e intente de nuevo.");
  } finally {
    btn.classList.remove("loading");
  }
};

/* ══════════ RESET ══════════ */
window.resetForm = function () {
  document
    .querySelectorAll("#formBody input[type=text], #formBody input[type=email], #formBody input[type=date], #formBody textarea")
    .forEach((el) => { if (!el.readOnly) el.value = ""; });
  document.querySelectorAll("#formBody select").forEach((el) => (el.value = ""));
  document.getElementById("ciudad").value = "";
  document.querySelectorAll("#formBody input[type=radio], #formBody input[type=checkbox]")
    .forEach((el) => (el.checked = false));
  document.querySelectorAll(".sistema-detalle").forEach((d) => (d.style.display = "none"));
  document.getElementById("campoUsuario").style.display = "none";
  document.getElementById("bloqueTipoSolicitud").style.display = "none";
  // Volver a habilitar todos los sistemas
  document.querySelectorAll(".sistema-card").forEach((c) => {
    c.classList.remove("bloqueada");
    const chk = c.querySelector("input");
    if (chk) chk.disabled = false;
  });
  document.getElementById("avisoExclusion")?.classList.remove("show");
  document.getElementById("vigDesde").value = new Date().toISOString().split("T")[0];
  window.clearSig();
  document.getElementById("formBody").classList.remove("hide");
  document.getElementById("successPanel").classList.remove("show");
  window.irPaso(1); // volver al primer paso del asistente
};
