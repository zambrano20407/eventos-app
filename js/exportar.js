/* ============================================================
   exportar.js — Generacion de Excel con ExcelJS (sin servidor)
   Llena la plantilla oficial que corresponda al formato del evento:
   PTFT38 (capacitaciones, 25 filas por hoja) o SGFT07 (reuniones, 23).
   Cuando hay mas registros de los que caben, agrega una hoja por cada
   grupo, conservando membrete y formato.
   ============================================================ */

import { siglaSexo } from "./sexo.js";
import { formatoDe } from "./formatos.js";

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

/* ── Llena UNA hoja con el encabezado y hasta 25 registros ──
   El logo ya no se vuelve a insertar en las hojas clonadas: al copiar
   el modelo de la plantilla las imágenes vienen incluidas. Al hacerlo a
   mano se agregaba estirado (201 x 50 px, proporción 4:1, cuando la
   imagen real es 641 x 411, proporción 1,56). */
function llenarHoja(wb, ws, evento, registros) {
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
    // Antes se tomaba la primera letra, que solo servía con dos
    // opciones; ahora la sigla es explícita (M, F u O)
    ws.getCell(fila, 8).value  = siglaSexo(reg);
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

/* ── Llena UNA hoja del SGFT07 (asistencia a reuniones) ──

   Este formato no pide sexo ni nivel del cargo: pide cargo, teléfono y
   correo. Las etiquetas ya vienen escritas en la plantilla, así que el
   valor se concatena para no borrarlas.

   Filas de datos: 13 a 35 (23 por hoja). */
const SGFT07_FILA_INICIAL = 13;

function llenarHojaSGFT07(wb, ws, evento, registros) {
  const encabezado = [
    ["A8", "REUNIÓN:", evento?.nombre],
    ["G8", "FECHA:", evento?.fecha],
    ["A10", "LUGAR:", evento?.institucion],
    ["G10", "HORARIO:", evento?.horario || evento?.jornada],
  ];
  encabezado.forEach(([celda, etiqueta, valor]) => {
    ws.getCell(celda).value = `${etiqueta}  ${valor || ""}`;
  });

  // Limpiar las filas por si la plantilla trajera algo
  for (let fila = SGFT07_FILA_INICIAL; fila <= SGFT07_FILA_INICIAL + 22; fila++) {
    [1, 2, 5, 6, 7, 9, 10].forEach((col) => {
      ws.getCell(fila, col).value = null;
    });
  }

  let conFirma = 0;
  const fuente = { name: "Arial", size: 11 };

  registros.forEach((reg, i) => {
    const fila = SGFT07_FILA_INICIAL + i;

    // A=Nro · B:D=nombre · E=cédula · F=cargo · G:H=dependencia
    // I=teléfono · J:L=correo · M=firma
    ws.getCell(fila, 1).value = i + 1;
    ws.getCell(fila, 2).value = reg.nombre || "";
    ws.getCell(fila, 5).value = reg.cedula || "";
    ws.getCell(fila, 6).value = reg.cargo || "";
    ws.getCell(fila, 7).value = reg.dependencia || "";
    ws.getCell(fila, 9).value = reg.telefono || "";
    ws.getCell(fila, 10).value = reg.correo || "";

    [1, 2, 5, 6, 7, 9, 10].forEach((col) => {
      const celda = ws.getCell(fila, col);
      celda.font = fuente;
      celda.alignment = CENTRADO;
    });

    const firma = reg.firma || "";
    if (firma && firma.includes(",")) {
      try {
        const imgId = wb.addImage({
          base64: firma.split(",")[1],
          extension: "png",
        });
        // Columna M (índice 12 en base cero), centrada en su fila
        ws.addImage(imgId, {
          tl: { col: 12.1, row: fila - 1 + 0.08 },
          ext: { width: 200, height: 58 },
          editAs: "oneCell",
        });
        conFirma++;
      } catch (e) {
        console.warn(`Firma fila ${fila}:`, e.message);
      }
    }
  });

  return conFirma;
}

export async function exportarAsistencia(evento, registros) {
  await cargarExcelJS();

  const formato = formatoDe(evento);
  const esReunion = formato.codigo === "SGFT07";
  const porHoja = formato.filasPorHoja;

  // ── Cargar plantilla limpia desde hosting ──
  const resp = await fetch(formato.plantilla);
  if (!resp.ok) {
    throw new Error(`No se pudo cargar la plantilla ${formato.codigo}.`);
  }
  const templateBuffer = await resp.arrayBuffer();

  // ── Partir los registros: una hoja por grupo ──
  const grupos = [];
  for (let i = 0; i < registros.length; i += porHoja) {
    grupos.push(registros.slice(i, i + porHoja));
  }
  if (grupos.length === 0) grupos.push([]);

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(templateBuffer);
  const hojaBase = wb.worksheets[0];
  const nombreBase = hojaBase.name;

  // ── Crear TODAS las hojas antes de llenar ninguna ──
  //
  // Dos cosas que hay que hacer en este orden:
  //
  // 1. El modelo de la hoja base se copia SIN su nombre. Copiarlo
  //    completo intentaba ponerle a la hoja nueva el nombre de la
  //    original, y ExcelJS aborta con "Worksheet name already exists".
  //
  // 2. Se clona antes de escribir nada. Si se clona una hoja ya llena,
  //    el clon arrastra las firmas de la anterior y la segunda hoja
  //    sale con las firmas de las dos.
  const hojas = [hojaBase];
  if (grupos.length > 1) {
    const { name: _sinNombre, ...modeloBase } = hojaBase.model;
    const merges = hojaBase.model.merges;
    hojaBase.name = `${nombreBase} (1)`;
    for (let g = 1; g < grupos.length; g++) {
      const ws = wb.addWorksheet(`hoja_${g}`);
      ws.model = Object.assign({}, modeloBase, { mergeCells: merges });
      ws.name = `${nombreBase} (${g + 1})`;
      hojas.push(ws);
    }
  }

  let conFirma = 0;
  grupos.forEach((grupo, g) => {
    conFirma += esReunion
      ? llenarHojaSGFT07(wb, hojas[g], evento, grupo)
      : llenarHoja(wb, hojas[g], evento, grupo);
  });

  // ── Descargar ──
  const buffer = await wb.xlsx.writeBuffer();
  const blob   = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = `${formato.codigo}_${(evento?.nombre || "Evento").replace(/\s+/g, "_")}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);

  console.log(
    `✅ ${formato.codigo}: ${grupos.length} hoja(s), ${registros.length} registro(s), ${conFirma} firma(s)`
  );
}

/* Nombre anterior, conservado para no romper llamadas existentes */
export const exportarPTFT38 = exportarAsistencia;
