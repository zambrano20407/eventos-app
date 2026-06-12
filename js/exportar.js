/* ============================================================
   exportar.js — Generacion de Excel con ExcelJS (sin servidor)
   Usa la plantilla PTFT38 limpia y replica exactamente
   el comportamiento del servidor Python con firmas digitales.
   Si hay mas de 25 registros, crea una hoja por cada grupo de 25.
   ============================================================ */

const REGISTROS_POR_HOJA = 25;

async function cargarExcelJS() {
  if (window.ExcelJS) return;
  await new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js";
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

/* ── Estilo institucional de las celdas de datos ──
   Arial 22, centrado y con ajuste de texto, igual que
   los ajustes que se hacian a mano despues de descargar */
const FUENTE_DATOS = { name: "Arial", size: 22 };
const CENTRADO = {
  horizontal: "center",
  vertical: "middle",
  wrapText: true,
};

/* ── Llena UNA hoja con el encabezado, logo y hasta 25 registros ──
   El logo solo se agrega en hojas clonadas: la primera hoja ya lo
   trae embebido en la plantilla (agregarlo de nuevo lo duplicaba) ── */
function llenarHoja(wb, ws, evento, registros, logoBase64, esClon) {
  if (esClon && logoBase64) {
    const logoId = wb.addImage({ base64: logoBase64, extension: "jpeg" });
    // 5.32 cm x 1.32 cm ≈ 201 x 50 px (96 dpi), igual al ajuste manual
    ws.addImage(logoId, {
      tl:  { col: 1, row: 1 },
      ext: { width: 201, height: 50 },
      editAs: "oneCell",
    });
  }

  // ── Llenar encabezado igual que Python ──
  ws.getCell("B9").value  = `Institucion que dicta el curso / formacion / capacitacion:  ${evento?.institucion || ""}`;
  ws.getCell("I9").value  = `Fecha:  ${evento?.fecha || ""}`;
  ws.getCell("O9").value  = `Jornada:  ${evento?.jornada || ""}`;
  ws.getCell("B10").value = `Nombre del curso / formacion / capacitacion:  ${evento?.nombre || ""}`;

  // ── Limpiar filas de datos (igual que Python) ──
  for (let fila = 13; fila <= 37; fila++) {
    [3, 5, 7, 8, 9, 10, 11, 12, 13, 15].forEach((col) => {
      ws.getCell(fila, col).value = null;
    });
  }

  // ── Llenar registros (máximo 25 por hoja) ──
  let conFirma = 0;

  for (let i = 0; i < registros.length; i++) {
    const reg  = registros[i];
    const fila = 13 + i;
    // Normalizar: quitar acentos y pasar a minúsculas para comparar
    const nivel = (reg.nivel || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "");

    ws.getCell(fila, 3).value  = reg.cedula     || "";
    ws.getCell(fila, 5).value  = reg.nombre      || "";
    ws.getCell(fila, 7).value  = reg.dependencia || "";
    ws.getCell(fila, 8).value  = (reg.sexo || "M")[0].toUpperCase();
    ws.getCell(fila, 9).value  = nivel === "directivo"   ? "X" : "";
    ws.getCell(fila, 10).value = nivel === "asesor"       ? "X" : "";
    ws.getCell(fila, 11).value = nivel === "profesional"  ? "X" : "";
    ws.getCell(fila, 12).value = nivel === "tecnico"      ? "X" : "";
    ws.getCell(fila, 13).value = nivel === "asistencial"  ? "X" : "";

    // Aplicar Arial 22 centrado con ajuste de texto a nombre,
    // dependencia, sexo y las X del nivel del cargo
    [5, 7, 8, 9, 10, 11, 12, 13].forEach((col) => {
      const celda = ws.getCell(fila, col);
      celda.font = FUENTE_DATOS;
      celda.alignment = CENTRADO;
    });

    // ── Insertar firma dentro de su celda (columna O) ──
    // (la linea de firma responsable se asegura al final de la hoja)
    const firma = reg.firma || "";
    if (firma && firma.includes(",")) {
      try {
        const imgId = wb.addImage({
          base64:    firma.split(",")[1],
          extension: "png",
        });
        // 8.71 cm x 3.18 cm ≈ 329 x 120 px (96 dpi), centrada en la celda O
        ws.addImage(imgId, {
          tl:  { col: 14.08, row: fila - 1 + 0.06 },
          ext: { width: 329, height: 120 },
          editAs: "oneCell",
        });
        conFirma++;
      } catch (e) {
        console.warn(`Firma fila ${fila}:`, e.message);
      }
    }
  }

  // ── Raya de "FIRMA RESPONSABLE DEL MACROPROCESO" ──
  // En la plantilla esa raya es una linea dibujada (conector), y
  // ExcelJS la elimina al guardar. La reponemos como una imagen
  // de linea negra en la misma posicion del conector original.
  const rayaId = wb.addImage({ base64: imagenRaya(), extension: "png" });
  ws.addImage(rayaId, {
    tl: { col: 3.05, row: 39.5 },
    br: { col: 13.16, row: 39.515 },
    editAs: "oneCell",
  });

  // Texto de respaldo por si una hoja clonada lo pierde
  const celdaFirmaResp = ws.getCell(39, 2);
  if (!celdaFirmaResp.value) {
    celdaFirmaResp.value =
      "FIRMA RESPONSABLE DEL MACROPROCESO / REGISTRADORES DISTRITALES / DELEGADOS DEPARTAMENTALES";
    celdaFirmaResp.font = { name: "Arial", size: 25, bold: true };
    celdaFirmaResp.alignment = { horizontal: "center", wrapText: true };
  }

  return conFirma;
}

/* ── Genera una imagen PNG de una linea negra (la raya) ── */
let _rayaCache = null;
function imagenRaya() {
  if (_rayaCache) return _rayaCache;
  const canvas = document.createElement("canvas");
  canvas.width = 1200;
  canvas.height = 4;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  _rayaCache = canvas.toDataURL("image/png").split(",")[1];
  return _rayaCache;
}

export async function exportarPTFT38(evento, registros) {
  await cargarExcelJS();

  // ── Cargar plantilla limpia desde hosting ──
  const resp = await fetch("/PTFT38.xlsx");
  if (!resp.ok) throw new Error("No se pudo cargar la plantilla Excel.");
  const templateBuffer = await resp.arrayBuffer();

  // ── Partir los registros en grupos de 25 (uno por hoja) ──
  const grupos = [];
  for (let i = 0; i < registros.length; i += REGISTROS_POR_HOJA) {
    grupos.push(registros.slice(i, i + REGISTROS_POR_HOJA));
  }
  if (grupos.length === 0) grupos.push([]);

  // ── Cargar logo solo si habra hojas clonadas (la primera
  //    ya lo trae embebido en la plantilla) ──
  let logoBase64 = null;
  if (grupos.length > 1) {
    try {
      const logoResp = await fetch("/img/LogoFormato.jpg");
      const logoBuffer = await logoResp.arrayBuffer();
      logoBase64 = btoa(
        new Uint8Array(logoBuffer).reduce(
          (data, byte) => data + String.fromCharCode(byte),
          ""
        )
      );
    } catch (e) {
      console.warn("Logo no cargado:", e.message);
    }
  }

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(templateBuffer);
  const hojaBase = wb.worksheets[0];
  const nombreBase = hojaBase.name;

  let conFirma = 0;

  for (let g = 0; g < grupos.length; g++) {
    let ws;
    if (g === 0) {
      ws = hojaBase;
      if (grupos.length > 1) ws.name = `${nombreBase} (1)`;
    } else {
      // Clonar la hoja plantilla: copiamos su "modelo" (formato,
      // celdas combinadas, anchos de columna) a una hoja nueva
      ws = wb.addWorksheet(`${nombreBase} (${g + 1})`);
      ws.model = Object.assign({}, hojaBase.model, {
        mergeCells: hojaBase.model.merges,
      });
      ws.name = `${nombreBase} (${g + 1})`;
    }
    conFirma += llenarHoja(wb, ws, evento, grupos[g], logoBase64, g > 0);
  }

  // ── Descargar ──
  const buffer = await wb.xlsx.writeBuffer();
  const blob   = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = `PTFT38_${(evento?.nombre || "Evento").replace(/\s+/g, "_")}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);

  console.log(
    `✅ Excel generado: ${grupos.length} hoja(s), ${registros.length} registro(s), ${conFirma} firma(s)`
  );
}
