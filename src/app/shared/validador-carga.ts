// ==================================================
// REVISIÓN DEL ARCHIVO DE CARGA (en el navegador)
// El backend descarta las filas con errores de formato y no las
// vuelve a contar ni a devolver. Por eso se revisan aquí, con las
// mismas reglas (BatchRowValidator y ApacheCsvFileParser), para poder
// contarlas y descargarlas.
// Además hay reglas propias (código PROPIA_...) que el backend no tiene:
// esas filas se quitan del archivo antes de enviarlo.
// ==================================================

import { COLUMNAS_DETALLE_CARGA } from './plantilla-carga';

export interface ErrorCarga {
  fila: number | null;   // null = error de todo el archivo
  campo: string;
  valor: string;
  esperado: string;
  error: string;
  codigo: string;
}

export interface RevisionArchivo {
  totalRegistros: number;
  filasConError: number;
  errores: ErrorCarga[];
  // Número de fila del archivo de cada registro sin errores de formato, en orden.
  // El backend numera los registros así (1, 2, 3...) y no por su fila real.
  filasValidas: number[];
  // Lo que se envía al backend. null = no queda ninguna fila para enviar
  archivoEnvio: File | null;
}

const TAMANO_MAXIMO = 50 * 1024 * 1024;
const MAXIMO_ERRORES = 5000;
const FILAS_POR_TANDA = 5000;
const COLUMNAS_OBLIGATORIAS = 7;

const TIPOS_DOCUMENTO = ['CC', 'CE', 'NIT', 'TI', 'PP', 'RC'];
// Estos documentos solo llevan números (el NIT puede traer dígito de verificación: 900123456-7)
const DOCUMENTOS_NUMERICOS: Record<string, RegExp> = {
  CC: /^\d+$/, TI: /^\d+$/, RC: /^\d+$/, NIT: /^\d+(-\d)?$/
};
// Partes separadas por guion: letras, números, o letras seguidas de números (OBL-000001)
const FORMATO_OBLIGACION = /^[A-Za-z]*\d*(-[A-Za-z]*\d*)*$/;
const MONTO_MAXIMO = 999999999999.99;
const DIAS_MAXIMO = 36500;

type Fila = Record<string, string>;

const errorDe = (
  fila: number | null, campo: string, valor: string, esperado: string, error: string, codigo: string
): ErrorCarga => ({ fila, campo, valor, esperado, error, codigo });

