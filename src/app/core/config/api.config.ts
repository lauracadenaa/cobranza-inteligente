
export const API_CONFIG = {

  // ==================================================
  // DIRECCIONES DEL BACKENDAuthorization
  // ==================================================

  urls: {
    pruebas: 'https://pruebas.bankvision.com/bankvision-cobranza-api/api',
    local: 'http://localhost:8080/api'
  },

  // ==================================================
  // ENTORNO ACTUAL
  // ==================================================

  // Opciones: 'local' o 'pruebas'
  entorno: 'local' as 'local' | 'pruebas',

  // ==================================================
  // DIRECCIÓN QUE UTILIZARÁN LOS SERVICIOS
  // ==================================================

  get baseUrl(): string {
    return this.urls[this.entorno];
  }

};
 