/* ============================================================
   exportar-pdf.js — Generacion de PDF de los formatos oficiales
   Dibuja el formato directamente con jsPDF, segun el que use el evento:
   PTFT38 vertical con 25 filas por pagina, SGFT07 horizontal con 23,
   cada uno con su encabezado, su tabla y sus firmas.
   ============================================================ */

import { siglaSexo } from "./sexo.js";
import { formatoDe } from "./formatos.js";

const FILAS_POR_PAGINA = 25;

async function cargarJsPDF() {
  if (window.jspdf?.jsPDF) return;
  await new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/jspdf@2.5.2/dist/jspdf.umd.min.js";
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

/* ── Cargar el logo institucional ──
   Se devuelven también sus dimensiones reales: dibujarlo con un tamaño
   fijo lo deformaba. La imagen mide 641 x 411 px y se estaba estirando
   a una proporción de 4:1. */
async function cargarLogo() {
  try {
    const resp = await fetch("/img/LogoFormato.jpg");
    const blob = await resp.blob();
    const dataURL = await new Promise((resolve) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = () => resolve(null);
      r.readAsDataURL(blob);
    });
    if (!dataURL) return null;

    const medidas = await new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
      img.onerror = () => resolve(null);
      img.src = dataURL;
    });
    return { dataURL, ...(medidas || { w: 641, h: 411 }) };
  } catch {
    return null;
  }
}

/* Encaja una imagen dentro de un recuadro sin deformarla y la centra,
   que es lo que hace Excel al insertarla flotando en la celda. */
function encajarCentrado(imagen, x, y, ancho, alto, margen = 2.5) {
  const dispW = ancho - margen * 2;
  const dispH = alto - margen * 2;
  const escala = Math.min(dispW / imagen.w, dispH / imagen.h);
  const w = imagen.w * escala;
  const h = imagen.h * escala;
  return { x: x + (ancho - w) / 2, y: y + (alto - h) / 2, w, h };
}

export async function exportarPDF(evento, registros) {
  await cargarJsPDF();
  const logo = await cargarLogo();

  // Cada formato tiene su propia hoja: el PTFT38 se imprime vertical y
  // el SGFT07 horizontal, igual que sus plantillas de Excel
  const formato = formatoDe(evento);
  const esReunion = formato.codigo === "SGFT07";
  const porPagina = esReunion ? SGFT07_FILAS : FILAS_POR_PAGINA;

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({
    orientation: esReunion ? "landscape" : "portrait",
    unit: "mm",
    format: "a4",
  });

  const grupos = [];
  for (let i = 0; i < registros.length; i += porPagina) {
    grupos.push(registros.slice(i, i + porPagina));
  }
  if (grupos.length === 0) grupos.push([]);

  grupos.forEach((grupo, idx) => {
    if (idx > 0) doc.addPage();
    if (esReunion) dibujarPaginaSGFT07(doc, evento, grupo, logo);
    else dibujarPagina(doc, evento, grupo, logo);
  });

  doc.save(
    `${formato.codigo}_${(evento?.nombre || "Evento").replace(/\s+/g, "_")}.pdf`,
  );
}

/* ════════════════════════════════════════════════════════════
   SGFT07 — Asistencia a reuniones

   Va en horizontal, como se imprime la plantilla oficial, y con las
   mismas proporciones de columna que tiene el Excel (las anchuras de
   abajo son las del archivo, repartidas sobre el ancho de la hoja).
════════════════════════════════════════════════════════════ */
const SGFT07_FILAS = 23;

