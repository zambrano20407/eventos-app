import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import { getStorage } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

//Configuración de la aplicación web Firebase
const firebaseConfig = {
    apiKey: "AIzaSyD3r6Pw9Hr5vK4aq_YJ3ov3bnf5A4KoBsk",
    authDomain: "asistencia-eventos-ed298.firebaseapp.com",
    projectId: "asistencia-eventos-ed298",
    storageBucket: "asistencia-eventos-ed298.firebasestorage.app",
    messagingSenderId: "512211767205",
    appId: "1:512211767205:web:72e0447b0111965e4d624c"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);

// Exportar la base de datos y el almacenamiento para su uso en otras partes de la aplicación DATOS Y TEXTOS
export const db = getFirestore(app);

// Exportar el almacenamiento para su uso en otras partes de la aplicación IMAGENES
export const storage = getStorage(app);