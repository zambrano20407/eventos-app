/* ============================================================
   usuarios-word.js — Genera el formato oficial en Word
   Toma la plantilla .docx institucional (que ya trae marcadores),
   reemplaza los datos, marca las casillas e inserta la firma
   digital como imagen. El diseño del formato queda intacto.

   El usuario abre el .docx y desde Word imprime o guarda como PDF.
   ============================================================ */

// Version de las plantillas Word (subir al regenerarlas con
// Python/preparar_plantillas.py, para que no se use una copia vieja)
const VERSION_PLANTILLAS = "2026-08-23i";

const PLANTILLAS = {
  ani: { archivo: "cdft05", nombre: "CDFT05_ANI" },
  webservice: { archivo: "cdft09", nombre: "CDFT09_WebService" },
  gedid: { archivo: "cdft12", nombre: "CDFT12_GED_ID" },
  gedrc: { archivo: "cdft12", nombre: "CDFT12_GED_RC" },
  hled: { archivo: "cdft20", nombre: "CDFT20_HLED" },
  sirc: { archivo: "cdft23", nombre: "CDFT23_SIRC" },
  correo: { archivo: "gift05", nombre: "GIFT05_Correo" },
};

// Caracteres Wingdings: casilla vacia y casilla marcada
const CB_VACIA = "";
const CB_MARCADA = "";

/* ── Texto de cada opcion → marcador de la plantilla ── */
const MAPA_CASILLAS = {
  // Vinculacion
  Planta: "vinc_planta",
  Provisional: "vinc_provisional",
  Supernumerario: "vinc_supernumerario",
  Contratista: "vinc_contratista",
  Directivo: "vinc_directivo",
  // Cargo de quien autoriza
  "Delegado Departamental": "aut_delegado",
  "Registrador Distrital": "aut_registrador",
  Directivos: "aut_directivo",
  "Coordinador de Área": "aut_coordinador",
  Formador: "aut_formador",
  // ANI · perfiles
  "Consultas ANI": "p_consultas_ani",
  "Archivo general": "p_archivo_general",
  "Información ciudadana": "p_informacion_ciudadana",
  "Recepción secretaría": "p_recepcion_secretaria",
  "Soporte técnico interfaz": "p_soporte_tecnico",
  "Centros de Acopio": "p_centros_acopio",
  "Derechos de petición": "p_derechos_peticion",
  "Notificación resoluciones": "p_notificacion_resoluciones",
  "Certificaciones vigencia": "p_certificaciones_vigencia",
  "Correspondencia modificación": "p_correspondencia",
  Registradores: "p_registradores",
  "Duplicados pre envío": "p_duplicados",
  "Cedulación exterior": "p_cedulacion_exterior",
  Secretaría: "p_secretaria",
  "Envíos coordinación": "p_envios_coordinacion",
  // ANI · datos a consultar
  "Cédula de ciudadanía": "d_cedula",
  "Nombres y apellidos": "d_nombres",
  "Lugar de expedición": "d_lugar_expedicion",
  "Fecha de expedición": "d_fecha_expedicion",
  Vigencia: "d_vigencia",
  Resolución: "d_resolucion",
  "Fecha de nacimiento": "d_fecha_nacimiento",
  "Lugar de nacimiento": "d_lugar_nacimiento",
  "Grupo sanguíneo": "d_grupo_sanguineo",
  Estatura: "d_estatura",
  Sexo: "d_sexo",
  // Web Service
  SCA: "a_sca", SSC: "a_ssc", CCT: "a_cct",
  "INV. CC": "a_inv_cc", "INV. TI": "a_inv_ti", VERIF: "a_verif",
  "1.1": "a_1_1", "1.N": "a_1_n", CAL: "a_cal",
  Impresión: "a_impresion",
  "Reimpresión de documentos": "a_reimpresion",
  // GED
  Consulta: "a_consulta",
  "Consulta e Impresión": "a_consulta_impresion",
  // SIRC
  Estadísticas: "a_estadisticas",
  "Consulta GED RCX": "a_consulta_ged",
  Corrección: "a_correccion",
  "Expedición Certificado": "a_expedicion",
  "Complementación RCX": "a_complementacion",
  "Corrección Manual de Anomalías": "a_correccion_manual",
  "Borrado Lógico": "a_borrado",
  "DCU Administrador": "a_dcu_admin",
  "DCU Operador": "a_dcu_operador",
  "DCU Registrador": "a_dcu_registrador",
  "Grabación RCX": "a_grabacion",
  "Gestión de Seriales (ANS/GNS)": "a_seriales",
};

