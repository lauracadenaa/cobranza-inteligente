
import { Injectable } from '@angular/core';

import {
  HttpClient,
  HttpEvent,
  HttpParams
} from '@angular/common/http';

import { Observable } from 'rxjs';

import { API_CONFIG } from '../core/config/api.config';

// ==================================================
// ERRORES POR FILA
// ==================================================

export interface BatchRowError {
  rowNumber: number;
  field: string;
  value: string;
  expectedValue: string;
  message: string;
  marker: string;
  errorCode: string;
}

// ==================================================
// RESUMEN DE ERRORES
// ==================================================

export interface BatchErrorSummary {
  motivo: string;
  records: number;
  errors: number;
}

// ==================================================
// RESPUESTA DE CARGA CSV
// ==================================================

export interface BatchUploadResponse {
  batchId: number;
  batchNumber: string;
  lote: string;
  status: string;
  totalRecords: number;
  stagedRecords: number;
  validRecords: number;
  failedRecords: number;
  totalErrors: number;
  clientsUpserted: number;
  obligationsUpserted: number;
  casesCreated: number;
  scoresGenerated: number;
  scoresFailed: number;
  rowErrors: BatchRowError[];
  errorSummary: BatchErrorSummary[];
  message: string;
}

// ==================================================
// DETALLE Y PROGRESO DE UN LOTE
// ==================================================

export interface BatchDetailResponse {
  batchId: number;
  batchNumber: string;
  status: string;
  totalRecords: number;
  processedRecords: number;
  successfulRecords: number;
  failedRecords: number;
  progressPhase: string;
  progressCurrent: number;
  progressTotal: number;
  progressPercent: number;
  progressMessage: string;
  processedAt: string | null;
  message: string;
}

// ==================================================
// HISTORIAL DE LOTES
// ==================================================

export interface BatchHistoryItem {
  id: number;
  batchNumber: string;
  fileName: string;
  fileSize: number;
  status: string;
  totalRecords: number;
  successfulRecords: number;
  failedRecords: number;
  casesCreated?: number;
  progressPhase: string;
  progressCurrent: number;
  progressTotal: number;
  progressPercent: number;
  progressMessage: string;
  progressUpdatedAt: string;
  errorMessage: string;
  parentBatchId: number;
  rootBatchId: number;
  createdBy: number;
  uploadedByUsername: string;
  uploadedByName: string;
  uploadedAt: string;
  processedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BatchHistoryResponse {
  totalPages: number;
  totalElements: number;
  pageable: {
    paged: boolean;
    pageNumber: number;
    pageSize: number;
    unpaged: boolean;
    offset: number;
  };
  first: boolean;
  last: boolean;
  size: number;
  content: BatchHistoryItem[];
  number: number;
  numberOfElements: number;
  empty: boolean;
}

// ==================================================
// CLIENTES POR SEGMENTO
// ==================================================

export type TipoSegmento =
  | 'PREVENTIVA'
  | 'ADMINISTRATIVA'
  | 'PREJUDICIAL'
  | 'JURIDICA';

export interface ClienteSegmento {
  id: number;
  documentType: string;
  documentNumber: string;
  fullName: string;
  email: string;
  phone: string | null;
  mobile: string | null;
  address: string | null;
  city: string | null;
  department: string | null;
  country: string | null;
  segment: string;
  riskLevel: string;
  creditScore: number;
  totalDebt: number | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  escalated: boolean;
}

// ==================================================
// RESPUESTA DE CLIENTES POR SEGMENTO
// ==================================================

export interface ClientesSegmentoResponse {
  content: ClienteSegmento[];
  totalPages: number;
  totalElements: number;
  number: number;
  size: number;
  numberOfElements: number;
  first: boolean;
  last: boolean;
  empty: boolean;
}

// ==================================================
// NIVELES DE RIESGO
// ==================================================

export type TipoRiesgo =
  | 'BAJO'
  | 'MEDIO'
  | 'ALTO'
  | 'CRITICO';

export interface ClientesRiesgoResponse {
  content: ClienteSegmento[];
  totalPages: number;
  totalElements: number;
  number: number;
  size: number;
  numberOfElements: number;
  first: boolean;
  last: boolean;
  empty: boolean;
}

// ==================================================
// OBLIGACIONES
// GET /portfolio/obligations
// ==================================================

export interface ObligacionCartera {
  id: number;
  clientId: number;
  obligationNumber: string;
  principalAmount: number;
  currentBalance: number;
  accruedInterest: number;
  accruedFees: number;
  totalBalance: number;
  currency: string;
  daysPastDue: number;
  segment: string;
  status: string;
  originalDueDate: string;
  lastPaymentDate: string | null;
  createdAt: string;
  updatedAt: string;
}

// ==================================================
// RESPUESTA PAGINADA DE OBLIGACIONES
// ==================================================

export interface ObligacionesResponse {
  content: ObligacionCartera[];
  totalPages: number;
  totalElements: number;
  number: number;
  size: number;
  numberOfElements: number;
  first: boolean;
  last: boolean;
  empty: boolean;
}

// ==================================================
// SOLICITUD PARA GENERAR LINK DE PAGO
// POST /v1/payments/generate-link
// ==================================================

export interface PaymentLinkRequest {
  clientId: number;
  obligationId: number;
  paymentAgreementId: number | null;
  amount: number;
  currency: string;
  channel: string;
  expiresInHours: number;
}

// ==================================================
// RESPUESTA DE GENERACIÓN DEL LINK DE PAGO
// ==================================================

export interface PaymentLinkDetailDTO {
  id: number;
  token: string;
  generatedUrl: string;
  clientId: number;
  clientName: string;
  documentType: string;
  documentNumber: string;
  obligationId: number;
  obligationNumber: string;
  obligationAmount: number;
  daysPastDue: number;
  obligationStatus: string;
  amount: number;
  currency: string;
  channel: string;
  status: string;
  transactionStatus: string;
  expiresAt: string;
  createdAt: string;
  zolevPaymentId: string;
}

// ==================================================
// DECISIONES DE IA POR CASO
// GET /ai-engine/decisions/case/{caseId}
// ==================================================

export interface DecisionIACaso {
  id: number;
  clientId: number;
  caseId: number;
  obligationId: number;
  score: number;
  riskSegment: string;
  channelSelected: string;
  templateId: number;
  apiProvider: string;
  apiStatus: string;
  apiResponse: string;
  engineStatus: string;
  engineSource: string;
  fallbackUsed: boolean;
  paymentLinkGenerated: boolean;
  paymentLinkOpened: boolean;
  paymentCompleted: boolean;
  paymentChannel: string;
  amountCollected: number;
  humanOverflow: boolean;
  attemptNumber: number;
  createdAt: string;
  updatedAt: string;
}

// ==================================================
// RESPUESTA PAGINADA DE DECISIONES DE IA
// ==================================================

export interface DecisionesIACasoResponse {
  totalPages: number;
  totalElements: number;
  pageable: {
    paged: boolean;
    pageNumber: number;
    pageSize: number;
    unpaged: boolean;
    offset: number;
    sort: {
      sorted: boolean;
      unsorted: boolean;
      empty: boolean;
    };
  };
  first: boolean;
  last: boolean;
  size: number;
  content: DecisionIACaso[];
  number: number;
  numberOfElements: number;
  empty: boolean;
}

// ==================================================
// SERVICIO DE CARTERA
// ==================================================

@Injectable({
  providedIn: 'root'
})
export class CarteraService {

