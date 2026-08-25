import { db, auth } from "./firebase-config.js";
import { pintarTablero } from "./tablero.js";
import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  updateDoc,
  doc,
  query,
  orderBy,
  onSnapshot,
  Timestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// Proteger el panel: si no hay sesión → login
onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.replace("/vistas/login.html");
  } else {
    // Nombre e iniciales fijos del administrador (definidos aquí);
    // el correo sí se toma de la sesión de Firebase
    const NOMBRE_ADMIN = "Oscar Zambrano";
    const set = (id, txt) => {
      const el = document.getElementById(id);
      if (el) el.textContent = txt;
    };
    set("userName", NOMBRE_ADMIN);
    set("userFullName", NOMBRE_ADMIN);
    set("userEmail", user.email || "");
  }
});

// Menú de usuario: abrir/cerrar al hacer clic
window.toggleUserMenu = function (e) {
  e.stopPropagation();
  document.getElementById("userMenu").classList.toggle("open");
};

// Cerrar el menú si se hace clic en cualquier otra parte de la página
document.addEventListener("click", () => {
  document.getElementById("userMenu")?.classList.remove("open");
});

// Cerrar sesión
window.cerrarSesion = async function () {
  await signOut(auth);
  window.location.replace("/vistas/login.html");
};

// exportar.js se carga de forma dinamica cuando se necesita
let exportarPTFT38 = null;
async function cargarExportar() {
  if (exportarPTFT38) return true;
  try {
    const mod = await import("./exportar.js");
    exportarPTFT38 = mod.exportarPTFT38;
    return true;
  } catch (e) {
    console.warn("exportar.js no disponible:", e.message);
    return false;
  }
}

console.log("admin.js conectado con Firebase");

/* ══════════════════════════════════════════
   CONSTANTES
══════════════════════════════════════════ */
const COL_EVENTOS = "eventos";
const COL_REGS = (evId) => `eventos/${evId}/registros`;

const TEMPLATE_URL = "/PTFT38.xlsx";
const URL_ASISTENCIA = "/vistas/asistencia.html";

// ── Detectar si estamos en el servidor local Python ──────────
const ES_SERVIDOR_LOCAL =
  window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1";

/* ── Función de exportación: usa servidor Python si está local,
      SheetJS si está en hosting ─────────────────────────────── */
async function exportar(eventoId, nombreBoton) {
  const btn = document.getElementById(nombreBoton);
  if (btn) {
    btn.disabled = true;
    btn.textContent = "⏳ Generando Excel…";
  }

  try {
    if (ES_SERVIDOR_LOCAL) {
      // En servidor local → Python genera el Excel con firmas
      // ── Servidor local Python → Excel con firmas reales ──
      const url = `/api/exportar?eventoId=${eventoId}`;
      const resp = await fetch(url);

      if (!resp.ok) {
        const err = await resp.json();
        throw new Error(err.error || "Error del servidor");
      }

      // Descargar el archivo que devuelve el servidor
      const blob = await resp.blob();
      const urlBlob = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = urlBlob;
      a.download =
        resp.headers
          .get("Content-Disposition")
          ?.split("filename=")[1]
          ?.replace(/"/g, "") || "PTFT38.xlsx";
      a.click();
      URL.revokeObjectURL(urlBlob);
    } else {
      // ── Firebase Hosting → SheetJS ──
      await cargarExportar();
      if (exportarPTFT38) {
        await exportarPTFT38(
          window._evActual,
          window._regActuales,
          TEMPLATE_URL,
        );
      } else {
        alert("Módulo de exportación no disponible.");
      }
    }
  } catch (err) {
    console.error("Error exportando:", err);
    alert(`Error al generar el Excel:\n${err.message}`);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = "📥 Exportar este evento";
    }
  }
}

/* ══════════════════════════════════════════
   TABS
══════════════════════════════════════════ */
window.tab = function (name) {
  ["Eventos", "Registros", "Estadisticas", "Exportar"].forEach((n) => {
    const panel = document.getElementById("panel" + n);
    const tabEl = document.getElementById("tab-" + n.toLowerCase());
    if (panel) panel.style.display = "none";
    if (tabEl) tabEl.classList.remove("active");
  });
  const show = document.getElementById(
    "panel" + name.charAt(0).toUpperCase() + name.slice(1),
  );
  const active = document.getElementById("tab-" + name);
  if (show) show.style.display = "block";
  if (active) active.classList.add("active");

  if (name === "eventos") renderEventos();
  if (name === "registros") renderRegistrosPanel();
  if (name === "estadisticas") renderEstadisticas();
  if (name === "exportar") renderExportar();
};

