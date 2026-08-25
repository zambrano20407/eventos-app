/* ============================================================
   inicio.js — Escritorio de módulos del Panel de Gestión
   Protege la pagina, saluda al gestor y muestra contadores.
   ============================================================ */
import { db, auth } from "./firebase-config.js";
import {
  collection,
  getDocs,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// ── Proteger: sin sesión → login ──
onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.replace("/vistas/login.html");
  } else {
    const el = document.getElementById("userEmail");
    if (el) el.textContent = user.email || "";
    cargarContadores();
  }
});

window.cerrarSesion = async function () {
  await signOut(auth);
  window.location.replace("/vistas/login.html");
};

// ── Menú de usuario (chip) ──
window.toggleUserMenu = function (e) {
  e.stopPropagation();
  document.getElementById("userMenu").classList.toggle("open");
};
document.addEventListener("click", () => {
  document.getElementById("userMenu")?.classList.remove("open");
});

// ── Saludo según la hora del día ──
document.addEventListener("DOMContentLoaded", () => {
  const h = new Date().getHours();
  const saludo = h < 12 ? "Buenos días" : h < 18 ? "Buenas tardes" : "Buenas noches";
  document.getElementById("inicioSaludo").textContent = `${saludo}, Oscar 👋`;
});

// ── Contadores de cada módulo ──
async function cargarContadores() {
  // Eventos: total y abiertos
  try {
    const evs = await getDocs(collection(db, "eventos"));
    const abiertos = evs.docs.filter((d) => !d.data().cerrado).length;
    document.getElementById("statsEventos").innerHTML =
      `<span class="modulo-stat">${evs.size} evento(s)</span>` +
      (abiertos
        ? `<span class="modulo-stat alerta">${abiertos} abierto(s)</span>`
        : "");
  } catch (e) {
    console.warn("Contador eventos:", e.message);
  }

  // Usuarios: solicitudes con algun sistema pendiente
  try {
    const usu = await getDocs(collection(db, "solicitudes_usuarios"));
    const pendientes = usu.docs.filter((d) => {
      const s = d.data().sistemas || {};
      return Object.values(s).some((x) => (x.estado || "Pendiente") === "Pendiente");
    }).length;
    const partes = [`<span class="modulo-stat">${usu.size} solicitud(es)</span>`];
    if (pendientes)
      partes.push(`<span class="modulo-stat alerta">${pendientes} pendiente(s)</span>`);
    document.getElementById("statsUsuarios").innerHTML = partes.join("");
  } catch (e) {
    console.warn("Contador usuarios:", e.message);
  }
}
