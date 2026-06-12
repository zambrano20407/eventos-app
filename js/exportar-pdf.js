/* ============================================================
   exportar-pdf.js — Generacion de PDF del formato PTFT38
   Dibuja el formato institucional directamente (jsPDF):
   encabezado, tabla de 25 filas por pagina, firmas y pie.
   ============================================================ */

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

/* ── Cargar el logo institucional como dataURL ── */
async function cargarLogo() {
  try {
    const resp = await fetch("/img/LogoFormato.jpg");
    const blob = await resp.blob();
    return await new Promise((resolve) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = () => resolve(null);
      r.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export async function exportarPDF(evento, registros) {
  await cargarJsPDF();
  const logo = await cargarLogo();

  const { jsPDF } = window.jspdf;
  // A4 vertical: 210 x 297 mm
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  // Partir registros en paginas de 25
  const grupos = [];
  for (let i = 0; i < registros.length; i += FILAS_POR_PAGINA) {
    grupos.push(registros.slice(i, i + FILAS_POR_PAGINA));
  }
  if (grupos.length === 0) grupos.push([]);

  grupos.forEach((grupo, idx) => {
    if (idx > 0) doc.addPage();
    dibujarPagina(doc, evento, grupo, logo);
  });

  doc.save(`PTFT38_${(evento?.nombre || "Evento").replace(/\s+/g, "_")}.pdf`);
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
    // Logo centrado en su recuadro (proporcion ~5.32 x 1.32 cm -> 30 x 7.5 mm)
    doc.addImage(logo, "JPEG", M + 4, y + 5.2, 30, 7.5);
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
      doc.text((reg.sexo || "M")[0].toUpperCase(), xs[4] + cols[4].w / 2, y + hFila / 2 + 1, { align: "center" });

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
  y += hNota + 9;

  /* ── RAYA Y FIRMA RESPONSABLE ── */
  doc.setLineWidth(0.4);
  doc.line(M + 22, y, M + W - 22, y);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.text(
    "FIRMA RESPONSABLE DEL MACROPROCESO / REGISTRADORES DISTRITALES / DELEGADOS DEPARTAMENTALES",
    M + W / 2, y + 4, { align: "center" },
  );
}
