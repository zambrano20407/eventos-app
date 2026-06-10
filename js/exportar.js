/* ============================================================
   exportar.js — Generacion de Excel con SheetJS (sin servidor)
   Usado solo en Firebase Hosting (no en servidor Python local)
   ============================================================ */

// Cargar SheetJS desde CDN
async function cargarSheetJS() {
  if (window.XLSX) return;
  await new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://cdn.sheetjs.com/xlsx-0.20.1/package/dist/xlsx.full.min.js";
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

/* ══════════════════════════════════════════
   EXPORTAR PTFT38 CON SHEETJS
   Genera un Excel con los registros del evento
   compatible con el formato PTFT38
══════════════════════════════════════════ */
export async function exportarPTFT38(evento, registros) {
  await cargarSheetJS();
  const XLSX = window.XLSX;

  // ── Crear libro y hoja ──
  const wb = XLSX.utils.book_new();
  const ws = {};

  // ── Estilos de celda reutilizables ──
  const estEncabezado = {
    font: { bold: true, sz: 10, color: { rgb: "FFFFFF" } },
    fill: { fgColor: { rgb: "0B2252" } },
    alignment: { horizontal: "center", vertical: "center", wrapText: true },
    border: {
      top:    { style: "thin", color: { rgb: "CCCCCC" } },
      bottom: { style: "thin", color: { rgb: "CCCCCC" } },
      left:   { style: "thin", color: { rgb: "CCCCCC" } },
      right:  { style: "thin", color: { rgb: "CCCCCC" } },
    }
  };
  const estTitulo = {
    font: { bold: true, sz: 13, color: { rgb: "0B2252" } },
    alignment: { horizontal: "center", vertical: "center" }
  };
  const estMeta = {
    font: { bold: true, sz: 9, color: { rgb: "333333" } },
    fill: { fgColor: { rgb: "F2F5FB" } },
    alignment: { horizontal: "left", vertical: "center", wrapText: true },
    border: {
      top:    { style: "thin", color: { rgb: "CCCCCC" } },
      bottom: { style: "thin", color: { rgb: "CCCCCC" } },
      left:   { style: "thin", color: { rgb: "CCCCCC" } },
      right:  { style: "thin", color: { rgb: "CCCCCC" } },
    }
  };
  const estDato = {
    font: { sz: 9 },
    alignment: { horizontal: "center", vertical: "center", wrapText: true },
    border: {
      top:    { style: "thin", color: { rgb: "DDDDDD" } },
      bottom: { style: "thin", color: { rgb: "DDDDDD" } },
      left:   { style: "thin", color: { rgb: "DDDDDD" } },
      right:  { style: "thin", color: { rgb: "DDDDDD" } },
    }
  };
  const estDatoNombre = { ...estDato, alignment: { horizontal: "left", vertical: "center", wrapText: true } };

  function cel(v, s) { return { v, s, t: typeof v === "number" ? "n" : "s" }; }

  // ── Fila 1: Título institucional ──
  ws["A1"] = cel("REGISTRADURÍA NACIONAL DEL ESTADO CIVIL", estTitulo);
  ws["A2"] = cel("Delegación Departamental Caquetá — Permanencia del Talento Humano", {
    font: { sz: 10, color: { rgb: "555555" } },
    alignment: { horizontal: "center", vertical: "center" }
  });

  // ── Fila 3: vacía ──

  // ── Filas 4-6: Datos del evento ──
  ws["A4"] = cel("Formato:", estMeta);
  ws["B4"] = cel("PTFT38 — Registro de Asistencia a Evento de Capacitación", estMeta);
  ws["A5"] = cel("Nombre del curso:", estMeta);
  ws["B5"] = cel(evento?.nombre || "", estMeta);
  ws["A6"] = cel("Institución que dicta:", estMeta);
  ws["B6"] = cel(evento?.institucion || "", estMeta);
  ws["A7"] = cel("Fecha:", estMeta);
  ws["B7"] = cel(evento?.fecha || "", estMeta);
  ws["A8"] = cel("Jornada:", estMeta);
  ws["B8"] = cel(evento?.jornada || "", estMeta);
  ws["A9"] = cel("Total participantes:", estMeta);
  ws["B9"] = cel(registros.length, { ...estMeta, font: { bold: true, sz: 10, color: { rgb: "0B2252" } } });

  // ── Fila 10: vacía ──

  // ── Fila 11: Encabezados de tabla ──
  const cols = ["No.", "Cédula", "Nombres y Apellidos", "Dependencia", "Sexo", "Nivel del Cargo", "Hora de Registro", "Firma Digital"];
  cols.forEach((col, i) => {
    const addr = XLSX.utils.encode_cell({ r: 10, c: i });
    ws[addr] = cel(col, estEncabezado);
  });

  // ── Filas 12+: Registros ──
  registros.forEach((reg, i) => {
    const r = 11 + i;
    const hora = reg.creadoEn?.toDate
      ? reg.creadoEn.toDate().toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })
      : reg.timestamp || "";

    ws[XLSX.utils.encode_cell({ r, c: 0 })] = cel(i + 1, estDato);
    ws[XLSX.utils.encode_cell({ r, c: 1 })] = cel(reg.cedula || "", estDato);
    ws[XLSX.utils.encode_cell({ r, c: 2 })] = cel(reg.nombre || "", estDatoNombre);
    ws[XLSX.utils.encode_cell({ r, c: 3 })] = cel(reg.dependencia || "", estDatoNombre);
    ws[XLSX.utils.encode_cell({ r, c: 4 })] = cel((reg.sexo || "").charAt(0).toUpperCase(), estDato);
    ws[XLSX.utils.encode_cell({ r, c: 5 })] = cel(reg.nivel || "", estDato);
    ws[XLSX.utils.encode_cell({ r, c: 6 })] = cel(hora, estDato);
    ws[XLSX.utils.encode_cell({ r, c: 7 })] = cel("(ver sistema)", {
      ...estDato,
      font: { sz: 8, italic: true, color: { rgb: "999999" } }
    });
  });

  // ── Rango de la hoja ──
  const lastRow = 11 + registros.length;
  ws["!ref"] = `A1:H${lastRow}`;

  // ── Anchos de columna ──
  ws["!cols"] = [
    { wch: 5 },   // No.
    { wch: 14 },  // Cédula
    { wch: 32 },  // Nombres
    { wch: 36 },  // Dependencia
    { wch: 6 },   // Sexo
    { wch: 14 },  // Nivel
    { wch: 16 },  // Hora
    { wch: 14 },  // Firma
  ];

  // ── Altos de fila ──
  ws["!rows"] = [
    { hpt: 22 }, { hpt: 16 }, { hpt: 6 },
    { hpt: 14 }, { hpt: 14 }, { hpt: 14 },
    { hpt: 14 }, { hpt: 14 }, { hpt: 14 },
    { hpt: 6  }, { hpt: 22 },
    ...Array(registros.length).fill({ hpt: 18 })
  ];

  // ── Combinar celdas de título ──
  ws["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 7 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 7 } },
    { s: { r: 3, c: 1 }, e: { r: 3, c: 7 } },
    { s: { r: 4, c: 1 }, e: { r: 4, c: 7 } },
    { s: { r: 5, c: 1 }, e: { r: 5, c: 7 } },
    { s: { r: 6, c: 1 }, e: { r: 6, c: 7 } },
    { s: { r: 7, c: 1 }, e: { r: 7, c: 7 } },
    { s: { r: 8, c: 1 }, e: { r: 8, c: 7 } },
  ];

  XLSX.utils.book_append_sheet(wb, ws, "Asistencia");

  // ── Descargar ──
  const nombreArchivo = `PTFT38_${(evento?.nombre || "Evento").replace(/\s+/g, "_")}_${new Date().toLocaleDateString("es-CO").replace(/\//g, "-")}.xlsx`;
  XLSX.writeFile(wb, nombreArchivo);
}
