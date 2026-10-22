import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { API_CONFIG } from '../config/api.config';

// ==================================================
// DATOS PARA INICIAR SESIÓN
// ==================================================
export interface LoginRequest {
  username: string;
  password: string;
}

// ==================================================
// RESPUESTA DEL INICIO DE SESIÓN
// ==================================================
export interface LoginResponse {
  token: string;
  refreshToken: string;
  userId: number;
  username: string;
  email: string;
  role: 'ADMIN' | 'SUPERVISOR' | 'AGENT' | 'AUDIT';
  mustChangePassword: boolean;
}

// ==================================================
// DATOS PARA CAMBIAR LA CONTRASEÑA
// ==================================================
export interface ChangePasswordRequest {
  oldPassword: string;
  newPassword: string;
}

// ==================================================
// DATOS PARA INICIAR RECUPERACIÓN
// ==================================================
export interface PasswordRecoveryStartRequest {
  username: string;
  email: string;
}

// ==================================================
// DATOS PARA VALIDAR EL CÓDIGO OTP
// ==================================================
export interface PasswordRecoveryVerifyRequest {
  username: string;
  email: string;
  pin: string;
}

// ==================================================
// DATOS PARA RESTABLECER LA CONTRASEÑA
// ==================================================
export interface PasswordRecoveryResetRequest {
  resetToken: string;
  newPassword: string;
}

// ==================================================
// RESPUESTA DE RECUPERACIÓN
// ==================================================
export interface PasswordRecoveryResponse {
  message: string;
  resetToken: string | null;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {

  // ==================================================
  // CONEXIÓN HTTP
  // ==================================================
  private http = inject(HttpClient);

  // ==================================================
  // DIRECCIONES DEL BACKEND
  // ==================================================
  private loginUrl = `${API_CONFIG.baseUrl}/auth/login`;
  private changePasswordUrl = `${API_CONFIG.baseUrl}/auth/change-password`;

  private recoveryStartUrl = `${API_CONFIG.baseUrl}/auth/password-recovery/start`;
  private recoveryVerifyUrl = `${API_CONFIG.baseUrl}/auth/password-recovery/verify`;
  private recoveryResetUrl = `${API_CONFIG.baseUrl}/auth/password-recovery/reset`;

  // ==================================================
  // INICIAR SESIÓN
  // ==================================================
  iniciarSesion(datos: LoginRequest): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(this.loginUrl, datos);
  }

  // ==================================================
  // CAMBIAR CONTRASEÑA OBLIGATORIAMENTE
  // ==================================================
  cambiarPassword(datos: ChangePasswordRequest): Observable<string> {
    return this.http.post(
      this.changePasswordUrl,
      datos,
      { responseType: 'text' }
    );
  }

  // ==================================================
  // INICIAR RECUPERACIÓN DE CONTRASEÑA
  // ==================================================
  iniciarRecuperacion(
    datos: PasswordRecoveryStartRequest
  ): Observable<PasswordRecoveryResponse> {
    return this.http.post<PasswordRecoveryResponse>(
      this.recoveryStartUrl,
      datos
    );
  }

  // ==================================================
  // VALIDAR CÓDIGO OTP
  // ==================================================
  verificarCodigo(
    datos: PasswordRecoveryVerifyRequest
  ): Observable<PasswordRecoveryResponse> {
    return this.http.post<PasswordRecoveryResponse>(
      this.recoveryVerifyUrl,
      datos
    );
  }

  // ==================================================
  // RESTABLECER CONTRASEÑA
  // ==================================================
  restablecerPassword(
    datos: PasswordRecoveryResetRequest
  ): Observable<PasswordRecoveryResponse> {
    return this.http.post<PasswordRecoveryResponse>(
      this.recoveryResetUrl,
      datos
    );
  }

}