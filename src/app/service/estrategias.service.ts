import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import { API_CONFIG } from '../core/config/api.config';

// ==================================================
// PLANTILLAS DE MENSAJE (/strategy/templates)
// ==================================================

export interface PlantillaBackend {
  id: number;
  nombre: string;
  canal: string;              // EMAIL, SMS, WHATSAPP...
  segmento?: string | null;   // PREVENTIVA, ADMINISTRATIVA, PREJUDICIAL, JURIDICA
  contenido?: string | null;  // HTML base de la plantilla
  activa: boolean;
  createdAt?: string | null;
  updatedAt?: string | null;

  // Partes editables del mensaje
  asunto?: string | null;
  saludo?: string | null;
  mensajePrincipal?: string | null;
  textoAntesBoton?: string | null;
  textoBoton?: string | null;
  despedida?: string | null;
  footer?: string | null;
  avisoLegal?: string | null;
  plantillaSms?: string | null;
}

// Para crear: nombre, canal y contenido son obligatorios
export interface CrearPlantillaBackend {
  nombre: string;
  canal: string;
  segmento: string | null;
  contenido: string;
  activa: boolean;
  asunto?: string | null;
  plantillaSms?: string | null;
}

// Para editar solo se pueden cambiar las partes editables y si está activa
export interface EditarPlantillaBackend {
  asunto?: string | null;
  saludo?: string | null;
  mensajePrincipal?: string | null;
  textoAntesBoton?: string | null;
  textoBoton?: string | null;
  despedida?: string | null;
  footer?: string | null;
  avisoLegal?: string | null;
  plantillaSms?: string | null;
  activa?: boolean;
}

// ==================================================
// SEGMENTACIÓN
// ==================================================

// Regla que decide a qué segmento va una obligación según sus días de mora
export interface ReglaSegmentoBackend {
  id: number;
  segment: string;
  minDays: number;
  maxDays: number | null;     // null = sin tope
  label?: string | null;
  casePriority?: string | null;
  active?: boolean;
  updatedAt?: string | null;
}

// Cuántas obligaciones hay en cada segmento
export interface CarteraSegmentoBackend {
  segment: string;            // viene con nombre amigable: "Preventiva", "Jurídica"...
  obligationCount: number;
  totalAmount: number;
  percentageOfPortfolio: number;
}

export interface PaginaConTotal {
  totalElements: number;
}

// ==================================================
// SERVICIO DE ESTRATEGIAS
// ==================================================

@Injectable({ providedIn: 'root' })
export class EstrategiasService {

  private http = inject(HttpClient);
  private baseUrl = API_CONFIG.baseUrl;

  // ----- Plantillas -----

  listarPlantillas(): Observable<PlantillaBackend[]> {
    return this.http.get<PlantillaBackend[]>(`${this.baseUrl}/strategy/templates`);
  }

  crearPlantilla(datos: CrearPlantillaBackend): Observable<PlantillaBackend> {
    return this.http.post<PlantillaBackend>(`${this.baseUrl}/strategy/templates`, datos);
  }

  editarPlantilla(id: number, datos: EditarPlantillaBackend): Observable<PlantillaBackend> {
    return this.http.put<PlantillaBackend>(`${this.baseUrl}/strategy/templates/${id}`, datos);
  }

  // ----- Segmentación -----

  listarReglasSegmento(): Observable<ReglaSegmentoBackend[]> {
    return this.http.get<ReglaSegmentoBackend[]>(`${this.baseUrl}/scoring/workflow-config/segment-rules`);
  }

  carteraPorSegmento(): Observable<CarteraSegmentoBackend[]> {
    return this.http.get<CarteraSegmentoBackend[]>(`${this.baseUrl}/admin/dashboard/portfolio/segment`);
  }

  // Solo interesa el total de asociados, por eso se pide una página de 1
  contarAsociados(segmento: string): Observable<PaginaConTotal> {
    const params = new HttpParams().set('page', 0).set('size', 1);
    return this.http.get<PaginaConTotal>(`${this.baseUrl}/portfolio/clients/segment/${segmento}`, { params });
  }

}
