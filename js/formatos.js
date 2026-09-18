/* ══════════════════════════════════════════
   formatos.js — Los dos formatos oficiales de asistencia

   La entidad lleva la asistencia en dos formatos distintos, y no piden
   los mismos datos:

     PTFT38  Permanencia del Talento Humano — capacitaciones y formación.
             Pide sexo y nivel del cargo.

     SGFT07  Asistencia a Reuniones — reuniones y comités.
             Pide cargo, teléfono y correo.

   Cada evento escoge uno, y de esa elección dependen los campos que ve
   el asistente y la plantilla con la que se genera el Excel. Aquí vive
   esa definición para que el formulario, el panel y la exportación no
   se contradigan entre sí.
══════════════════════════════════════════ */

export const FORMATOS = {
  PTFT38: {
    codigo: "PTFT38",
    titulo: "Permanencia del Talento Humano",
    para: "Capacitaciones y formación",
    plantilla: "/PTFT38.xlsx",
    // Campos que el formulario pide además de los comunes
    campos: ["sexo", "nivel"],
    filasPorHoja: 25,
    // Hoy solo el PTFT38 tiene su versión dibujada en PDF
    tienePDF: true,
  },
  SGFT07: {
    codigo: "SGFT07",
    titulo: "Asistencia a Reuniones",
    para: "Reuniones y comités",
    plantilla: "/SGFT07.xlsx",
    campos: ["cargo", "telefono", "correo"],
    filasPorHoja: 23,
    tienePDF: false,
  },
};

/* Los eventos creados antes de que existiera la elección no tienen el
   campo, y todos ellos se llevaron en PTFT38. */
export const FORMATO_POR_DEFECTO = "PTFT38";

export function formatoDe(evento) {
  return FORMATOS[evento?.formato] || FORMATOS[FORMATO_POR_DEFECTO];
}

/* Campos comunes a los dos formatos, que siempre se piden */
export const CAMPOS_COMUNES = ["cedula", "nombre", "dependencia", "firma"];

export function pide(evento, campo) {
  return formatoDe(evento).campos.includes(campo);
}
