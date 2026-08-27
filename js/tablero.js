import { sedeCorta } from "./sedes.js";

/* ══════════════════════════════════════════
   tablero.js — Gráficos del tablero de estadísticas

   Módulo puro: recibe arreglos de eventos y registros y dibuja.
   No conoce Firebase ni la sesión, así que puede reutilizarse
   (por ejemplo en la página de muestra con datos de ejemplo).
══════════════════════════════════════════ */

// Municipios del departamento, para medir la cobertura territorial
export const MUNICIPIOS_CAQUETA = [
  "Florencia", "Albania", "Belén de los Andaquíes", "Cartagena del Chairá",
  "Curillo", "El Doncello", "El Paujil", "La Montañita", "Milán",
  "Morelia", "Puerto Rico", "San José del Fragua", "San Vicente del Caguán",
  "Solano", "Solita", "Valparaíso",
];

// Paleta verificada para daltonismo y contraste (ver css/admin.css).
// El amarillo institucional no entra: sobre blanco no se distingue.
export const COLORES_GRAF = ["#1455a4", "#009aad", "#c08a00", "#6b4fa8", "#00a064", "#c0392b"];

/* Cuenta cuantas veces aparece cada valor, de mayor a menor */
function contarPor(registros, campo) {
  const cuenta = {};
  registros.forEach((r) => {
    const clave = (r[campo] || "Sin especificar").toString().trim();
    cuenta[clave] = (cuenta[clave] || 0) + 1;
  });
  return Object.entries(cuenta).sort((a, b) => b[1] - a[1]);
}

/* Deja solo el municipio de una dependencia. Todas las registradurías
   empiezan con el mismo prefijo, así que en una etiqueta corta lo único
   que distingue una de otra es lo que va después. */
function nombreCorto(dependencia) {
  return (dependencia || "")
    .replace(/^Registradur[íi]a\s+(Municipal|Especial|Auxiliar)\s+de\s+/i, "")
    .replace(/^Delegaci[óo]n\s+Departamental\s+(de\s+)?/i, "Delegación ")
    .trim();
}

/* Barras horizontales. El valor va escrito al lado de cada barra para
   que el dato exacto se lea sin depender del color ni del largo. */
function pintarBarras(contenedor, datos, color) {
  const caja = document.getElementById(contenedor);
  if (!caja) return;
  if (!datos.length) {
    caja.innerHTML = '<p class="graf-vacio">Sin datos para mostrar.</p>';
    return;
  }
  const mayor = datos[0][1] || 1;
  caja.innerHTML = datos
    .map(([etiqueta, n, completo]) => {
      const ancho = Math.max(3, Math.round((n / mayor) * 100));
      const tono = typeof color === "function" ? color(etiqueta) : color;
      // Si la etiqueta viene acortada, el tooltip conserva el nombre entero
      return `<div class="graf-fila" title="${completo || etiqueta}: ${n}">
        <span class="etq">${etiqueta}</span>
        <span class="pista"><span class="barra" style="width:${ancho}%;background:${tono}"></span></span>
        <span class="val">${n}</span>
      </div>`;
    })
    .join("");
}

/* Dona con leyenda. La leyenda siempre acompaña al grafico: asi la
   identidad de cada porcion no depende unicamente del color. */
function pintarDona(contenedor, datos) {
  const caja = document.getElementById(contenedor);
  if (!caja) return;
  const total = datos.reduce((s, [, n]) => s + n, 0);
  if (!total) {
    caja.innerHTML = '<p class="graf-vacio">Sin datos para mostrar.</p>';
    return;
  }
  let acumulado = 0;
  const anillos = datos
    .map(([etiqueta, n], i) => {
      const porcentaje = (n / total) * 100;
      // El 25 inicial hace que el primer tramo arranque arriba;
      // se le resta lo ya dibujado para encadenar los siguientes
      const desfase = 25 - acumulado;
      acumulado += porcentaje;
      return `<circle cx="21" cy="21" r="15.9" fill="none"
        stroke="${COLORES_GRAF[i % COLORES_GRAF.length]}" stroke-width="7"
        stroke-dasharray="${porcentaje.toFixed(1)} ${(100 - porcentaje).toFixed(1)}"
        stroke-dashoffset="${desfase.toFixed(1)}"><title>${etiqueta}: ${n}</title></circle>`;
    })
    .join("");
  const leyenda = datos
    .map(
      ([etiqueta, n], i) =>
        `<span><i class="dona-punto" style="background:${COLORES_GRAF[i % COLORES_GRAF.length]}"></i>
         ${etiqueta} · <strong>${n}</strong> (${Math.round((n / total) * 100)}%)</span>`,
    )
    .join("");
  caja.innerHTML = `<svg width="104" height="104" viewBox="0 0 42 42" role="img"
      aria-label="Distribución por nivel del cargo">${anillos}</svg>
    <div class="dona-leyenda">${leyenda}</div>`;
}