  private readonly baseUrl = API_CONFIG.baseUrl;

  constructor(
    private http: HttpClient
  ) {}

  // ==================================================
  // CARGAR ARCHIVO CSV
  // POST /integration/batches/csv/upload
  // ==================================================

  uploadCsv(
    file: File
  ): Observable<HttpEvent<BatchUploadResponse>> {

    const formData = new FormData();
    formData.append('file', file);

    return this.http.post<BatchUploadResponse>(
      `${this.baseUrl}/integration/batches/csv/upload`,
      formData,
      {
        observe: 'events',
        reportProgress: true
      }
    );
  }

  // ==================================================
  // CONSULTAR HISTORIAL DE LOTES
  // GET /integration/batches
  // ==================================================

  getBatches(
    page: number = 0,
    size: number = 10
  ): Observable<BatchHistoryResponse> {

    const params = new HttpParams()
      .set('page', page)
      .set('size', size);

    return this.http.get<BatchHistoryResponse>(
      `${this.baseUrl}/integration/batches`,
      { params }
    );
  }

  // ==================================================
  // CONSULTAR PROGRESO DE UN LOTE
  // GET /integration/batches/{id}
  // ==================================================

  getBatch(
    id: number
  ): Observable<BatchDetailResponse> {

    return this.http.get<BatchDetailResponse>(
      `${this.baseUrl}/integration/batches/${id}`
    );
  }

  // ==================================================
  // DESCARGAR REPORTE CSV DE ERRORES
  // GET /integration/batches/{id}/error-report
  // ==================================================

  downloadBatchErrorReport(
    id: number
  ): Observable<Blob> {

    return this.http.get(
      `${this.baseUrl}/integration/batches/${id}/error-report`,
      {
        responseType: 'blob'
      }
    );
  }

  // ==================================================
  // CONSULTAR CLIENTES POR SEGMENTO
  // GET /portfolio/clients/segment/{segment}
  // ==================================================

  getClientsBySegment(
    segment: TipoSegmento,
    page: number = 0,
    size: number = 10
  ): Observable<ClientesSegmentoResponse> {

    const params = new HttpParams()
      .set('page', page)
      .set('size', size);

    return this.http.get<ClientesSegmentoResponse>(
      `${this.baseUrl}/portfolio/clients/segment/${segment}`,
      { params }
    );
  }

  // ==================================================
  // CONSULTAR CLIENTES POR NIVEL DE RIESGO
  // GET /portfolio/clients/risk-level/{riskLevel}
  // ==================================================