/* ══════════════════════════════════════════
   GENERAR ENLACE
══════════════════════════════════════════ */
function generarLink(evId) {
  try {
    const url = new URL(URL_ASISTENCIA, window.location.href);
    url.searchParams.set("ev", evId);
    return url.toString();
  } catch (e) {
    return URL_ASISTENCIA + "?ev=" + evId;
  }
}

/* ══════════════════════════════════════════
   CREAR EVENTO
══════════════════════════════════════════ */
window.crearEvento = async function () {
  const nombre = document.getElementById("evNombre").value.trim();
  if (!nombre) {
    document.getElementById("evNombre").classList.add("err");
    return;
  }
  document.getElementById("evNombre").classList.remove("err");

  const fechaRaw = document.getElementById("evFecha").value;
  const fecha = fechaRaw
    ? new Date(fechaRaw + "T12:00:00").toLocaleDateString("es-CO")
    : new Date().toLocaleDateString("es-CO");

  const btn = document.getElementById("btnCrearEvento");
  btn.disabled = true;
  btn.textContent = "Creando…";

  try {
    const docRef = await addDoc(collection(db, COL_EVENTOS), {
      nombre,
      fecha,
      jornada: document.getElementById("evJornada").value,
      institucion: document.getElementById("evInstitucion").value.trim(),
      creadoEn: Timestamp.now(),
    });

    console.log("Evento creado con ID:", docRef.id);

    // Limpiar campos
    ["evNombre", "evInstitucion"].forEach(
      (id) => (document.getElementById(id).value = ""),
    );
    document.getElementById("evFecha").valueAsDate = new Date();
    document.getElementById("evJornada").value = "";

    renderEventos();
  } catch (err) {
    console.error("Error creando evento:", err);
    alert("Error al crear el evento. Revise la consola.");
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Crear evento y generar enlace`;
  }
};

/* ══════════════════════════════════════════
   ELIMINAR EVENTO
══════════════════════════════════════════ */
window.eliminarEvento = async function (evId) {
  // Contar registros
  const regsSnap = await getDocs(collection(db, COL_REGS(evId)));
  const n = regsSnap.size;
  const msg =
    n > 0
      ? `¿Eliminar este evento? Tiene ${n} registro(s) que también se borrarán.`
      : "¿Eliminar este evento?";
  if (!confirm(msg)) return;

  try {
    // Borrar registros primero
    for (const r of regsSnap.docs) {
      await deleteDoc(doc(db, COL_REGS(evId), r.id));
    }
    // Borrar evento
    await deleteDoc(doc(db, COL_EVENTOS, evId));
    renderEventos();
  } catch (err) {
    console.error("Error eliminando evento:", err);
    alert("Error al eliminar. Revise la consola.");
  }
};

/* ══════════════════════════════════════════
   CERRAR / REABRIR EVENTO
══════════════════════════════════════════ */
window.toggleCerrarEvento = async function (evId, cerrado) {
  const msg = cerrado
    ? "¿Reabrir este evento? Los participantes podrán volver a registrarse."
    : "¿Cerrar este evento? Nadie más podrá registrar asistencia (el enlace y el QR dejarán de aceptar registros).";
  if (!confirm(msg)) return;

  try {
    // Solo cambiamos una "banderita" en el evento: cerrado = true/false
    await updateDoc(doc(db, COL_EVENTOS, evId), { cerrado: !cerrado });
    renderEventos();
  } catch (err) {
    console.error("Error cambiando estado del evento:", err);
    alert("Error al cambiar el estado. Revise la consola.");
  }
};

/* ══════════════════════════════════════════
   COPIAR ENLACE
══════════════════════════════════════════ */
window.copiarLink = function (evId) {
  const input = document.getElementById("lnk_" + evId);
  const btn = document.getElementById("copy_" + evId);
  navigator.clipboard
    .writeText(input.value)
    .then(() => {
      btn.textContent = "✓ Copiado";
      btn.classList.add("copied");
      setTimeout(() => {
        btn.textContent = "Copiar";
        btn.classList.remove("copied");
      }, 2000);
    })
    .catch(() => {
      input.select();
      document.execCommand("copy");
    });
};

/* ══════════════════════════════════════════
   CÓDIGO QR
══════════════════════════════════════════ */
// Cargar la librería de QR una sola vez (desde CDN)
async function cargarQRCode() {
  if (window.QRCode) return;
  await new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js";
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

window.verQR = async function (evId, nombre) {
  try {
    await cargarQRCode();
  } catch (e) {
    alert("No se pudo cargar el generador de QR. Verifique su conexión.");
    return;
  }

  const link = generarLink(evId);
  const cont = document.getElementById("qrContainer");
  cont.innerHTML = ""; // limpiar QR anterior

  new QRCode(cont, {
    text: link,
    width: 260,
    height: 260,
    colorDark: "#0B2252", // azul institucional
    colorLight: "#ffffff",
    correctLevel: QRCode.CorrectLevel.H,
  });

  document.getElementById("qrNombre").textContent = nombre;
  document.getElementById("qrLink").textContent = link;
  document.getElementById("modalQR").classList.add("show");
};

window.cerrarModalQR = function () {
  document.getElementById("modalQR").classList.remove("show");
};

window.descargarQR = function () {
  // El QR se dibuja en un <canvas>; lo convertimos en imagen PNG
  const canvas = document.querySelector("#qrContainer canvas");
  if (!canvas) return;
  const a = document.createElement("a");
  a.href = canvas.toDataURL("image/png");
  const nombre = document.getElementById("qrNombre").textContent || "Evento";
  a.download = `QR_${nombre.replace(/\s+/g, "_")}.png`;
  a.click();
};

/* ══════════════════════════════════════════
   RENDER EVENTOS
══════════════════════════════════════════ */
async function renderEventos() {
  const list = document.getElementById("eventosList");
  list.innerHTML = '<div class="no-eventos">Cargando eventos…</div>';

  try {
    const snap = await getDocs(
      query(collection(db, COL_EVENTOS), orderBy("creadoEn", "desc")),
    );

    if (snap.empty) {
      list.innerHTML =
        '<div class="no-eventos">No hay eventos aún. Cree el primero arriba.</div>';
      return;
    }

    // Contar registros de cada evento
    const items = await Promise.all(
      snap.docs.map(async (d) => {
        const ev = { id: d.id, ...d.data() };
        const regs = await getDocs(collection(db, COL_REGS(ev.id)));
        return { ev, count: regs.size };
      }),
    );

    list.innerHTML = items
      .map(({ ev, count }) => {
        const lnk = generarLink(ev.id);
        const cerrado = !!ev.cerrado;
        return `
      <div class="ev-item ${cerrado ? "cerrado" : ""}">
        <div class="ev-item-top">
          <div class="ev-item-icon">${cerrado ? "🔒" : "📋"}</div>
          <div class="ev-item-info">
            <div class="ev-item-nombre">${ev.nombre} ${cerrado ? '<span class="badge-cerrado">CERRADO</span>' : ""}</div>
            <div class="ev-item-meta">${[ev.fecha, ev.jornada, ev.institucion].filter(Boolean).join(" · ")}</div>
          </div>
          <div class="ev-item-actions">
            <span class="ev-count ${count === 0 ? "cero" : ""}">${count} reg.</span>
            <button class="btn-qr" onclick="verQR('${ev.id}','${(ev.nombre || "").replace(/'/g, "\\'")}')">▦ Código QR</button>
            <button class="btn-cerrar ${cerrado ? "reabrir" : ""}" onclick="toggleCerrarEvento('${ev.id}', ${cerrado})">
              ${cerrado ? "🔓 Reabrir" : "🔒 Cerrar"}
            </button>
            <button class="btn-danger" onclick="eliminarEvento('${ev.id}')">✕ Eliminar</button>
          </div>
        </div>
        <div class="link-box">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--cian)" stroke-width="2">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
          </svg>
          <input type="text" value="${lnk}" id="lnk_${ev.id}" readonly onclick="this.select()">
          <button class="btn-copy" id="copy_${ev.id}" onclick="copiarLink('${ev.id}')">Copiar</button>
        </div>
      </div>`;
      })
      .join("");
  } catch (err) {
    console.error("Error cargando eventos:", err);
    list.innerHTML =
      '<div class="no-eventos" style="color:var(--error)">Error al cargar eventos. Revise la consola.</div>';
  }
}

/* ══════════════════════════════════════════
   REGISTROS
══════════════════════════════════════════ */
async function renderRegistrosPanel() {
  const snap = await getDocs(
    query(collection(db, COL_EVENTOS), orderBy("creadoEn", "desc")),
  );
  const sel = document.getElementById("regSelector");
  const prev = sel.value;
  sel.innerHTML =
    '<option value="">— Seleccione un evento —</option>' +
    snap.docs
      .map(
        (d) =>
          `<option value="${d.id}" ${d.id === prev ? "selected" : ""}>${d.data().nombre} · ${d.data().fecha}</option>`,
      )
      .join("");
  if (prev) cargarRegistros();
}

// Guardamos aquí la "suscripción" activa para poder apagarla
// cuando el usuario cambie de evento (si no, quedarían varias escuchando)
let _unsubRegistros = null;

window.cargarRegistros = async function () {
  const evId = document.getElementById("regSelector").value;
  const btnEx = document.getElementById("btnExportarEv");
  const tabla = document.getElementById("regTabla");

  // Apagar la escucha anterior si existía
  if (_unsubRegistros) {
    _unsubRegistros();
    _unsubRegistros = null;
  }

  if (!evId) {
    tabla.innerHTML =
      '<tr><td colspan="8" class="sin-datos">Seleccione un evento.</td></tr>';
    document.getElementById("regTitulo").textContent =
      "Registros de asistencia";
    document.getElementById("regSub").textContent = "";
    document.getElementById("regConteo").innerHTML = "";
    btnEx.style.display = "none";
    const btnPdfOff = document.getElementById("btnExportarPdf");
    if (btnPdfOff) btnPdfOff.style.display = "none";
    return;
  }

  tabla.innerHTML = '<tr><td colspan="8" class="sin-datos">Cargando…</td></tr>';

  try {
    const evDoc = await getDocs(collection(db, COL_EVENTOS));
    const ev = evDoc.docs.find((d) => d.id === evId)?.data();

    document.getElementById("regTitulo").textContent = ev
      ? ev.nombre
      : "Evento";
    document.getElementById("regSub").textContent = ev
      ? [ev.fecha, ev.jornada, ev.institucion].filter(Boolean).join(" · ")
      : "";
    window._evActual = ev;

    // ── Escucha en TIEMPO REAL: Firestore nos avisa cada vez
    //    que alguien se registra y la tabla se redibuja sola ──
    _unsubRegistros = onSnapshot(
      query(collection(db, COL_REGS(evId)), orderBy("creadoEn", "asc")),
      (regs) => {
        document.getElementById("regConteo").innerHTML =
          `<span class="live-dot"></span> EN VIVO · ${regs.size} participante(s) registrado(s)`;
        btnEx.style.display = regs.size ? "inline-flex" : "none";
        const btnPdf = document.getElementById("btnExportarPdf");
        if (btnPdf) btnPdf.style.display = regs.size ? "inline-flex" : "none";

        if (regs.empty) {
          tabla.innerHTML =
            '<tr><td colspan="8" class="sin-datos">Sin registros en este evento.<br><small>Esta tabla se actualiza sola cuando alguien se registre.</small></td></tr>';
          window._regActuales = [];
          return;
        }

        tabla.innerHTML = regs.docs
          .map((d, i) => {
            const r = { id: d.id, ...d.data() };
            const hora = r.creadoEn?.toDate
              ? r.creadoEn.toDate().toLocaleTimeString("es-CO", {
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : r.timestamp || "";
            return `
      <tr>
        <td style="font-weight:600;color:var(--txt)">${i + 1}</td>
        <td>${r.cedula}</td>
        <td style="font-weight:500;white-space:nowrap">${r.nombre}</td>
        <td style="font-size:11.5px">${r.dependencia}</td>
        <td>${(r.sexo || "").charAt(0)}</td>
        <td><span class="nivel-badge">${r.nivel}</span></td>
        <td style="font-size:11px;color:var(--txt)">${hora}</td>
        <td><img class="thumb-firma" src="${r.firma}" onclick="verFirma('${r.firma}','${r.nombre.replace(/'/g, "\\'")}')"></td>
      </tr>`;
          })
          .join("");

        // Guardar para exportar (siempre actualizado)
        window._regActuales = regs.docs.map((d) => ({ id: d.id, ...d.data() }));
      },
      (err) => {
        console.error("Error en tiempo real:", err);
        tabla.innerHTML =
          '<tr><td colspan="8" class="sin-datos" style="color:var(--error)">Error al cargar. Revise la consola.</td></tr>';
      },
    );
  } catch (err) {
    console.error("Error cargando registros:", err);
    tabla.innerHTML =
      '<tr><td colspan="8" class="sin-datos" style="color:var(--error)">Error al cargar. Revise la consola.</td></tr>';
  }
};

window.exportarEvento = async function () {
  if (!window._regActuales?.length) return;
  const evId = document.getElementById("regSelector").value;
  await exportar(evId, "btnExportarEv");
};

/* ══════════════════════════════════════════
   EXPORTAR A PDF
══════════════════════════════════════════ */
window.exportarEventoPDF = async function (botonId) {
  const btn = botonId ? document.getElementById(botonId) : null;
  if (btn) {
    btn.disabled = true;
    btn.textContent = "⏳ Generando PDF…";
  }
  try {
    if (!window._regActuales?.length || !window._evActual) {
      alert("Primero seleccione un evento con registros.");
      return;
    }
    const mod = await import("./exportar-pdf.js");
    await mod.exportarPDF(window._evActual, window._regActuales);
  } catch (err) {
    console.error("Error generando PDF:", err);
    alert(`Error al generar el PDF:\n${err.message}`);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = "📄 Exportar PDF";
    }
  }
};

// Desde la pestaña Exportar: carga los registros del evento elegido y genera el PDF
window.exportarSeleccionadoPDF = async function () {
  const evId = document.getElementById("exportSelector").value;
  if (!evId) {
    alert("Seleccione un evento.");
    return;
  }
  try {
    const evDoc = await getDocs(collection(db, COL_EVENTOS));
    const ev = evDoc.docs.find((d) => d.id === evId)?.data();
    const regs = await getDocs(
      query(collection(db, COL_REGS(evId)), orderBy("creadoEn", "asc")),
    );
    if (regs.empty) {
      alert("El evento no tiene registros.");
      return;
    }
    window._evActual = ev;
    window._regActuales = regs.docs.map((d) => ({ id: d.id, ...d.data() }));
    await window.exportarEventoPDF(null);
  } catch (err) {
    console.error("Error generando PDF:", err);
    alert(`Error al generar el PDF:\n${err.message}`);
  }
};

/* ══════════════════════════════════════════
   ESTADÍSTICAS
══════════════════════════════════════════ */
/* ══════════════════════════════════════════
   TABLERO DE ESTADÍSTICAS (carga de datos)
══════════════════════════════════════════ */

// Los datos se traen una vez; el filtro solo recalcula sobre ellos
let _statsEventos = [];
let _statsRegistros = [];

window.filtrarEstadisticas = function () {
  pintarTablero(_statsEventos, _statsRegistros, document.getElementById("statFiltroEvento").value);
};

async function renderEstadisticas() {
  const eventosSnap = await getDocs(
    query(collection(db, COL_EVENTOS), orderBy("creadoEn", "desc")),
  );
  _statsEventos = eventosSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  _statsRegistros = [];

  for (const ev of _statsEventos) {
    const regs = await getDocs(collection(db, COL_REGS(ev.id)));
    regs.docs.forEach((r) =>
      _statsRegistros.push({ ...r.data(), eventoId: ev.id, eventoNombre: ev.nombre }),
    );
  }

  // Llenar el filtro conservando la selección actual
  const sel = document.getElementById("statFiltroEvento");
  const previo = sel.value;
  sel.innerHTML =
    '<option value="">— Todos los eventos —</option>' +
    _statsEventos
      .map((e) => `<option value="${e.id}">${e.nombre} · ${e.fecha || ""}</option>`)
      .join("");
  sel.value = previo;

  window.filtrarEstadisticas();
}

/* ══════════════════════════════════════════
   EXPORTAR
══════════════════════════════════════════ */
async function renderExportar() {
  const snap = await getDocs(
    query(collection(db, COL_EVENTOS), orderBy("creadoEn", "desc")),
  );
  const sel = document.getElementById("exportSelector");
  sel.innerHTML =
    '<option value="">— Seleccione evento —</option>' +
    snap.docs
      .map(
        (d) =>
          `<option value="${d.id}">${d.data().nombre} · ${d.data().fecha}</option>`,
      )
      .join("");
}

window.exportarTodo = async function () {
  const btn = document.querySelector('[onclick="exportarTodo()"]');
  if (btn) {
    btn.disabled = true;
    btn.textContent = "⏳ Generando…";
  }
  try {
    if (ES_SERVIDOR_LOCAL) {
      const resp = await fetch("/api/exportar-todo");
      if (!resp.ok) {
        const e = await resp.json();
        throw new Error(e.error);
      }
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "PTFT38_Todos_los_Eventos.xlsx";
      a.click();
      URL.revokeObjectURL(url);
    } else {
      const snap = await getDocs(collection(db, COL_EVENTOS));
      let todos = [];
      for (const ev of snap.docs) {
        const regs = await getDocs(collection(db, COL_REGS(ev.id)));
        regs.docs.forEach((r) =>
          todos.push({
            ...r.data(),
            eventoNombre: ev.data().nombre,
            eventoFecha: ev.data().fecha,
          }),
        );
      }
      if (!todos.length) {
        alert("No hay registros para exportar.");
        return;
      }
      const eventoGenerico = {
        nombre: "Todos los Eventos",
        fecha: new Date().toLocaleDateString("es-CO"),
        institucion: "Registraduría Nacional del Estado Civil",
        jornada: "",
      };
      await exportarPTFT38(eventoGenerico, todos, TEMPLATE_URL);
    }
  } catch (err) {
    alert(`Error: ${err.message}`);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = "📥 Descargar todos los registros";
    }
  }
};

window.exportarSeleccionado = async function () {
  const evId = document.getElementById("exportSelector").value;
  if (!evId) {
    alert("Seleccione un evento.");
    return;
  }
  await exportar(evId, null);
};

/* ══════════════════════════════════════════
   CSV DOWNLOAD
══════════════════════════════════════════ */
function descargarCSV(registros, nombreArchivo) {
  const cols = [
    "No.",
    "Evento",
    "Fecha Evento",
    "Cédula",
    "Nombres y Apellidos",
    "Dependencia",
    "Sexo",
    "Nivel del Cargo",
    "Fecha y Hora Registro",
  ];
  const filas = registros.map((r, i) => {
    const ts = r.creadoEn?.toDate
      ? r.creadoEn.toDate().toLocaleString("es-CO")
      : r.timestamp || "";
    return [
      i + 1,
      `"${(r.eventoNombre || "").replace(/"/g, '""')}"`,
      r.eventoFecha || "",
      r.cedula,
      `"${(r.nombre || "").replace(/"/g, '""')}"`,
      `"${(r.dependencia || "").replace(/"/g, '""')}"`,
      r.sexo,
      r.nivel,
      `"${ts}"`,
    ].join(",");
  });
  const csv = "\uFEFF" + cols.join(",") + "\n" + filas.join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `PTFT38_${nombreArchivo.replace(/\s+/g, "_")}_${new Date().toLocaleDateString("es-CO").replace(/\//g, "-")}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/* ══════════════════════════════════════════
   MODAL FIRMA
══════════════════════════════════════════ */
window.verFirma = function (src, nombre) {
  document.getElementById("modalImg").src = src;
  document.getElementById("modalNombre").textContent = nombre;
  document.getElementById("modalFirma").classList.add("show");
};
window.cerrarModal = function () {
  document.getElementById("modalFirma").classList.remove("show");
};

/* ══════════════════════════════════════════
   INIT
══════════════════════════════════════════ */
document.addEventListener("DOMContentLoaded", () => {
  // Fecha mínima = hoy (no permite fechas pasadas)
  const fechaEl = document.getElementById("evFecha");
  if (fechaEl) {
    const hoy = new Date().toISOString().split("T")[0];
    fechaEl.min = hoy;
    fechaEl.valueAsDate = new Date();
  }

  // Mayúsculas automáticas en campos del formulario de evento
  ["evNombre", "evInstitucion"].forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener("input", () => {
      const pos = el.selectionStart;
      el.value = el.value.toUpperCase();
      el.setSelectionRange(pos, pos);
    });
  });

  tab("eventos");
});