/* Participación por sexo, con icono y cifras en vez de barras. Son dos
   categorías nada más: la barra no aportaba comparación y el icono se
   lee de un vistazo. El número y el porcentaje van escritos, así que la
   identidad no depende del color. */
const ICONO_SEXO = {
  f: `<path d="M12 3a5 5 0 1 1 0 10 5 5 0 0 1 0-10z"/><line x1="12" y1="13" x2="12" y2="21"/><line x1="9" y1="18" x2="15" y2="18"/>`,
  m: `<circle cx="10" cy="14" r="5"/><line x1="14" y1="10" x2="20" y2="4"/><polyline points="15,4 20,4 20,9"/>`,
};

function pintarSexo(datos) {
  const caja = document.getElementById("grafSexo");
  if (!caja) return;
  const total = datos.reduce((s, [, n]) => s + n, 0);
  if (!total) {
    caja.innerHTML = '<p class="graf-vacio">Sin datos para mostrar.</p>';
    return;
  }
  caja.innerHTML = datos
    .map(([etiqueta, n]) => {
      const esF = etiqueta.toLowerCase().startsWith("f");
      const clase = esF ? "sx-f" : "sx-m";
      const pct = Math.round((n / total) * 100);
      return `<div class="sexo-item ${clase}">
        <div class="sexo-ico">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
            stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            ${esF ? ICONO_SEXO.f : ICONO_SEXO.m}
          </svg>
        </div>
        <div class="sexo-txt">
          <span class="sexo-nombre">${etiqueta}</span>
          <b class="sexo-pct">${pct}%</b>
          <span class="sexo-n">${n} asistente${n === 1 ? "" : "s"}</span>
        </div>
      </div>`;
    })
    .join("");
}

/* Municipios con asistentes, deducidos del nombre de la dependencia */
function municipiosCubiertos(registros) {
  const cubiertos = new Set();
  registros.forEach((r) => {
    const dep = r.dependencia || "";
    const m = dep.match(/^Registraduría Municipal de (.+)$/);
    if (m) cubiertos.add(m[1].trim());
    else if (dep.includes("Florencia") || dep.startsWith("Delegación")) {
      cubiertos.add("Florencia");
    }
  });
  return cubiertos;
}

function pintarCobertura(registros) {
  const cubiertos = municipiosCubiertos(registros);
  const n = cubiertos.size;
  document.getElementById("coberturaResumen").innerHTML =
    `<strong>${n}</strong> de ${MUNICIPIOS_CAQUETA.length} municipios con asistentes ` +
    `(${Math.round((n / MUNICIPIOS_CAQUETA.length) * 100)}%). Los grises aún no han participado.`;
  document.getElementById("grafCobertura").innerHTML = MUNICIPIOS_CAQUETA.map((mun) => {
    const tiene = cubiertos.has(mun);
    return `<span class="mun-chip ${tiene ? "con" : ""}">${mun}${tiene ? " ✓" : ""}</span>`;
  }).join("");
}

/* ── Cumplimiento de la convocatoria ──

   Solo entran los eventos que tienen convocatoria cargada. Promediar
   con los que no la tienen daría una cifra inventada: en esos no se
   sabe cuánta gente debía llegar. */
