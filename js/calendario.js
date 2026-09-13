/* ══════════════════════════════════════════
   calendario.js — Vista de mes de los eventos

   Es una cuadrícula de días, no de horas: los eventos guardan jornada
   (Mañana, Tarde, Noche, Completa), no hora de inicio. Dibujar franjas
   horarias aparentaría una precisión que el dato no tiene, y dejaría la
   rejilla casi vacía.

   Módulo puro: recibe los eventos ya cargados y dibuja.
══════════════════════════════════════════ */

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];
const DIAS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

/* Fecha ISO a partes numéricas, sin pasar por Date: construir un Date
   desde "2026-08-25" lo interpreta como UTC y en Colombia retrocede un
   día, poniendo los eventos en la casilla equivocada. */
function partes(iso) {
  const m = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? { a: +m[1], m: +m[2], d: +m[3] } : null;
}

export function mesDeHoy() {
  const h = new Date();
  return { anio: h.getFullYear(), mes: h.getMonth() + 1 };
}

export function sumarMeses({ anio, mes }, n) {
  const total = anio * 12 + (mes - 1) + n;
  return { anio: Math.floor(total / 12), mes: (total % 12) + 1 };
}

export function nombreMes({ anio, mes }) {
  return `${MESES[mes - 1]} ${anio}`;
}

/* Encabezado de días de la semana */
export function pintarDiasSemana(contenedor) {
  const caja = document.getElementById(contenedor);
  if (!caja) return;
  caja.innerHTML = DIAS.map((d) => `<div class="cal-dia-nom">${d}</div>`).join("");
}

/* Dibuja la rejilla del mes.

   `items` son los del panel: { ev, count, regsDocs }.
   `cumplimientoDe` recibe un item y devuelve el texto "13/16" o "", para
   no duplicar aquí la lógica de convocatoria que ya vive en admin.js. */
export function pintarMes(contenedor, { anio, mes }, items, cumplimientoDe) {
  const caja = document.getElementById(contenedor);
  if (!caja) return;

  // Eventos del mes, agrupados por día
  const porDia = {};
  (items || []).forEach((item) => {
    const p = partes(item.ev.fechaISO);
    if (!p || p.a !== anio || p.m !== mes) return;
    (porDia[p.d] = porDia[p.d] || []).push(item);
  });

  const primerDiaSemana = new Date(anio, mes - 1, 1).getDay();
  const diasDelMes = new Date(anio, mes, 0).getDate();
  const hoy = new Date();
  const esMesActual = hoy.getFullYear() === anio && hoy.getMonth() + 1 === mes;

  const celdas = [];

  // Huecos antes del día 1, para que cada día caiga bajo su columna
  for (let i = 0; i < primerDiaSemana; i++) {
    celdas.push('<div class="cal-celda vacia"></div>');
  }

  for (let d = 1; d <= diasDelMes; d++) {
    const delDia = porDia[d] || [];
    const esHoy = esMesActual && hoy.getDate() === d;

    const pastillas = delDia
      .map(({ ev }) => {
        const cerrado = !!ev.cerrado;
        const cump = cumplimientoDe ? cumplimientoDe(ev) : "";
        const nombre = (ev.nombre || "").replace(/"/g, "&quot;");
        return `<button class="cal-evento ${cerrado ? "cerrado" : "abierto"}"
          title="${nombre}${ev.jornada ? " · " + ev.jornada : ""}${cump ? " · " + cump + " sedes" : ""}"
          onclick="window.abrirEventoDesdeCalendario('${ev.id}')">
          <span class="cal-ev-nombre">${nombre}</span>
          ${cump ? `<span class="cal-ev-cump">${cump}</span>` : ""}
        </button>`;
      })
      .join("");

    celdas.push(`<div class="cal-celda ${esHoy ? "hoy" : ""} ${delDia.length ? "con-eventos" : ""}">
      <span class="cal-num">${d}</span>
      ${pastillas}
    </div>`);
  }

  // Huecos al final para cerrar la última semana
  while (celdas.length % 7 !== 0) {
    celdas.push('<div class="cal-celda vacia"></div>');
  }

  caja.innerHTML = celdas.join("");
}
