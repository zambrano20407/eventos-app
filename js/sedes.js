/* ══════════════════════════════════════════
   sedes.js — Las dependencias de la Delegación Caquetá

   Única fuente de la lista. La usan el formulario público (para armar
   el desplegable) y el panel (para saber a quién se convocó), de modo
   que no puedan desincronizarse: si mañana cambia una sede, se cambia
   aquí y queda cambiada en los dos lados.
══════════════════════════════════════════ */

/* `nombre` es exactamente el texto que queda guardado en cada registro
   de asistencia; `municipio` sirve para el mapa y los gráficos. */
export const SEDES = [
  { nombre: "Delegación Departamental", municipio: "Florencia" },
  { nombre: "Registraduría Especial de Florencia", municipio: "Florencia" },
  { nombre: "Registraduría Municipal de Albania", municipio: "Albania" },
  { nombre: "Registraduría Municipal de Belén de los Andaquíes", municipio: "Belén de los Andaquíes" },
  { nombre: "Registraduría Municipal de Cartagena del Chairá", municipio: "Cartagena del Chairá" },
  { nombre: "Registraduría Municipal de Curillo", municipio: "Curillo" },
  { nombre: "Registraduría Municipal de El Doncello", municipio: "El Doncello" },
  { nombre: "Registraduría Municipal de El Paujil", municipio: "El Paujil" },
  { nombre: "Registraduría Municipal de La Montañita", municipio: "La Montañita" },
  { nombre: "Registraduría Municipal de Milán", municipio: "Milán" },
  { nombre: "Registraduría Municipal de Morelia", municipio: "Morelia" },
  { nombre: "Registraduría Municipal de Puerto Rico", municipio: "Puerto Rico" },
  { nombre: "Registraduría Municipal de San José del Fragua", municipio: "San José del Fragua" },
  { nombre: "Registraduría Municipal de San Vicente del Caguán", municipio: "San Vicente del Caguán" },
  { nombre: "Registraduría Municipal de Solano", municipio: "Solano" },
  { nombre: "Registraduría Municipal de Solita", municipio: "Solita" },
  { nombre: "Registraduría Municipal de Valparaíso", municipio: "Valparaíso" },
];

/* Nombre corto para etiquetas y gráficos: todas las registradurías
   empiezan igual, así que lo único que distingue es el municipio. */
export function sedeCorta(nombre) {
  return (nombre || "")
    .replace(/^Registradur[íi]a\s+(Municipal|Especial|Auxiliar)\s+de\s+/i, "")
    .replace(/^Delegaci[óo]n\s+Departamental.*$/i, "Delegación")
    .trim();
}