function pintarCumplimiento(eventos, registros) {
  const panel = document.getElementById("panelCumplimiento");
  if (!panel) return;

  const conConvocatoria = eventos.filter(
    (e) => (e.convocaSedes || []).length || (e.convocados || []).length,
  );

  if (!conConvocatoria.length) {
    panel.style.display = "none";
    return;
  }
  panel.style.display = "block";

  // Cuántas veces se citó cada sede y cuántas respondió. Es el dato que
  // permite decir "Solano faltó a 4 de 5 reuniones".
  const citadas = {};
  const respondieron = {};
  let sumaPorcentajes = 0;

  conConvocatoria.forEach((ev) => {
    const delEvento = registros.filter((r) => r.eventoId === ev.id);
    const sedes = ev.convocaSedes || [];

    if (sedes.length) {
      const presentes = new Set(delEvento.map((r) => (r.dependencia || "").trim()));
      sedes.forEach((s) => {
        citadas[s] = (citadas[s] || 0) + 1;
        if (presentes.has(s)) respondieron[s] = (respondieron[s] || 0) + 1;
      });
      sumaPorcentajes += sedes.filter((s) => presentes.has(s)).length / sedes.length;
    } else {
      // Evento con lista nominal: aporta al promedio general, pero no
      // al conteo por sede, porque ahí la unidad es la persona
      const asistieron = new Set(delEvento.map((r) => String(r.cedula).trim()));
      const total = ev.convocados.length;
      sumaPorcentajes +=
        ev.convocados.filter((c) => asistieron.has(c.cedula)).length / total;
    }
  });

  const promedio = Math.round((sumaPorcentajes / conConvocatoria.length) * 100);
  document.getElementById("cumpPorcentaje").textContent = `${promedio}%`;
  document.getElementById("cumpNota").innerHTML =
    `Promedio de cumplimiento sobre <strong>${conConvocatoria.length}</strong> ` +
    `evento(s) con convocatoria cargada, de ${eventos.length} en total. ` +
    `Los eventos sin convocatoria no entran en este cálculo.`;

  // Ranking de inasistencia: la sede que más veces fue citada y no fue
  const ranking = Object.keys(citadas)
    .map((sede) => {
      const veces = citadas[sede];
      const fue = respondieron[sede] || 0;
      return [sedeCorta(sede), veces - fue, sede, veces];
    })
    .filter(([, faltas]) => faltas > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  const caja = document.getElementById("grafInasistencia");
  if (!ranking.length) {
    caja.innerHTML =
      '<p class="graf-vacio">Todas las sedes citadas asistieron. Sin inasistencias.</p>';
    return;
  }
  const mayor = ranking[0][1];
  caja.innerHTML = ranking
    .map(([corto, faltas, completo, veces]) => {
      const ancho = Math.max(6, Math.round((faltas / mayor) * 100));
      return `<div class="graf-fila" title="${completo}: faltó a ${faltas} de ${veces} convocatorias">
        <span class="etq">${corto}</span>
        <span class="pista"><span class="barra" style="width:${ancho}%;background:#c0392b"></span></span>
        <span class="val">${faltas}/${veces}</span>
      </div>`;
    })
    .join("");
}

/* Dibuja el tablero completo. `evId` vacío significa "todos los eventos". */
export function pintarTablero(todosEventos, todosRegistros, evId) {
  const registros = evId
    ? todosRegistros.filter((r) => r.eventoId === evId)
    : todosRegistros;
  const eventos = evId ? todosEventos.filter((e) => e.id === evId) : todosEventos;

  // ── Tarjetas ──
  document.getElementById("statEventos").textContent = eventos.length;
  document.getElementById("statTotal").textContent = registros.length;
  document.getElementById("statPromedio").textContent = eventos.length
    ? Math.round(registros.length / eventos.length)
    : 0;
  document.getElementById("statMunicipios").textContent =
    `${municipiosCubiertos(registros).size}/${MUNICIPIOS_CAQUETA.length}`;

  // ── Gráficos ──
  // En la barra solo cabe el municipio: con el nombre completo todas
  // empiezan igual ("Registraduría Munic...") y no se distinguen.
  // El nombre entero sigue en el tooltip y en la tabla de detalle.
  const porDependencia = contarPor(registros, "dependencia")
    .slice(0, 8)
    .map(([dep, n]) => [nombreCorto(dep), n, dep]);
  pintarBarras("grafDependencia", porDependencia, "#1455a4");
  pintarDona("grafNivel", contarPor(registros, "nivel"));
  pintarSexo(contarPor(registros, "sexo"));

  // Comparar eventos solo tiene sentido viendo el conjunto
  const verTodos = !evId;
  document.getElementById("panelGrafEvento").style.display = verTodos ? "block" : "none";
  if (verTodos) {
    pintarBarras("grafEvento", contarPor(registros, "eventoNombre").slice(0, 8), "#00a064");
  }

  pintarCobertura(registros);
  pintarCumplimiento(eventos, registros);

  // ── Tablas de detalle (el valor exacto se lee mejor en tabla) ──
  const total = registros.length || 1;
  const fila = (etq, n, badge) =>
    `<tr><td>${badge ? `<span class="nivel-badge">${etq}</span>` : etq}</td>` +
    `<td style="font-weight:600">${n}</td><td>${Math.round((n / total) * 100)}%</td></tr>`;
  const vacio = '<tr><td colspan="3" class="sin-datos">Sin datos.</td></tr>';

  document.getElementById("statDepTabla").innerHTML =
    contarPor(registros, "dependencia").map(([d, n]) => fila(d, n)).join("") || vacio;
  document.getElementById("statNivelTabla").innerHTML =
    contarPor(registros, "nivel").map(([niv, n]) => fila(niv, n, true)).join("") || vacio;
}

