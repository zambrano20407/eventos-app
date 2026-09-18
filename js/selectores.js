/* ══════════════════════════════════════════
   selectores.js — Selector de fecha y de horario

   El calendario nativo del navegador se ve distinto en cada equipo y
   en cada sistema, y el horario escrito a mano admitía cualquier cosa.
   Estos dos reemplazan esos campos por controles propios, con el mismo
   lenguaje visual de la vista de calendario del módulo.

   En los dos casos el valor real sigue viviendo en un <input> oculto
   con el id de siempre, así que el resto del código lo lee igual:

     fecha    ISO (2026-09-18), como lo entregaba <input type="date">
     horario  texto ya compuesto ("8:00 a. m. a 12:00 m.")
══════════════════════════════════════════ */

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];
const DIAS = ["D", "L", "M", "M", "J", "V", "S"];

/* Partes de una fecha ISO sin pasar por Date: construir un Date desde
   "2026-09-18" lo interpreta como UTC y en Colombia retrocede un día. */
function partes(iso) {
  const m = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? { a: +m[1], m: +m[2], d: +m[3] } : null;
}

function aISO(a, m, d) {
  return `${a}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function hoyISO() {
  const h = new Date();
  return aISO(h.getFullYear(), h.getMonth() + 1, h.getDate());
}

/* "2026-09-18" → "18 de septiembre de 2026" */
function enPalabras(iso) {
  const p = partes(iso);
  if (!p) return "";
  return `${p.d} de ${MESES[p.m - 1].toLowerCase()} de ${p.a}`;
}

/* Cierra cualquier menú abierto. Se registra una sola vez. */
let _cerrarAbierto = null;
document.addEventListener("click", (e) => {
  if (_cerrarAbierto && !e.target.closest(".sel-caja")) _cerrarAbierto();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && _cerrarAbierto) _cerrarAbierto();
});

function abrir(menu, boton) {
  if (_cerrarAbierto) _cerrarAbierto();
  menu.classList.add("abierto");
  boton.classList.add("activo");
  _cerrarAbierto = () => {
    menu.classList.remove("abierto");
    boton.classList.remove("activo");
    _cerrarAbierto = null;
  };
}

/* ══════════════════════════════════════════
   SELECTOR DE FECHA
══════════════════════════════════════════ */
export function montarSelectorFecha(idInput, { minimoHoy = true } = {}) {
  const oculto = document.getElementById(idInput);
  if (!oculto || oculto.dataset.montado) return;
  oculto.dataset.montado = "1";

  // El input nativo pasa a ser un simple depósito del valor
  oculto.type = "hidden";

  const caja = document.createElement("div");
  caja.className = "sel-caja";
  caja.innerHTML = `
    <button type="button" class="sel-boton">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
        <rect x="3" y="4.5" width="18" height="16" rx="2.5" />
        <line x1="3" y1="9.5" x2="21" y2="9.5" />
        <line x1="8" y1="2.5" x2="8" y2="6.5" /><line x1="16" y1="2.5" x2="16" y2="6.5" />
      </svg>
      <span class="sel-texto">Seleccione una fecha</span>
    </button>
    <div class="sel-menu sel-fecha">
      <div class="sel-cabeza">
        <button type="button" class="sel-nav" data-mover="-1" aria-label="Mes anterior">‹</button>
        <span class="sel-mes"></span>
        <button type="button" class="sel-nav" data-mover="1" aria-label="Mes siguiente">›</button>
      </div>
      <div class="sel-semana">${DIAS.map((d) => `<span>${d}</span>`).join("")}</div>
      <div class="sel-rejilla"></div>
      <div class="sel-pie">
        <button type="button" class="sel-hoy">Hoy</button>
      </div>
    </div>`;
  oculto.parentNode.insertBefore(caja, oculto);
  caja.appendChild(oculto);

  const boton = caja.querySelector(".sel-boton");
  const menu = caja.querySelector(".sel-menu");
  const texto = caja.querySelector(".sel-texto");
  const rejilla = caja.querySelector(".sel-rejilla");
  const tituloMes = caja.querySelector(".sel-mes");

  const minimo = minimoHoy ? hoyISO() : null;
  let visible = partes(oculto.value) || partes(hoyISO());

  function pintar() {
    tituloMes.textContent = `${MESES[visible.m - 1]} ${visible.a}`;
    const primerDia = new Date(visible.a, visible.m - 1, 1).getDay();
    const total = new Date(visible.a, visible.m, 0).getDate();
    const hoy = hoyISO();

    const celdas = [];
    for (let i = 0; i < primerDia; i++) celdas.push('<span class="sel-dia vacio"></span>');
    for (let d = 1; d <= total; d++) {
      const iso = aISO(visible.a, visible.m, d);
      const clases = ["sel-dia"];
      if (iso === oculto.value) clases.push("elegido");
      if (iso === hoy) clases.push("hoy");
      // Una fecha anterior al mínimo se muestra, pero apagada: verla
      // ayuda a ubicarse en el mes aunque no se pueda escoger
      const bloqueado = minimo && iso < minimo;
      if (bloqueado) clases.push("bloqueado");
      celdas.push(
        `<button type="button" class="${clases.join(" ")}" data-iso="${iso}"${
          bloqueado ? " disabled" : ""
        }>${d}</button>`,
      );
    }
    rejilla.innerHTML = celdas.join("");
  }

  function mostrarValor() {
    texto.textContent = oculto.value
      ? enPalabras(oculto.value)
      : "Seleccione una fecha";
    texto.classList.toggle("vacio", !oculto.value);
  }

  boton.addEventListener("click", (e) => {
    e.stopPropagation();
    if (menu.classList.contains("abierto")) {
      _cerrarAbierto?.();
      return;
    }
    visible = partes(oculto.value) || partes(hoyISO());
    pintar();
    abrir(menu, boton);
  });

  caja.querySelectorAll(".sel-nav").forEach((b) =>
    b.addEventListener("click", () => {
      const total = visible.a * 12 + (visible.m - 1) + Number(b.dataset.mover);
      visible = { a: Math.floor(total / 12), m: (total % 12) + 1 };
      pintar();
    }),
  );

  caja.querySelector(".sel-hoy").addEventListener("click", () => {
    const h = partes(hoyISO());
    visible = { a: h.a, m: h.m };
    oculto.value = hoyISO();
    mostrarValor();
    pintar();
    _cerrarAbierto?.();
  });

  rejilla.addEventListener("click", (e) => {
    const dia = e.target.closest(".sel-dia[data-iso]");
    if (!dia || dia.disabled) return;
    oculto.value = dia.dataset.iso;
    mostrarValor();
    _cerrarAbierto?.();
  });

  mostrarValor();
  return {
    valor: () => oculto.value,
    poner: (iso) => {
      oculto.value = iso || "";
      mostrarValor();
    },
  };
}

/* ══════════════════════════════════════════
   SELECTOR DE HORARIO

   Se escogen dos horas y el módulo compone el texto que imprime el
   formato. Escribirlo a mano permitía cualquier cosa.
══════════════════════════════════════════ */
const MINUTOS = ["00", "15", "30", "45"];

/* 13:30 → "1:30 p. m." — como se escribe la hora en español */
function enTexto(h24, min) {
  if (h24 === null) return "";
  const tarde = h24 >= 12;
  let h = h24 % 12;
  if (h === 0) h = 12;
  // Las 12:00 del día son "m." (mediodía) y las 12 de la noche "a. m."
  if (h24 === 12 && min === "00") return "12:00 m.";
  return `${h}:${min} ${tarde ? "p. m." : "a. m."}`;
}

export function montarSelectorHorario(idInput) {
  const oculto = document.getElementById(idInput);
  if (!oculto || oculto.dataset.montado) return;
  oculto.dataset.montado = "1";
  oculto.type = "hidden";

  const caja = document.createElement("div");
  caja.className = "sel-caja sel-horario";
  caja.innerHTML = `
    <div class="sel-rango">
      ${["desde", "hasta"].map((cual) => `
        <div class="sel-caja">
          <button type="button" class="sel-boton" data-cual="${cual}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
              <circle cx="12" cy="12" r="9" /><polyline points="12,7 12,12 15.5,14" />
            </svg>
            <span class="sel-texto vacio">${cual === "desde" ? "Desde" : "Hasta"}</span>
          </button>
          <div class="sel-menu sel-horas" data-menu="${cual}">
            <div class="sel-horas-cols">
              <div class="sel-col" data-tipo="hora"></div>
              <div class="sel-col sel-col-min" data-tipo="minuto"></div>
            </div>
          </div>
        </div>`).join("")}
    </div>`;
  oculto.parentNode.insertBefore(caja, oculto);
  caja.appendChild(oculto);

  // Estado: hora en formato 24 y minutos en texto
  const valor = { desde: { h: null, m: "00" }, hasta: { h: null, m: "00" } };

  function componer() {
    const a = enTexto(valor.desde.h, valor.desde.m);
    const b = enTexto(valor.hasta.h, valor.hasta.m);
    oculto.value = a && b ? `${a} a ${b}` : a || "";
  }

  function pintarBoton(cual) {
    const span = caja.querySelector(`[data-cual="${cual}"] .sel-texto`);
    const t = enTexto(valor[cual].h, valor[cual].m);
    span.textContent = t || (cual === "desde" ? "Desde" : "Hasta");
    span.classList.toggle("vacio", !t);
  }

  ["desde", "hasta"].forEach((cual) => {
    const boton = caja.querySelector(`[data-cual="${cual}"]`);
    const menu = caja.querySelector(`[data-menu="${cual}"]`);
    const colH = menu.querySelector('[data-tipo="hora"]');
    const colM = menu.querySelector('[data-tipo="minuto"]');

    // Jornada laboral primero: son las horas que de verdad se usan
    const horas = [...Array(24).keys()].slice(6).concat([0, 1, 2, 3, 4, 5]);
    colH.innerHTML = horas
      .map((h) => `<button type="button" data-h="${h}">${enTexto(h, "00").replace(":00", "")}</button>`)
      .join("");
    colM.innerHTML = MINUTOS.map(
      (m) => `<button type="button" data-m="${m}">:${m}</button>`,
    ).join("");

    function marcar() {
      colH.querySelectorAll("button").forEach((b) =>
        b.classList.toggle("elegido", Number(b.dataset.h) === valor[cual].h),
      );
      colM.querySelectorAll("button").forEach((b) =>
        b.classList.toggle("elegido", b.dataset.m === valor[cual].m),
      );
    }

    boton.addEventListener("click", (e) => {
      e.stopPropagation();
      if (menu.classList.contains("abierto")) return _cerrarAbierto?.();
      marcar();
      abrir(menu, boton);
    });

    colH.addEventListener("click", (e) => {
      const b = e.target.closest("button[data-h]");
      if (!b) return;
      valor[cual].h = Number(b.dataset.h);
      marcar();
      pintarBoton(cual);
      componer();
    });

    colM.addEventListener("click", (e) => {
      const b = e.target.closest("button[data-m]");
      if (!b) return;
      valor[cual].m = b.dataset.m;
      marcar();
      pintarBoton(cual);
      componer();
      // Elegir el minuto es el último paso, así que se cierra solo
      if (valor[cual].h !== null) _cerrarAbierto?.();
    });
  });

  return {
    limpiar: () => {
      valor.desde = { h: null, m: "00" };
      valor.hasta = { h: null, m: "00" };
      pintarBoton("desde");
      pintarBoton("hasta");
      oculto.value = "";
    },
  };
}
