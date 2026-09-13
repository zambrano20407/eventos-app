/* ══════════════════════════════════════════
   vigencias.js — Control de vencimiento de accesos

   La solicitud ya guardaba hasta cuándo se autorizó el acceso, pero ese
   dato no se cruzaba con nada: un funcionario podía quedar marcado como
   Activo meses después de vencido su permiso, y nadie se enteraba.

   OJO: esto no revoca nada. El SIRC, el ANI y los demás son sistemas del
   nivel central, ajenos a esta herramienta. Lo que hace es avisar a quién
   hay que tramitarle la baja.
══════════════════════════════════════════ */

// Cuántos días antes empieza a avisarse
export const DIAS_AVISO = 30;

/* Hoy en formato ISO (2026-08-25), que es el mismo que guarda el
   <input type="date"> del formulario, así se comparan como texto. */
export function hoyISO() {
  const d = new Date();
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}

/* Días entre dos fechas ISO. Se comparan a mediodía UTC para que el
   cambio de horario no corra el resultado un día. */
function diasEntre(desdeISO, hastaISO) {
  const a = Date.parse(desdeISO + "T12:00:00Z");
  const b = Date.parse(hastaISO + "T12:00:00Z");
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return Math.round((b - a) / 86400000);
}

/* Clasifica una solicitud. Devuelve null cuando no hay nada que avisar,
   para que quien llame solo tenga que filtrar los nulos.

   Solo se avisa de solicitudes con algún sistema ACTIVO: uno Inactivo ya
   se cerró y uno Pendiente todavía no existe. Avisar de esos sería ruido,
   y una alerta que suena cuando no debe es una alerta que se ignora. */
export function revisarVigencia(solicitud, hoy = hoyISO()) {
  const hasta = solicitud?.vigenciaHasta;
  if (!hasta) return null;

  const sistemas = solicitud.sistemas || {};
  const activos = Object.keys(sistemas).filter(
    (sis) => (sistemas[sis].estado || "Pendiente") === "Activo",
  );
  if (!activos.length) return null;

  const dias = diasEntre(hoy, hasta);
  if (dias === null) return null;

  if (dias < 0) {
    return { estado: "vencido", dias: Math.abs(dias), activos, hasta };
  }
  if (dias <= DIAS_AVISO) {
    return { estado: "porVencer", dias, activos, hasta };
  }
  return null;
}

/* Texto en español de cuánto falta o cuánto lleva vencido */
export function textoPlazo(aviso) {
  const { estado, dias } = aviso;
  if (estado === "vencido") {
    if (dias === 0) return "vence hoy";
    return dias === 1 ? "venció ayer" : `venció hace ${dias} días`;
  }
  if (dias === 0) return "vence hoy";
  return dias === 1 ? "vence mañana" : `vence en ${dias} días`;
}

/* Revisa una lista completa y la deja lista para pintar: primero lo
   vencido, y dentro de cada grupo lo más urgente arriba. */
export function revisarTodas(solicitudes, hoy = hoyISO()) {
  const avisos = [];
  (solicitudes || []).forEach((s) => {
    const aviso = revisarVigencia(s, hoy);
    if (aviso) avisos.push({ ...aviso, solicitud: s });
  });

  avisos.sort((a, b) => {
    if (a.estado !== b.estado) return a.estado === "vencido" ? -1 : 1;
    // Vencidos: el que lleva más tiempo primero. Por vencer: el más próximo
    return a.estado === "vencido" ? b.dias - a.dias : a.dias - b.dias;
  });

  return {
    avisos,
    vencidos: avisos.filter((a) => a.estado === "vencido").length,
    porVencer: avisos.filter((a) => a.estado === "porVencer").length,
  };
}
