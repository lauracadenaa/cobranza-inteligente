// ==================================================
// PLANTILLA DEL ARCHIVO DE CARGA DE CARTERA
// Se arma aquí mismo, en el navegador (no usa el backend).
// Sigue la estructura que espera el backend:
//   Fila 1: nombres del encabezado del lote
//   Fila 2: valores del encabezado
//   Fila 3: nombres de las columnas de detalle
//   Fila 4+: registros
// ==================================================

export const COLUMNAS_DETALLE_CARGA = [
  'document_type',
  'document_number',
  'client_name',
  'obligation_id',
  'obligation_amount',
  'due_date',
  'days_past_due',
  'currency',
  'mobile',
  'email',
  'affiliation_date'
];

export function descargarPlantillaCarga(): void {

  const hoy = new Date().toISOString().slice(0, 10);

  const lineas = [
    'fecha,consecutivo,cantidad,lote',
    `${hoy},0001,1,LOTE-0001`,
    COLUMNAS_DETALLE_CARGA.join(','),
    `CC,1234567890,Nombre Ejemplo,OBL-000001,1500000.00,${hoy},30,COP,3001234567,cliente@ejemplo.com,2020-01-15`
  ];

  const archivo = new Blob([lineas.join('\r\n') + '\r\n'], {
    type: 'text/csv;charset=utf-8'
  });

  const url = URL.createObjectURL(archivo);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = 'plantilla_carga_cartera.csv';
  enlace.click();
  URL.revokeObjectURL(url);
}
