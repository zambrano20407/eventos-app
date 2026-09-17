/* ══════════════════════════════════════════
   sexo.js — Componente sexo del asistente

   El formulario ya no obliga a escoger entre masculino y femenino:
   quien no se identifique con ninguno puede marcar "Otro" y escribir
   cómo se reconoce.

   Para que eso no rompa ni el formato oficial ni las estadísticas, el
   dato se guarda en dos campos:

     sexo         grupo normalizado: "Masculino" | "Femenino" | "Otro"
     sexoDetalle  lo que la persona escribió, si escribió algo

   Así el conteo y el PTFT38 trabajan sobre tres valores estables, y el
   texto libre se conserva en el registro sin ensuciar la estadística.
══════════════════════════════════════════ */

export const GRUPOS_SEXO = ["Masculino", "Femenino", "Otro"];

/* Sigla para el formato oficial: M, F u O.

   Antes se tomaba la primera letra del valor, que funcionaba solo
   mientras las opciones fueran dos. Con una tercera, "No binario"
   habría salido como una "N" suelta que no significa nada. */
export function siglaSexo(registro) {
  const g = grupoSexo(registro);
  if (g === "Masculino") return "M";
  if (g === "Femenino") return "F";
  if (g === "Otro") return "O";
  return ""; // sin dato: se deja en blanco, no se inventa
}

/* Grupo normalizado. Tolera los registros anteriores, que solo tenían
   el texto "Masculino" u "Femenino". */
export function grupoSexo(registro) {
  const v = String(registro?.sexo || "").trim();
  if (!v) return "";
  const b = v.toLowerCase();
  if (b.startsWith("masculino") || b === "m") return "Masculino";
  if (b.startsWith("femenino") || b === "f") return "Femenino";
  return "Otro";
}

/* Cómo mostrarlo en pantalla: si la persona escribió cómo se reconoce,
   se respeta lo que escribió. */
export function etiquetaSexo(registro) {
  const detalle = String(registro?.sexoDetalle || "").trim();
  if (detalle) return detalle;
  return grupoSexo(registro) || "Sin especificar";
}