function esFechaValida(texto: string): boolean {
  const partes = /^(\d{4})-(\d{2})-(\d{2})$/.exec(texto);
  if (!partes) return false;
  const [anio, mes, dia] = partes.slice(1).map(Number);
  if (mes < 1 || mes > 12 || dia < 1) return false;
  const bisiesto = (anio % 4 === 0 && anio % 100 !== 0) || anio % 400 === 0;
  const dias = [31, bisiesto ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return dia <= dias[mes - 1];
}

// Todos los errores de una fila
export function validarFila(fila: number, v: Fila): ErrorCarga[] {

  const marcadas = Object.entries(v).filter(([, valor]) => />>[A-Z0-9_-]+>>/.test(valor));
  if (marcadas.length > 0) {
    return marcadas.map(([campo, valor]) => errorDe(
      fila, campo, valor, 'Valor sin el marcador de error',
      'El campo aún contiene el marcador de error; retíralo antes de recargar.', 'MARCADOR_NO_RETIRADO'
    ));
  }

  const errores: ErrorCarga[] = [];

  const agregar = (campo: string, esperado: string, error: string, codigo: string) =>
    errores.push(errorDe(fila, campo, v[campo] ?? '', esperado, error, codigo));

  // Devuelve el valor, o '' (y agrega el error) si el campo obligatorio está vacío
  const obligatorio = (campo: string, esperado: string): string => {
    const valor = (v[campo] ?? '').trim();
    if (!valor) agregar(campo, esperado, 'Campo obligatorio: no puede estar vacío.', 'OBLIGATORIO');
    return valor;
  };

  const tipos = `Uno de: ${TIPOS_DOCUMENTO.join(', ')}`;
  const tipo = obligatorio('document_type', tipos);
  if (tipo && !TIPOS_DOCUMENTO.includes(tipo.toUpperCase())) {
    agregar('document_type', tipos, 'Tipo de documento no válido.', 'CATALOGO');
  }

  const formatoDocumento = 'Letras, números o guion; 5 a 20 caracteres';
  const documento = obligatorio('document_number', formatoDocumento);
  if (documento && !/^[A-Za-z0-9-]+$/.test(documento)) {
    agregar('document_number', formatoDocumento,
      'Solo se permiten letras, números y guion (sin espacios ni otros caracteres especiales).', 'ALFANUMERICO');
  } else if (documento && (documento.length < 5 || documento.length > 20)) {
    agregar('document_number', formatoDocumento, 'Longitud inválida: debe tener entre 5 y 20 caracteres.', 'LONGITUD');
  } else if (documento && DOCUMENTOS_NUMERICOS[tipo.toUpperCase()]?.test(documento) === false) {
    agregar('document_number', `Solo números (${tipo.toUpperCase()})`,
      `El número de documento ${tipo.toUpperCase()} no puede tener letras.`, 'PROPIA_DOCUMENTO');
  }

  const formatoNombre = 'Solo texto, máximo 200 caracteres';
  const nombre = obligatorio('client_name', formatoNombre);
  if (nombre.length > 200) {
    agregar('client_name', formatoNombre, 'Excede la longitud máxima de 200 caracteres.', 'LONGITUD');
  }
  if (nombre && !/^[\p{L} .'-]+$/u.test(nombre)) {
    agregar('client_name', formatoNombre,
      'Solo se permiten letras y espacios (sin números ni caracteres especiales).', 'SOLO_LETRAS');
  }

  const formatoObligacion = 'Letras, números o guion; 1 a 50 caracteres, sin espacios';
  const obligacion = obligatorio('obligation_id', formatoObligacion);
  if (obligacion.length > 50) {
    agregar('obligation_id', formatoObligacion, 'Longitud inválida: entre 1 y 50 caracteres.', 'LONGITUD');
  }
  if (obligacion && !/^[A-Za-z0-9-]+$/.test(obligacion)) {
    agregar('obligation_id', formatoObligacion, 'Formato inválido: solo letras, números y guion.', 'ALFANUMERICO');
  } else if (obligacion && (!FORMATO_OBLIGACION.test(obligacion) || !/\d/.test(obligacion))) {
    agregar('obligation_id', 'Letras al inicio y luego números (ej. OBL-000001)',
      'El número de la obligación no puede tener letras en medio de los números.', 'PROPIA_OBLIGACION');
  }

  const formatoMonto = `Número entre 0 y ${MONTO_MAXIMO} (hasta 2 decimales)`;
  const monto = obligatorio('obligation_amount', formatoMonto);
  if (monto) {
    const numero = /^([+-]?)(?:(\d+)(?:\.(\d*))?|\.(\d+))(?:[eE]([+-]?\d+))?$/.exec(monto.replace(/,/g, ''));
    if (!numero) {
      agregar('obligation_amount', formatoMonto, 'Monto inválido: debe ser un número (ej. 5000000.00).', 'SOLO_NUMERICO');
    } else {
      const valor = Number(numero[0]);
      const decimales = (numero[3] ?? numero[4] ?? '').length - Number(numero[5] ?? 0);
      if (valor < 0) {
        agregar('obligation_amount', formatoMonto, 'El monto no puede ser negativo.', 'RANGO');
      } else if (valor > MONTO_MAXIMO) {
        agregar('obligation_amount', formatoMonto, 'El monto excede el máximo permitido.', 'RANGO');
      } else if (decimales > 2) {
        agregar('obligation_amount', formatoMonto, 'Máximo 2 decimales.', 'SOLO_NUMERICO');
      }
    }
  }

  const formatoFecha = 'Fecha AAAA-MM-DD';
  const vencimiento = obligatorio('due_date', formatoFecha);
  if (vencimiento && !esFechaValida(vencimiento)) {
    agregar('due_date', formatoFecha,
      'Fecha inválida o inexistente. Usa el formato AAAA-MM-DD (ej. 2024-05-31).', 'FECHA');
  }

  const formatoDias = `Entero entre 0 y ${DIAS_MAXIMO}`;
  const dias = obligatorio('days_past_due', formatoDias);
  if (dias && (!/^[+-]?\d+$/.test(dias) || Math.abs(Number(dias)) > 2147483647)) {
    agregar('days_past_due', formatoDias, 'Debe ser un número entero (sin letras ni decimales).', 'SOLO_NUMERICO');
  } else if (dias && (Number(dias) < 0 || Number(dias) > DIAS_MAXIMO)) {
    agregar('days_past_due', formatoDias, `Fuera de rango: debe estar entre 0 y ${DIAS_MAXIMO}.`, 'RANGO');
  }

  // Opcionales: solo se revisan si traen algo
  const opcional = (
    campo: string, esValido: (valor: string) => boolean, esperado: string, error: string, codigo: string
  ) => {
    const valor = (v[campo] ?? '').trim();
    if (valor && !esValido(valor)) agregar(campo, esperado, error, codigo);
  };

  opcional('currency', x => /^[A-Za-z]{3}$/.test(x), 'Código de 3 letras (ej. COP)', 'Moneda inválida.', 'CATALOGO');
  opcional('mobile', x => /^\d{7,15}$/.test(x), 'Entre 7 y 15 dígitos', 'Teléfono inválido.', 'SOLO_NUMERICO');
  opcional('email', x => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(x), 'nombre@dominio.com', 'Correo inválido.', 'FORMATO');
  opcional('affiliation_date', esFechaValida, formatoFecha,
    'Fecha inválida o inexistente. Usa el formato AAAA-MM-DD.', 'FECHA');

  return errores;
}

// Recorre los registros del CSV (respeta comillas, comas y saltos de línea internos).
// Las líneas vacías se saltan. "linea" es el número de línea real del archivo.
interface Registro { campos: string[]; linea: number; crudo: string }

function* leerRegistros(texto: string, inicio: number): Generator<Registro> {
  let linea = 4;
  let lineaInicio = linea;
  let posicionInicio = inicio;
  let campos: string[] = [];
  let campo = '';
  let entreComillas = false;
  let teniaComillas = false;

  const cerrarCampo = () => {
    campos.push(campo.trim());
    campo = '';
  };

  for (let i = inicio; i <= texto.length; i++) {
    const c = i < texto.length ? texto[i] : '\n';

    if (entreComillas && i < texto.length) {
      if (c === '\n') linea++;
      if (c !== '"') campo += c;
      else if (texto[i + 1] === '"') { campo += '"'; i++; }
      else entreComillas = false;
    } else if (c === '"' && campo.trim() === '') {
      campo = '';
      entreComillas = teniaComillas = true;
    } else if (c === ',') {
      cerrarCampo();
    } else if (c === '\n' || c === '\r') {
      const fin = i;
      if (c === '\r' && texto[i + 1] === '\n') i++;
      const lineaVacia = campos.length === 0 && campo.trim() === '' && !teniaComillas;
      cerrarCampo();
      if (!lineaVacia) yield { campos, linea: lineaInicio, crudo: texto.slice(posicionInicio, fin) };
      campos = [];
      teniaComillas = entreComillas = false;
      lineaInicio = ++linea;
      posicionInicio = i + 1;
    } else {
      campo += c;
    }
  }
}

// Revisa las 3 líneas de encabezado. Devuelve el mensaje de error, o '' si están bien.
function revisarEncabezado(lineas: string[]): string {
  const nombres = lineas[0].toLowerCase().replace(/[\s"'`]/g, '');
  if (!['fecha', 'consecutivo', 'cantidad', 'lote'].every(n => nombres.includes(n))) {
    return 'La primera línea debe contener: fecha,consecutivo,cantidad,lote';
  }

  const valores = lineas[1].split(',').map(x => x.trim());
  if (valores.length < 4) return 'La línea 2 debe tener 4 valores: fecha,consecutivo,cantidad,lote';
  if (!esFechaValida(valores[0])) return `La fecha de la línea 2 no es válida (usa AAAA-MM-DD). Recibido: '${valores[0]}'`;
  if (!/^[+-]?\d+$/.test(valores[2])) return `El campo 'cantidad' de la línea 2 debe ser un número entero. Recibido: '${valores[2]}'`;
  if (!valores[1] || !valores[3]) return 'En la línea 2 no pueden estar vacíos el consecutivo ni el lote';

  const columnas = lineas[2].split(',').map(x => x.trim().toLowerCase().replace(/["'`]/g, ''));
  if (columnas.length < COLUMNAS_OBLIGATORIAS) {
    return `Faltan columnas en la línea 3. Orden esperado: ${COLUMNAS_DETALLE_CARGA.join(',')}`;
  }
  const mala = columnas.findIndex((columna, i) => columna !== COLUMNAS_DETALLE_CARGA[i]);
  if (mala >= 0) {
    return `Columna inválida o fuera de orden en la posición ${mala + 1} de la línea 3: '${columnas[mala]}'. ` +
      `Orden esperado: ${COLUMNAS_DETALLE_CARGA.join(',')}`;
  }
  return '';
}

// null = el archivo es muy grande para revisarlo aquí (lo revisa solo el backend)
export async function revisarArchivo(archivo: File): Promise<RevisionArchivo | null> {

  if (archivo.size > TAMANO_MAXIMO) return null;

  const revision: RevisionArchivo = { totalRegistros: 0, filasConError: 0, errores: [], filasValidas: [], archivoEnvio: archivo };

  const errorGeneral = (mensaje: string) => {
    revision.errores.push(errorDe(null, 'Archivo', '', '', mensaje, 'ESTRUCTURA'));
    return revision;
  };

  let texto: string;
  try {
    // TextDecoder quita la marca BOM del inicio
    texto = new TextDecoder('utf-8', { fatal: true }).decode(await archivo.arrayBuffer());
  } catch {
    return errorGeneral('El archivo no está guardado en UTF-8. Guárdalo como "CSV UTF-8" y vuelve a cargarlo.');
  }

  // Las 3 primeras líneas son el encabezado
  const lineas: string[] = [];
  const corte = /([^\r\n]*)(\r\n|\n|\r|$)/y;
  while (lineas.length < 3 && corte.lastIndex < texto.length) {
    lineas.push((corte.exec(texto)?.[1] ?? '').trim());
  }
  if (lineas.length < 3) {
    return errorGeneral('Al archivo le falta alguna de las 3 líneas del encabezado.');
  }

  const errorEncabezado = revisarEncabezado(lineas);
  if (errorEncabezado) return errorGeneral(errorEncabezado);

  const nombrePorDocumento = new Map<string, { nombre: string; fila: number }>();
  const lineasEnvio: string[] = [];

  for (const { campos, linea: fila, crudo } of leerRegistros(texto, corte.lastIndex)) {
    revision.totalRegistros++;

    const valores: Fila = {};
    COLUMNAS_DETALLE_CARGA.forEach((columna, i) => valores[columna] = campos[i] ?? '');

    const errores = validarFila(fila, valores);

    // El mismo documento no puede tener nombres distintos
    const documento = valores['document_number'];
    const nombre = valores['client_name'];
    if (documento && nombre) {
      const previo = nombrePorDocumento.get(documento);
      if (!previo) {
        nombrePorDocumento.set(documento, { nombre, fila });
      } else if (previo.nombre.toLowerCase() !== nombre.toLowerCase()) {
        errores.push(errorDe(fila, 'client_name', nombre, `Mismo nombre que la fila ${previo.fila}`,
          `El documento '${documento}' aparece con nombres diferentes (fila ${previo.fila}).`, 'NOMBRE_DISTINTO'));
      }
    }

    // Solo se quitan las filas que el backend aceptaría; las demás las rechaza y cuenta él
    if (errores.length === 0 || errores.some(e => !e.codigo.startsWith('PROPIA_'))) {
      lineasEnvio.push(crudo);
    }

    if (errores.length > 0) {
      revision.filasConError++;
      errores.forEach(e => { if (revision.errores.length < MAXIMO_ERRORES) revision.errores.push(e); });
    } else {
      revision.filasValidas.push(fila);
    }

    // Deja respirar a la pantalla en archivos largos
    if (revision.totalRegistros % FILAS_POR_TANDA === 0) {
      await new Promise(listo => setTimeout(listo));
    }
  }

  if (revision.totalRegistros === 0) {
    return errorGeneral('El archivo no contiene registros de detalle para procesar.');
  }

  if (lineasEnvio.length === 0) {
    revision.archivoEnvio = null;
  } else if (lineasEnvio.length < revision.totalRegistros) {
    revision.archivoEnvio = new File(
      [[...lineas, ...lineasEnvio].join('\r\n') + '\r\n'], archivo.name, { type: 'text/csv' }
    );
  }

  return revision;
}

// ==================================================
// DESCARGAR LOS ERRORES EN CSV
// ==================================================

export function descargarErroresCsv(nombreArchivo: string, errores: ErrorCarga[]): void {

  const celda = (valor: string | number | null) => {
    let texto = valor === null ? '' : String(valor);
    // Evita que Excel ejecute como fórmula un dato que venga en el archivo
    if (/^[=+\-@\t\r]/.test(texto)) texto = `'${texto}`;
    return /[",;\n\r]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
  };

  const filas = [
    'Fila,Campo,Valor recibido,Valor esperado,Error,Código',
    ...errores.map(e => [e.fila, e.campo, e.valor, e.esperado, e.error, e.codigo].map(celda).join(','))
  ];

  const url = URL.createObjectURL(
    new Blob(['﻿' + filas.join('\r\n')], { type: 'text/csv;charset=utf-8' })
  );
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = `${(nombreArchivo || 'carga').replace(/\.(csv|txt)$/i, '').replace(/[^a-zA-Z0-9_-]/g, '_')}_errores.csv`;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
