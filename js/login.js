import { auth } from "./firebase-config.js";
import {
  signInWithEmailAndPassword,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// Si ya hay sesión activa → ir directo al admin
onAuthStateChanged(auth, (user) => {
  if (user) {
    window.location.replace("/vistas/admin.html");
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
    window.location.replace("/vistas/admin.html");
  } catch (err) {
    let msg = "Credenciales incorrectas. Intente de nuevo.";
    if (err.code === "auth/too-many-requests") {
      msg = "Demasiados intentos fallidos. Intente más tarde.";
    }
    error.textContent = msg;
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
