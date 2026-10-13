
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { API_CONFIG } from '../config/api.config';

// Datos que enviamos al backend para iniciar sesión
export interface LoginRequest {
  username: string;
  password: string;
}

// Respuesta que esperamos recibir del backend
export interface LoginResponse {
  token: string;
  refreshToken: string;
  userId: number;
  username: string;
  email: string;
  role: 'ADMIN' | 'SUPERVISOR' | 'AGENT' | 'AUDIT';
  mustChangePassword: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {

  // Permite enviar peticiones al servidor
  private http = inject(HttpClient);

  // Dirección del inicio de sesión
  private loginUrl = `${API_CONFIG.baseUrl}/auth/login`;

  // Enviar usuario y contraseña al backend
  iniciarSesion(datos: LoginRequest): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(this.loginUrl, datos);
  }
}
