import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// Configuración Firebase
export const firebaseConfig = {
    apiKey: "AIzaSyD3r6Pw9Hr5vK4aq_YJ3ov3bnf5A4KoBsk",
    authDomain: "asistencia-eventos-ed298.firebaseapp.com",
    projectId: "asistencia-eventos-ed298",
    storageBucket: "asistencia-eventos-ed298.firebasestorage.app",
    messagingSenderId: "512211767205",
    appId: "1:512211767205:web:72e0447b0111965e4d624c"
};

// Una sola instancia compartida por toda la app
const app = initializeApp(firebaseConfig);

export const db      = getFirestore(app);
export const storage = getStorage(app);
export const auth    = getAuth(app);