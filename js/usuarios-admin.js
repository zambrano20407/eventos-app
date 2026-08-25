/* ============================================================
   usuarios-admin.js — Módulo de Gestión de Usuarios
   Solicitudes unificadas de cuentas para todos los sistemas RNEC.
   ============================================================ */
import { db, auth } from "./firebase-config.js";
import {
  collection,
  deleteDoc,
  updateDoc,
  doc,
  query,
  orderBy,
  onSnapshot,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

/* ══════════ AUTENTICACIÓN Y MENÚ ══════════ */
onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.replace("/vistas/login.html");
  } else {
    const el = document.getElementById("userEmail");
    if (el) el.textContent = user.email || "";
  }
});

window.cerrarSesion = async function () {
  await signOut(auth);
  window.location.replace("/vistas/login.html");
};

window.toggleUserMenu = function (e) {
  e.stopPropagation();
  document.getElementById("userMenu").classList.toggle("open");
};
document.addEventListener("click", () => {
  document.getElementById("userMenu")?.classList.remove("open");
});

/* ══════════════════════════════════════════
   GESTIÓN DE USUARIOS DE SISTEMAS
══════════════════════════════════════════ */
let _unsubUsuarios = null;
let _solicUsuarios = {};

const NOMBRES_SISTEMA = {
  correo: "Correo",
  ani: "ANI",
  webservice: "Web Service",
  gedid: "GED ID",
  gedrc: "GED RC",
  sirc: "SIRC",
  hled: "HLED",
};
const ESTADOS_CICLO = ["Pendiente", "Activo", "Inactivo"];
const COLOR_ESTADO = {
  Pendiente: "background:#f5c400;color:#0b2252",
  Activo: "background:#00a064;color:#fff",
  Inactivo: "background:#c0392b;color:#fff",
};

async function renderUsuarios() {
  const lnk = new URL("/vistas/usuarios.html", window.location.href).toString();
  document.getElementById("lnkUsuarios").value = lnk;

  if (_unsubUsuarios) _unsubUsuarios();
  _unsubUsuarios = onSnapshot(
    query(collection(db, "solicitudes_usuarios"), orderBy("creadoEn", "desc")),
    (snap) => {
      _solicUsuarios = {};
      snap.docs.forEach((d) => (_solicUsuarios[d.id] = { id: d.id, ...d.data() }));
      pintarTablaUsuarios();
    },
    (err) => {
      console.error("Error cargando usuarios:", err);
      document.getElementById("usuTabla").innerHTML =
        '<tr><td colspan="7" class="sin-datos" style="color:var(--error)">Error al cargar. Revise la consola.</td></tr>';
    },
  );
}

function pintarTablaUsuarios() {
  const tabla = document.getElementById("usuTabla");
  const filtro = document.getElementById("usuFiltro")?.value || "";
  const hoyISO = new Date().toISOString().split("T")[0];

  let lista = Object.values(_solicUsuarios);
  if (filtro) lista = lista.filter((s) => s.sistemasSolicitados?.includes(filtro));

  document.getElementById("usuConteo").textContent =
    `${lista.length} solicitud(es)` + (filtro ? ` con ${NOMBRES_SISTEMA[filtro]}` : "");

  if (!lista.length) {
    tabla.innerHTML =
      '<tr><td colspan="7" class="sin-datos">No hay solicitudes' +
      (filtro ? " para este sistema." : ". Comparta el enlace de arriba.") +
      "</td></tr>";
    return;
  }

  tabla.innerHTML = lista
    .map((s, i) => {
      const vencida = s.vigenciaHasta && s.vigenciaHasta < hoyISO;
      const badges = (s.sistemasSolicitados || [])
        .map((sis) => {
          const info = s.sistemas?.[sis] || {};
          const estado = info.estado || "Pendiente";
          const usuario = info.usuarioAsignado ? ` · ${info.usuarioAsignado}` : "";
          return `<span class="nivel-badge" style="${COLOR_ESTADO[estado]};cursor:pointer;margin:1px"
            title="Clic para cambiar estado (${estado})"
            onclick="cambiarEstadoUsuario('${s.id}','${sis}')">${NOMBRES_SISTEMA[sis]}${usuario}</span>
          <button title="Anotar usuario asignado" style="border:none;background:none;cursor:pointer;font-size:11px"
            onclick="asignarUsuario('${s.id}','${sis}')">✏️</button>
          <button title="Descargar formato oficial de ${NOMBRES_SISTEMA[sis]} (Word)" style="border:none;background:none;cursor:pointer;font-size:11px"
            onclick="wordFormato('${s.id}','${sis}')">📄</button>`;
        })
        .join(" ");
      const estadoAut = s.estadoAutorizacion || "Pendiente";
      const autInfo = {
        Pendiente: ["⏳ Sin autorizar", "background:#f5c400;color:#0b2252"],
        Autorizada: ["✔ Autorizada", "background:#00a064;color:#fff"],
        Rechazada: ["✕ Rechazada", "background:#c0392b;color:#fff"],
      }[estadoAut] || ["—", ""];
      return `
      <tr ${vencida ? 'style="background:#fff5f5"' : ""}>
        <td style="font-weight:600">${i + 1}</td>
        <td style="font-weight:500;white-space:nowrap">${s.nombres || ""} ${s.apellidos || ""}<br>
          <span style="font-size:10.5px;color:var(--gris-txt)">${s.cargo || ""} · ${s.vinculacion || ""}</span><br>
          <span class="nivel-badge" style="${autInfo[1]};font-size:9.5px;margin-top:3px;display:inline-block"
            title="${estadoAut === "Rechazada" ? (s.motivoRechazo || "") : "Autorización del Delegado"}">${autInfo[0]}</span></td>
        <td>${s.cedula || ""}</td>
        <td style="font-size:11.5px">${s.oficina || ""}</td>
        <td style="font-size:11px;${vencida ? "color:var(--error);font-weight:700" : ""}">
          ${s.vigenciaDesde || ""}<br>→ ${s.vigenciaHasta || ""}${vencida ? " ⚠️" : ""}</td>
        <td>${badges}</td>
        <td style="white-space:nowrap">
          ${estadoAut === "Pendiente"
            ? `<button class="btn-qr" style="padding:6px 10px;font-size:10px" title="Copiar el enlace para que el Delegado autorice y firme"
                 onclick="copiarEnlaceAutorizacion('${s.id}')">🔗 Enlace firma</button>`
            : ""}
          <button class="btn-pdf" style="padding:6px 10px;font-size:10px" title="Descargar todos los formatos de esta solicitud (Word)"
            onclick="wordTodos('${s.id}')">📄 Todos</button>
          <button class="btn-danger" style="padding:6px 10px;font-size:10px" onclick="eliminarSolicUsuario('${s.id}')">✕</button>
        </td>
      </tr>`;
    })
    .join("");
}