// Proporciones tomadas de la plantilla: A | B:D | E | F | G:H | I | J:L | M
const SGFT07_COLS = [
  { t: "Nro.", w: 6.9, campo: null },
  { t: "NOMBRES Y APELLIDOS", w: 87.9, campo: "nombre" },
  { t: "CÉDULA", w: 49.6, campo: "cedula" },
  { t: "CARGO", w: 45.6, campo: "cargo" },
  { t: "ENTIDAD\nY/O DEPENDENCIA", w: 43.3, campo: "dependencia" },
  { t: "TELÉFONO / EXTENSIÓN", w: 36.1, campo: "telefono" },
  { t: "CORREO ELECTRÓNICO", w: 66.8, campo: "correo" },
  { t: "FIRMA", w: 34.0, campo: null },
];

function dibujarPaginaSGFT07(doc, evento, registros, logo) {
  // Márgenes de impresión de la propia plantilla: 0,16" a los lados y
  // 0,20" arriba y abajo
  const MX = 4.1;
  const MY = 5.1;
  const ANCHO = 297; // A4 horizontal
  const ALTO = 210;
  const W = ANCHO - MX * 2;

  /* Altos de fila del Excel, en puntos. Se reparten sobre el alto útil
     de la hoja conservando su proporción: así el PDF se ve como se
     imprime la plantilla, con las filas de datos altas y las franjas
     del encabezado delgadas. */
  const PT = {
    membrete: 18 * 6, // filas 1 a 6
    aprobado: 29.25, // fila 7
    reunion: 45, // fila 8
    blanco1: 13.5, // fila 9
    lugar: 45, // fila 10
    blanco2: 27.95, // fila 11
    cabecera: 56.25, // fila 12
    fila: 54, // filas 13 a 35
  };
  const totalPt =
    PT.membrete + PT.aprobado + PT.reunion + PT.blanco1 + PT.lugar +
    PT.blanco2 + PT.cabecera + PT.fila * SGFT07_FILAS;
  const k = (ALTO - MY * 2) / totalPt; // milímetros por punto
  const mm = (pt) => pt * k;

  let y = MY;
  doc.setDrawColor(0);
  doc.setLineWidth(0.25);

  // Gris de la plantilla, leído del archivo
  const GRIS = [242, 242, 242];

  /* ── MEMBRETE ── */
  const hEnc = mm(PT.membrete);
  const suma = SGFT07_COLS.reduce((s, c) => s + c.w, 0);
  const anchos = SGFT07_COLS.map((c) => (c.w / suma) * W);

  const wLogo = anchos[0] + anchos[1];
  const wEtq = anchos[2] * 0.36;
  const wCod2 = anchos[7];
  const wCod1 = anchos[6] * 0.28;
  const wCentro = W - wLogo - wEtq - wCod1 - wCod2;

  doc.rect(MX, y, W, hEnc);
  let x = MX + wLogo;
  [wEtq, wCentro, wCod1].forEach((ancho) => {
    doc.line(x, y, x, y + hEnc);
    x += ancho;
  });
  doc.line(x, y, x, y + hEnc);
  doc.line(MX + wLogo, y + hEnc / 2, MX + W, y + hEnc / 2);

  if (logo) {
    // Margen pequeño: en la plantilla el escudo ocupa casi toda su celda
    const r = encajarCentrado(logo, MX, y, wLogo, hEnc, 1.2);
    doc.addImage(logo.dataURL, "JPEG", r.x, r.y, r.w, r.h);
  }

  const xEtq = MX + wLogo + wEtq / 2;
  const xCen = MX + wLogo + wEtq + wCentro / 2;
  const xCod1 = MX + wLogo + wEtq + wCentro + wCod1 / 2;
  const xCod2 = MX + wLogo + wEtq + wCentro + wCod1 + wCod2 / 2;
  const arriba = y + hEnc / 4 + 1.1;
  const abajo = y + (hEnc * 3) / 4 + 1.1;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(6);
  doc.text("PROCESO", xEtq, arriba, { align: "center" });
  doc.text("FORMATO", xEtq, abajo, { align: "center" });
  doc.text("CÓDIGO", xCod1, arriba, { align: "center" });
  doc.text("VERSIÓN", xCod1, abajo, { align: "center" });
  doc.text("SGFT07", xCod2, arriba, { align: "center" });
  doc.text("0", xCod2, abajo, { align: "center" });

  // En la plantilla estos dos van en redonda, no en negrita
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.text("SISTEMA DE GESTIÓN Y MEJORAMIENTO INSTITUCIONAL", xCen, arriba, { align: "center" });
  doc.text("ASISTENCIA A REUNIONES", xCen, abajo, { align: "center" });
  y += hEnc;

  /* ── APROBADO ── */
  const hAprob = mm(PT.aprobado);
  doc.rect(MX, y, W, hAprob);
  doc.setFontSize(5);
  doc.text("Aprobado: 15/11/2017", MX + W - 2, y + hAprob / 2 + 0.8, { align: "right" });
  y += hAprob;

  /* ── REUNIÓN / FECHA · franja en blanco · LUGAR / HORARIO ── */
  const wIzq = W * 0.55;
  const datos = [
    [PT.reunion, ["REUNIÓN:", evento?.nombre], ["FECHA:", evento?.fecha]],
    [PT.blanco1, null, null],
    [PT.lugar, ["LUGAR:", evento?.institucion], ["HORARIO:", evento?.horario || evento?.jornada]],
    [PT.blanco2, null, null],
  ];

  datos.forEach(([alto, izq, der]) => {
    const h = mm(alto);
    if (izq) {
      doc.setFillColor(...GRIS);
      doc.rect(MX, y, W, h, "FD");
      doc.line(MX + wIzq, y, MX + wIzq, y + h);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.text(`${izq[0]}  ${izq[1] || ""}`, MX + 2.5, y + h / 2 + 1, { maxWidth: wIzq - 5 });
      doc.text(`${der[0]}  ${der[1] || ""}`, MX + wIzq + 2.5, y + h / 2 + 1, {
        maxWidth: W - wIzq - 5,
      });
    } else {
      // Fila en blanco de la plantilla: solo el marco
      doc.rect(MX, y, W, h);
    }
    y += h;
  });

  /* ── CABECERA DE LA TABLA ── */
  const hCab = mm(PT.cabecera);
  const xs = [];
  let acum = MX;
  anchos.forEach((a) => {
    xs.push(acum);
    acum += a;
  });

  doc.setFillColor(...GRIS);
  doc.rect(MX, y, W, hCab, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(5.5);
  SGFT07_COLS.forEach((col, i) => {
    if (i > 0) doc.line(xs[i], y, xs[i], y + hCab);
    const lineas = col.t.split("\n");
    const inicio = y + hCab / 2 + 0.9 - (lineas.length - 1) * 1.3;
    lineas.forEach((linea, j) => {
      doc.text(linea, xs[i] + anchos[i] / 2, inicio + j * 2.6, { align: "center" });
    });
  });
  y += hCab;

  /* ── FILAS ── */
  const hFila = mm(PT.fila);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(5.5);

  for (let f = 0; f < SGFT07_FILAS; f++) {
    const reg = registros[f];
    doc.rect(MX, y, W, hFila);
    SGFT07_COLS.forEach((col, i) => {
      if (i > 0) doc.line(xs[i], y, xs[i], y + hFila);
    });

    if (reg) {
      doc.text(String(f + 1), xs[0] + anchos[0] / 2, y + hFila / 2 + 1, { align: "center" });
      SGFT07_COLS.forEach((col, i) => {
        if (!col.campo) return;
        let texto = String(reg[col.campo] || "");
        if (!texto) return;
        // El formato imprime una sola línea por asistente
        const disponible = anchos[i] - 2;
        while (texto && doc.getTextWidth(texto) > disponible) texto = texto.slice(0, -1);
        doc.text(texto, xs[i] + anchos[i] / 2, y + hFila / 2 + 1, { align: "center" });
      });

      const firma = reg.firma || "";
      if (firma.startsWith("data:image")) {
        try {
          doc.addImage(firma, "PNG", xs[7] + 2, y + 0.5, anchos[7] - 4, hFila - 1);
        } catch (e) {
          /* firma ilegible: la celda queda vacía */
        }
      }
    }
    y += hFila;
  }
}

/* ════════════════════════════════════════════════════════════
   Dibuja UNA pagina completa del formato
════════════════════════════════════════════════════════════ */
function dibujarPagina(doc, evento, registros, logo) {
  const M = 8; // margen
  const W = 210 - M * 2; // ancho util (A4 vertical)
  let y = M;

  doc.setDrawColor(0);
  doc.setLineWidth(0.25);

  /* ── ENCABEZADO: logo | PROCESO/FORMATO | CODIGO/VERSION ── */
  const hEnc = 18;
  const wLogo = 38;
  const wCod1 = 22;
  const wCod2 = 18;
  const wCentro = W - wLogo - wCod1 - wCod2;

  // Marco y divisiones
  doc.rect(M, y, W, hEnc);
  doc.line(M + wLogo, y, M + wLogo, y + hEnc);
  doc.line(M + wLogo + wCentro, y, M + wLogo + wCentro, y + hEnc);
  doc.line(M + wLogo + wCentro + wCod1, y, M + wLogo + wCentro + wCod1, y + hEnc);
  doc.line(M + wLogo, y + hEnc / 2, M + W, y + hEnc / 2);
  // Etiquetas PROCESO / FORMATO en columna propia
  const wEtq = 24;
  doc.line(M + wLogo + wEtq, y, M + wLogo + wEtq, y + hEnc);

  if (logo) {
    // Encajado en su recuadro conservando la proporción, como queda en
    // el Excel: flotando y centrado, no estirado hasta llenar la celda
    const r = encajarCentrado(logo, M, y, wLogo, hEnc);
    doc.addImage(logo.dataURL, "JPEG", r.x, r.y, r.w, r.h);
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.text("PROCESO", M + wLogo + wEtq / 2, y + hEnc / 4 + 1.2, { align: "center" });
  doc.text("FORMATO", M + wLogo + wEtq / 2, y + (hEnc * 3) / 4 + 1.2, { align: "center" });
  doc.text("CÓDIGO", M + wLogo + wCentro + wCod1 / 2, y + hEnc / 4 + 1.2, { align: "center" });
  doc.text("VERSIÓN", M + wLogo + wCentro + wCod1 / 2, y + (hEnc * 3) / 4 + 1.2, { align: "center" });
  doc.text("PTFT38", M + wLogo + wCentro + wCod1 + wCod2 / 2, y + hEnc / 4 + 1.2, { align: "center" });
  doc.text("5", M + wLogo + wCentro + wCod1 + wCod2 / 2, y + (hEnc * 3) / 4 + 1.2, { align: "center" });

  doc.setFontSize(7.5);
  const xCentro = M + wLogo + wEtq + (wCentro - wEtq) / 2;
  doc.text("PERMANENCIA DEL TALENTO HUMANO", xCentro, y + hEnc / 4 + 1.2, { align: "center" });
  doc.text("ASISTENCIA A EVENTOS DE FORMACIÓN / CAPACITACIÓN", xCentro, y + (hEnc * 3) / 4 + 1.2, { align: "center" });

  y += hEnc + 1.5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(5.5);
  doc.text("Aprobado: 30/05/2025", M + W, y, { align: "right" });
  y += 1.5;

  /* ── DESCRIPCION ── */
  const hDesc = 9;
  doc.rect(M, y, W, hDesc);
  doc.setFontSize(7);
  doc.text(
    "Este formato se ha diseñado con la finalidad de registrar los datos de los servidores públicos\nque participan de los eventos de formación / capacitación que se programan en la entidad",
    M + W / 2,
    y + 3.6,
    { align: "center" },
  );
  y += hDesc + 2;

  /* ── INSTITUCION / FECHA / JORNADA ── */
  const hInst = 8;
  const wInst = W * 0.55;
  const wFecha = W * 0.28;
  doc.setFillColor(191, 191, 191);
  doc.rect(M, y, W, hInst, "FD");
  doc.line(M + wInst, y, M + wInst, y + hInst);
  doc.line(M + wInst + wFecha, y, M + wInst + wFecha, y + hInst);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.5);
  doc.text(
    `Institución que dicta el curso / formación / capacitación:  ${evento?.institucion || ""}`,
    M + 2, y + hInst / 2 + 1,
    { maxWidth: wInst - 4 },
  );
  doc.text(`Fecha:  ${evento?.fecha || ""}`, M + wInst + wFecha / 2, y + hInst / 2 + 1, { align: "center" });
  doc.text(`Jornada:  ${evento?.jornada || ""}`, M + wInst + wFecha + 2, y + hInst / 2 + 1);
  y += hInst;

  /* ── NOMBRE DEL CURSO ── */
  const hCurso = 7;
  doc.rect(M, y, W, hCurso);
  doc.text(
    `Nombre del curso / formación / capacitación:  ${evento?.nombre || ""}`,
    M + 2, y + hCurso / 2 + 1,
  );
  y += hCurso + 1.5;

  /* ── TABLA ── */
  // Columnas (mm): No | Cedula | Nombre | Dependencia | Sexo | 5 niveles | Grupo | Firma
  const cols = [
    { t: "No.",        w: 7 },
    { t: "Nro. Cédula", w: 20 },
    { t: "Nombres y apellidos", w: 40 },
    { t: "Dependencia", w: 28 },
    { t: "Sexo",       w: 9 },
    { t: "Directivo",  w: 11 },
    { t: "Asesor",     w: 11 },
    { t: "Profesional", w: 11 },
    { t: "Técnico",    w: 11 },
    { t: "Asistencial", w: 11 },
    { t: "Grupo*",     w: 9 },
    { t: "Firma",      w: W - (7 + 20 + 40 + 28 + 9 + 11 * 5 + 9) },
  ];

  // Encabezado de tabla (2 niveles: "Nivel del cargo" agrupa las 5)
  const hCab1 = 5, hCab2 = 5;
  const xNivIni = M + cols.slice(0, 5).reduce((a, c) => a + c.w, 0);
  const wNiv = 11 * 5;

  doc.setFillColor(191, 191, 191);
  // fila 1 de cabecera
  let x = M;
  cols.forEach((c, i) => {
    if (i >= 5 && i <= 9) return; // los niveles van en fila 2
    doc.rect(x, y, c.w, hCab1 + hCab2, "FD");
    x += c.w;
    if (i === 4) x += wNiv;
  });
  doc.rect(xNivIni, y, wNiv, hCab1, "FD");
  doc.setFontSize(6.5);
  doc.text("Nivel del cargo ( Marque con una X )", xNivIni + wNiv / 2, y + hCab1 / 2 + 1, { align: "center" });
  // fila 2: nombres de niveles (letra mas pequeña, columnas angostas)
  // OJO: text() deja el color de relleno en negro internamente,
  // hay que volver a declarar el gris antes de los rectangulos
  x = xNivIni;
  doc.setFontSize(5);
  for (let i = 5; i <= 9; i++) {
    doc.setFillColor(191, 191, 191);
    doc.rect(x, y + hCab1, cols[i].w, hCab2, "FD");
    doc.text(cols[i].t, x + cols[i].w / 2, y + hCab1 + hCab2 / 2 + 1, { align: "center" });
    x += cols[i].w;
  }
  doc.setFontSize(6.5);
  // titulos fila 1
  x = M;
  cols.forEach((c, i) => {
    if (i >= 5 && i <= 9) { x += 0; return; }
    doc.text(c.t, x + c.w / 2, y + (hCab1 + hCab2) / 2 + 1, { align: "center" });
    x += c.w;
    if (i === 4) x += wNiv;
  });
  y += hCab1 + hCab2;

  /* ── FILAS DE DATOS ── */
  const hFila = 7.4; // mas alto: en vertical sobra espacio y las firmas respiran
  doc.setFont("helvetica", "normal");

  for (let f = 0; f < FILAS_POR_PAGINA; f++) {
    const reg = registros[f];
    x = M;
    cols.forEach((c) => {
      doc.rect(x, y, c.w, hFila);
      x += c.w;
    });

    doc.setFontSize(6.5);
    doc.text(String(f + 1), M + cols[0].w / 2, y + hFila / 2 + 1, { align: "center" });

    if (reg) {
      const nivel = (reg.nivel || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
      const xs = [];
      let acc = M;
      cols.forEach((c) => { xs.push(acc); acc += c.w; });

      doc.text(String(reg.cedula || ""), xs[1] + cols[1].w / 2, y + hFila / 2 + 1, { align: "center" });

      // Nombre y dependencia: partir en lineas y centrar el bloque
      // verticalmente (si son 2 lineas, subir media linea, etc.)
      const escribirCentrado = (texto, colIdx, tamano) => {
        doc.setFontSize(tamano);
        const lineas = doc.splitTextToSize(texto, cols[colIdx].w - 2);
        const altoLinea = tamano * 0.42; // alto aprox de linea en mm
        doc.text(
          lineas,
          xs[colIdx] + cols[colIdx].w / 2,
          y + hFila / 2 + 1 - ((lineas.length - 1) * altoLinea) / 2,
          { align: "center" },
        );
      };
      escribirCentrado(reg.nombre || "", 2, 6);
      escribirCentrado(reg.dependencia || "", 3, 5.5);

      doc.setFontSize(6.5);
      doc.text(siglaSexo(reg), xs[4] + cols[4].w / 2, y + hFila / 2 + 1, { align: "center" });

      const marcas = ["directivo", "asesor", "profesional", "tecnico", "asistencial"];
      marcas.forEach((niv, i) => {
        if (nivel === niv) {
          doc.text("X", xs[5 + i] + cols[5 + i].w / 2, y + hFila / 2 + 1, { align: "center" });
        }
      });

      // Firma (imagen)
      const firma = reg.firma || "";
      if (firma.startsWith("data:image")) {
        try {
          doc.addImage(firma, "PNG", xs[11] + 2, y + 0.4, cols[11].w - 4, hFila - 0.8);
        } catch (e) {
          /* firma ilegible: celda queda vacia */
        }
      }
    }
    y += hFila;
  }

  /* ── NOTA ── */
  const hNota = 5.5;
  doc.rect(M, y, W, hNota);
  doc.setFontSize(6.5);
  doc.text(
    'Nota: *La columna "Grupo", se diligencia cuando exista más de 1 grupo de formación / capacitación en la misma fecha.',
    M + W / 2, y + hNota / 2 + 1, { align: "center" },
  );
  y += hNota;

  /* ── RAYA Y FIRMA RESPONSABLE ──
     Se ancla al pie de la hoja en vez de ir pegada a la tabla: con 25
     filas quedaba en el milímetro 266 de 297 y abajo sobraban más de
     dos centímetros en blanco. El máximo conserva una separación
     mínima por si alguna vez la tabla llega más abajo. */
  const ALTO = 297; // A4 vertical
  y = Math.max(y + 9, ALTO - M - 12);

  doc.setLineWidth(0.4);
  doc.line(M + 22, y, M + W - 22, y);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.text(
    "FIRMA RESPONSABLE DEL MACROPROCESO / REGISTRADORES DISTRITALES / DELEGADOS DEPARTAMENTALES",
    M + W / 2, y + 4, { align: "center" },
  );
}