  getClientsByRiskLevel(
    riskLevel: TipoRiesgo,
    page: number = 0,
    size: number = 100
  ): Observable<ClientesRiesgoResponse> {

    const params = new HttpParams()
      .set('page', page)
      .set('size', size);

    return this.http.get<ClientesRiesgoResponse>(
      `${this.baseUrl}/portfolio/clients/risk-level/${riskLevel}`,
      { params }
    );
  }

  // ==================================================
  // CONSULTAR OBLIGACIONES
  // GET /portfolio/obligations
  // ==================================================

  getObligations(
    page: number = 0,
    size: number = 100
  ): Observable<ObligacionesResponse> {

    const params = new HttpParams()
      .set('page', page)
      .set('size', size);

    return this.http.get<ObligacionesResponse>(
      `${this.baseUrl}/portfolio/obligations`,
      { params }
    );
  }

  // ==================================================
  // CONSULTAR RESUMEN DE SCORING
  // GET /scoring/{clientId}/summary
  // ==================================================

  getScoreSummary(
    clientId: number
  ): Observable<ScoreSummary> {

    return this.http.get<ScoreSummary>(
      `${this.baseUrl}/scoring/${clientId}/summary`
    );
  }

  // ==================================================
  // CONSULTAR DETALLE DE UN CLIENTE
  // GET /portfolio/clients/{id}
  // ==================================================

  getClientById(
    id: number
  ): Observable<ClienteSegmento> {

    return this.http.get<ClienteSegmento>(
      `${this.baseUrl}/portfolio/clients/${id}`
    );
  }

  // ==================================================
  // GENERAR LINK DE PAGO
  // POST /v1/payments/generate-link
  // ==================================================

  generatePaymentLink(
    request: PaymentLinkRequest
  ): Observable<PaymentLinkDetailDTO> {

    return this.http.post<PaymentLinkDetailDTO>(
      `${this.baseUrl}/v1/payments/generate-link`,
      request
    );
  }

  // ==================================================
  // HISTORIAL DE MENSAJES DE COBRANZA POR CLIENTE
  // GET /cobranza/historial/cliente/{clienteId}
  // ==================================================

  getHistorialMensajesCliente(
    clienteId: number
  ): Observable<unknown> {

    return this.http.get<unknown>(
      `${this.baseUrl}/cobranza/historial/cliente/${clienteId}`
    );
  }

  // ==================================================
  // HISTORIAL DE MENSAJES DE COBRANZA POR OBLIGACIÓN
  // GET /cobranza/historial/obligacion/{obligacionId}
  // ==================================================

  getHistorialMensajesObligacion(
    obligacionId: number
  ): Observable<unknown> {

    return this.http.get<unknown>(
      `${this.baseUrl}/cobranza/historial/obligacion/${obligacionId}`
    );
  }

  // ==================================================
  // HISTORIAL DE INTENTOS DE CONTACTO POR CLIENTE
  // GET /strategy/contact/attempts/client/{clientId}
  // ==================================================

  getIntentosContactoCliente(
    clientId: number
  ): Observable<unknown> {

    return this.http.get<unknown>(
      `${this.baseUrl}/strategy/contact/attempts/client/${clientId}`
    );
  }

  // ==================================================
  // DECISIONES DE IA POR CASO
  // GET /ai-engine/decisions/case/{caseId}
  // ==================================================

  getDecisionesIAporCaso(
    caseId: number,
    page: number = 0,
    size: number = 20
  ): Observable<DecisionesIACasoResponse> {

    const params = new HttpParams()
      .set('page', page)
      .set('size', size);

    return this.http.get<DecisionesIACasoResponse>(
      `${this.baseUrl}/ai-engine/decisions/case/${caseId}`,
      { params }
    );
  }

}

// ==================================================
// IMPACTO DE VARIABLES DEL SCORE
// ==================================================

export interface ScoreFeatureImpact {
  feature: string;
  value: number;
  weight: number;
  normalized_weight: number;
  base_score: number;
  impact: number;
  range_min: number;
  range_max: number;
}

// ==================================================
// RESULTADO DEL CÁLCULO DE SCORING
// ==================================================

export interface ScoreCalculationResult {
  credit_score: number;
  risk_level: string;
  risk_score: number;
  collection_probability: number;
  recommended_segment: string;
  inputs: Record<string, number>;
  feature_impacts: ScoreFeatureImpact[];
  calculation_source: string;
  engine: string;
  model_version: string;
  fallbackReason: string | null;
  recommended_channel: string;
  next_action: string;
  configuration_version: string;
}

// ==================================================
// RESUMEN DEL SCORING
// ==================================================

export interface ScoreSummary {
  calculationSource: string | null;
  creditScore: number;
  fallbackReason: string | null;
  calculationDetail: {
    result: ScoreCalculationResult;
    model_version: string;
    inputs: Record<string, number>;
    snapshot_hash: string;
  };
  collectionProbability: number;
  recommendedSegment: string;
  modelVersion: string;
  engineUsed: string;
  id: number;
  riskScore: number;
  calculatedAt: string;
}