async function cargarJSZip() {
  if (window.JSZip) return;
  await new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js";
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

function fFecha(iso) {
  if (!iso) return "";
  const [a, m, d] = iso.split("-");
  return `${d}/${m}/${a}`;
}

/* Escapa los caracteres que romperian el XML del documento */
function xmlSeguro(texto) {
  return String(texto || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/* ── Datos de texto que van al formato ── */
function datosDe(sol, sis) {
  return {
    nombres: sol.nombres,
    apellidos: sol.apellidos,
    cedula: sol.cedula,
    telefono: sol.telefono,
    correo: sol.correo,
    cargo: sol.cargo,
    oficina: sol.oficina,
    departamento: sol.departamento,
    ciudad: sol.ciudad,
    autNombres: sol.autNombres,
    autApellidos: sol.autApellidos,
    autCargo: sol.autCargo,
    autDependencia: sol.autDependencia,
    vigDesde: fFecha(sol.vigenciaDesde),
    vigHasta: fFecha(sol.vigenciaHasta),
    fechaSolicitud: sol.creadoEn?.toDate
      ? sol.creadoEn.toDate().toLocaleDateString("es-CO")
      : "",
    nombreUsuario: sol.nombreUsuario || "",
    justificacion: sol.justificacion || "",
    ani_ip: sol.sistemas?.ani?.ip || "",

    // ── Campos propios del formato de Correo (GIFT05) ──
    nombreCompleto: `${sol.nombres || ""} ${sol.apellidos || ""}`.trim(),
    autNombreCompleto: `${sol.autNombres || ""} ${sol.autApellidos || ""}`.trim(),
    // Nivel al que pertenece la oficina: la Delegación es "Delegaciones",
    // las registradurías especiales y municipales son "Registraduría"
    regional: (sol.oficina || "").startsWith("Delegación")
      ? "Delegaciones"
      : "Registraduría",
    resNumero: sol.sistemas?.correo?.resNumero || "",
    resAno: sol.sistemas?.correo?.resAno || "",
    // En Creación aún no existe cuenta; en las demás opciones
    // (cambio, bloqueo, eliminación…) se indica cuál es
    cuentaUsuario:
      sol.tipoSolicitud === "Creación" ? "" : sol.nombreUsuario || "",
    // Estas dos opciones no tienen cuadro dibujado en el formato:
    // su marca va como texto al lado de la etiqueta
    xContratista: sol.vinculacion === "Contratista" ? "X" : "",
    xEntes: "",
  };
}

/* Opciones del formato de Correo, que usa cuadros dibujados */
function casillasCorreo(sol) {
  const marcadas = new Set();
  // Tipo de solicitud: el GIFT05 maneja cinco opciones propias
  const porTipo = {
    "Creación": "g_creacion",
    "Cambio de Responsable": "g_cambio",
    "Bloqueo": "g_bloqueo",
    "Eliminación": "g_eliminacion",
    "Actualización de datos": "g_actualizacion",
    // Por compatibilidad con solicitudes hechas antes de separar Correo
    "Actualización": "g_actualizacion",
  };
  marcadas.add(porTipo[sol.tipoSolicitud] || "g_creacion");
  // Tipo de vinculacion
  const porVinculacion = {
    Planta: "g_planta",
    Provisional: "g_provisional",
    Supernumerario: "g_supernumerario",
    Contratista: "g_contratista",
    Directivo: "g_libre", // los cargos directivos son de libre nombramiento
  };
  const m = porVinculacion[sol.vinculacion];
  if (m) marcadas.add(m);
  return marcadas;
}

/* ── Casillas que deben quedar marcadas ── */
function casillasDe(sol, sis) {
  const marcadas = new Set();
  const agregar = (texto) => {
    const m = MAPA_CASILLAS[texto];
    if (m) marcadas.add(m);
  };

  // Tipo de solicitud
  marcadas.add(
    sol.tipoSolicitud === "Actualización" ? "tipo_actualizacion" : "tipo_creacion",
  );
  // Vinculacion y cargo de quien autoriza
  agregar(sol.vinculacion);
  agregar(sol.autCargo);

  // Dependencia solicitante: se deduce de la oficina
  marcadas.add(
    (sol.oficina || "").startsWith("Delegación")
      ? "dep_delegacion"
      : "dep_municipal",
  );

  // Opciones propias del sistema
  const det = sol.sistemas?.[sis] || {};
  (det.perfiles || []).forEach(agregar);
  (det.datos || []).forEach(agregar);
  (det.accesos || []).forEach(agregar);
  if (det.acceso) agregar(det.acceso);
  if (sis === "gedid") marcadas.add("h_ged_id");
  if (sis === "gedrc") marcadas.add("h_ged_rc");

  return marcadas;
}

/* Retira del documento la imagen reservada para la firma de quien
   autoriza. Se usa cuando el Delegado todavia no ha firmado por la web:
   asi la celda queda limpia para firmarla a mano. */
async function quitarImagenFirma(zip, xml) {
  const rels = await zip.file("word/_rels/document.xml.rels").async("string");
  // Identificador interno de la imagen .gif (la reservada para la firma)
  const rel = rels.match(/Id="([^"]+)"[^>]*Target="media\/[^"]*\.gif"/);
  if (!rel) return xml;
  const id = rel[1];
  // Borrar el bloque que dibuja esa imagen
  const bloque = new RegExp(
    `<w:r\\b(?:(?!</w:r>)[\\s\\S])*?r:embed="${id}"(?:(?!</w:r>)[\\s\\S])*?</w:r>`,
    "g",
  );
  return xml.replace(bloque, "");
}

/* ════════════════════════════════════════════════════════════
   Genera y descarga el .docx de UN sistema
════════════════════════════════════════════════════════════ */
export async function exportarWord(sol, sis) {
  await cargarJSZip();
  const cfg = PLANTILLAS[sis];
  if (!cfg) throw new Error(`No hay plantilla para "${sis}".`);

  // El sufijo ?v= obliga al navegador a pedir la plantilla nueva.
  // Subir este numero cada vez que se regeneren las plantillas.
  const resp = await fetch(`/plantillas/${cfg.archivo}.docx?v=${VERSION_PLANTILLAS}`);
  if (!resp.ok) throw new Error("No se pudo cargar la plantilla del formato.");
  const zip = await window.JSZip.loadAsync(await resp.arrayBuffer());

  // 1) Texto del documento
  let xml = await zip.file("word/document.xml").async("string");
  const datos = datosDe(sol, sis);
  for (const [clave, valor] of Object.entries(datos)) {
    xml = xml.split(`{{${clave}}}`).join(xmlSeguro(valor));
  }

  // 2) Casillas. En las tablas "sí / no" del formato cada opcion tiene
  //    dos casillas: la de "sí" (marcador normal) y la de "no" (sufijo
  //    __no). Lo solicitado va con ☑ en "sí"; lo no solicitado con ☑ en
  //    "no", para que no quede ninguna casilla en blanco.
  const marcadas = casillasDe(sol, sis);
  xml = xml.replace(/\{\{cb:([a-z0-9_]+?)(__no)?\}\}/g, (_, nombre, esColumnaNo) => {
    const pedida = marcadas.has(nombre);
    if (esColumnaNo) return pedida ? CB_VACIA : CB_MARCADA;
    return pedida ? CB_MARCADA : CB_VACIA;
  });

  // 2b) Cuadros dibujados del formato de Correo: X en la opcion elegida.
  //     Los del buzón traen escrito SÍ/NO: el elegido pasa a mostrar la
  //     X y el otro conserva su etiqueta, igual que se marca a mano.
  if (sis === "correo") {
    const marcadasCorreo = casillasCorreo(sol);
    const requiereBuzon = (sol.sistemas?.correo?.buzon || "Sí") !== "No";
    xml = xml.replace(/\{\{cbx:([a-z_]+)\}\}/g, (_, nombre) => {
      if (nombre === "buzon_si") return requiereBuzon ? "X" : "SÍ";
      if (nombre === "buzon_no") return requiereBuzon ? "NO" : "X";
      return marcadasCorreo.has(nombre) ? "X" : "";
    });
  }

  // 3) "Indique nombre de usuario…": en Actualización queda el usuario
  //    escrito; si no, vuelve el texto guía propio de cada formato (que
  //    va guardado dentro del mismo marcador).
  const esActualizacion =
    sol.tipoSolicitud === "Actualización" && sol.nombreUsuario;
  xml = xml.replace(/\{\{textoUsuario\|([^}]*)\}\}/g, (_, guia) =>
    // El espacio va aqui (no en la plantilla) para que en "Creación"
    // la linea conserve el largo exacto del formato original
    esActualizacion ? " " + xmlSeguro(sol.nombreUsuario) : guia,
  );

  // 4) Limpiar marcadores que no aplican a este formato
  xml = xml.replace(/\{\{[a-zA-Z_]+\}\}/g, "");

  // 5) Firmas digitales. La plantilla trae dos imagenes vacias:
  //    .png = firma del funcionario · .gif = firma de quien autoriza
  //    (los logos institucionales son .jpeg y no se tocan).
  const aBytes = (dataUrl) => {
    const binario = atob(dataUrl.split(",")[1]);
    const bytes = new Uint8Array(binario.length);
    for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
    return bytes;
  };

  if ((sol.firma || "").includes(",")) {
    const bytes = aBytes(sol.firma);
    zip.file(/^word\/media\/.*\.png$/).forEach((f) => zip.file(f.name, bytes));
  }

  if ((sol.firmaAutorizador || "").includes(",")) {
    const bytes = aBytes(sol.firmaAutorizador);
    zip.file(/^word\/media\/.*\.gif$/).forEach((f) => zip.file(f.name, bytes));
  } else {
    // Aun no ha firmado: se retira la imagen para que la celda quede
    // completamente vacia, lista para firmar a mano
    xml = await quitarImagenFirma(zip, xml);
  }
  zip.file("word/document.xml", xml);

  // 5) Descargar
  const blob = await zip.generateAsync({
    type: "blob",
    mimeType:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
  const archivo = `${cfg.nombre}_${(sol.nombres || "")}_${(sol.apellidos || "")}`
    .trim().replace(/\s+/g, "_");
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${archivo}.docx`;
  a.click();
  URL.revokeObjectURL(url);
}

/* Genera los formatos de todos los sistemas de una solicitud */
export async function exportarTodosWord(sol) {
  for (const sis of sol.sistemasSolicitados || []) {
    if (!PLANTILLAS[sis]) continue;
    await exportarWord(sol, sis);
    await new Promise((r) => setTimeout(r, 700));
  }
}
