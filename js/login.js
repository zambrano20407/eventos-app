import { auth } from "./firebase-config.js";
import {
  signInWithEmailAndPassword,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// Si ya hay sesión activa → ir directo al admin
onAuthStateChanged(auth, (user) => {
  if (user) {
    window.location.replace("/vistas/inicio.html");
  }
});

/* ══ MOSTRAR/OCULTAR CONTRASEÑA ══ */
window.togglePass = function () {
  const input = document.getElementById("loginPass");
  input.type = input.type === "password" ? "text" : "password";
};

/* ══ INICIAR SESIÓN ══ */
window.iniciarSesion = async function () {
  const email = document.getElementById("loginEmail").value.trim();
  const pass  = document.getElementById("loginPass").value;
  const btn   = document.getElementById("btnLogin");
  const error = document.getElementById("loginError");

  error.classList.remove("show");

  if (!email || !pass) {
    error.textContent = "Por favor complete todos los campos.";
    error.classList.add("show");
    return;
  }

  btn.classList.add("loading");
  btn.disabled = true;

  try {
    await signInWithEmailAndPassword(auth, email, pass);
    window.location.replace("/vistas/inicio.html");
  } catch (err) {
    // Un solo mensaje para todo escondía fallos que no son de credenciales
    // (dominio sin autorizar, red bloqueada) y hacía perder tiempo probando
    // contraseñas que sí eran correctas.
    console.error("Fallo al iniciar sesión:", err.code, err);
    const MENSAJES = {
      "auth/too-many-requests": "Demasiados intentos fallidos. Intente más tarde.",
      "auth/network-request-failed":
        "No hay conexión con el servidor de autenticación. Revise la red.",
      "auth/unauthorized-domain":
        "Este dominio no está autorizado en Firebase Authentication.",
      "auth/invalid-email": "El correo no tiene un formato válido.",
      "auth/user-disabled": "Esta cuenta está deshabilitada.",
    };
    error.textContent =
      MENSAJES[err.code] || "Credenciales incorrectas. Intente de nuevo.";
    error.classList.add("show");
  } finally {
    btn.classList.remove("loading");
    btn.disabled = false;
  }
};

// Login con Enter
document.addEventListener("keydown", (e) => {
  if (e.key === "Enter") window.iniciarSesion();
});