window.filtrarUsuarios = pintarTablaUsuarios;

window.copiarLinkUsuarios = function () {
  const input = document.getElementById("lnkUsuarios");
  const btn = document.getElementById("copyUsuarios");
  navigator.clipboard.writeText(input.value).then(() => {
    btn.textContent = "✓ Copiado";
    btn.classList.add("copied");
    setTimeout(() => {
      btn.textContent = "Copiar";
      btn.classList.remove("copied");
    }, 2000);
  });
};

window.cambiarEstadoUsuario = async function (id, sis) {
  const s = _solicUsuarios[id];
  if (!s?.sistemas?.[sis]) return;
  const actual = s.sistemas[sis].estado || "Pendiente";
  const siguiente =
    ESTADOS_CICLO[(ESTADOS_CICLO.indexOf(actual) + 1) % ESTADOS_CICLO.length];
  try {
    await updateDoc(doc(db, "solicitudes_usuarios", id), {
      [`sistemas.${sis}.estado`]: siguiente,
    });
  } catch (err) {
    console.error("Error cambiando estado:", err);
    alert("Error al cambiar el estado. Revise la consola.");
  }
};

window.asignarUsuario = async function (id, sis) {
  const s = _solicUsuarios[id];
  if (!s) return;
  const actual = s.sistemas?.[sis]?.usuarioAsignado || "";
  const nuevo = prompt(
    `Usuario asignado en ${NOMBRES_SISTEMA[sis]} para ${s.nombres} ${s.apellidos}:`,
    actual,
  );
  if (nuevo === null) return;
  try {
    await updateDoc(doc(db, "solicitudes_usuarios", id), {
      [`sistemas.${sis}.usuarioAsignado`]: nuevo.trim(),
    });
  } catch (err) {
    console.error("Error asignando usuario:", err);
    alert("Error al guardar. Revise la consola.");
  }
};

// Enlace personal para que el Delegado revise y firme por la web
window.copiarEnlaceAutorizacion = async function (id) {
  const s = _solicUsuarios[id];
  if (!s) return;
  if (!s.tokenAutorizacion) {
    alert(
      "Esta solicitud es anterior a la firma web y no tiene enlace.\n" +
      "El funcionario debe enviarla de nuevo, o imprima el formato para firmarlo a mano.",
    );
    return;
  }
  const url = new URL("/vistas/autorizar.html", window.location.href);
  url.searchParams.set("sol", id);
  url.searchParams.set("t", s.tokenAutorizacion);
  try {
    await navigator.clipboard.writeText(url.toString());
    alert(
      `Enlace copiado. Envíeselo a ${s.autNombres || ""} ${s.autApellidos || ""} ` +
      "por correo o WhatsApp para que autorice y firme.",
    );
  } catch {
    prompt("Copie este enlace y envíeselo a quien autoriza:", url.toString());
  }
};

// Genera el formato oficial en Word a partir de la plantilla institucional
window.wordFormato = async function (id, sis) {
  const s = _solicUsuarios[id];
  if (!s) return;
  try {
    const mod = await import("./usuarios-word.js");
    await mod.exportarWord(s, sis);
  } catch (err) {
    console.error("Error generando formato:", err);
    alert(`Error al generar el formato:\n${err.message}`);
  }
};

window.wordTodos = async function (id) {
  const s = _solicUsuarios[id];
  if (!s) return;
  try {
    const mod = await import("./usuarios-word.js");
    await mod.exportarTodosWord(s);
  } catch (err) {
    console.error("Error generando formatos:", err);
    alert(`Error al generar los formatos:\n${err.message}`);
  }
};

window.eliminarSolicUsuario = async function (id) {
  const s = _solicUsuarios[id];
  if (!confirm(`¿Eliminar la solicitud de ${s?.nombres || ""} ${s?.apellidos || ""}?`)) return;
  try {
    await deleteDoc(doc(db, "solicitudes_usuarios", id));
  } catch (err) {
    console.error("Error eliminando:", err);
    alert("Error al eliminar. Revise la consola.");
  }
};

/* ══════════ INIT ══════════ */
document.addEventListener("DOMContentLoaded", () => {
  renderUsuarios();
});
