import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import { API_CONFIG } from '../core/config/api.config';

// ==================================================
// LO QUE ENVÍA Y DEVUELVE EL BACKEND (/admin/users)
// ==================================================

// Estados posibles de un usuario en el backend
export type EstadoUsuarioBackend = 'ACTIVE' | 'SUSPENDED' | 'INACTIVE';

// Un usuario tal como lo devuelve el backend
export interface UsuarioBackend {
  id: number;
  username: string;
  email: string;
  fullName: string;
  roleName: string;          // ADMIN, SUPERVISOR, AGENT, AUDIT...
  status: EstadoUsuarioBackend;
  createdAt?: string | null;
  lastLogin?: string | null;
  mustChangePassword?: boolean;
  temporaryPassword?: string | null;   // solo viene al crear
}

// Un rol tal como lo devuelve el backend
export interface RolBackend {
  id: number;
  name: string;
  description?: string | null;
}

// Datos para crear un usuario (la contraseña la genera el backend)
export interface CrearUsuarioBackend {
  username: string;
  email: string;
  fullName: string;
  roleId: number;
}

// Datos para editar un usuario.
// Ojo: el backend NO deja cambiar el nombre completo ni el nombre de usuario.
export interface EditarUsuarioBackend {
  email: string;
  fullName: string;   // se manda igual al actual; si cambia, el backend lo rechaza
  roleId: number;
  status: EstadoUsuarioBackend;
}

// Respuesta al resetear la contraseña
export interface ResetPasswordBackend {
  message: string;
  temporaryPassword: string;
  username: string;
}

// ==================================================
// SERVICIO DE USUARIOS (pantalla Administración > Usuarios)
// ==================================================

@Injectable({ providedIn: 'root' })
export class UsuariosAdminService {

  private http = inject(HttpClient);
  private url = `${API_CONFIG.baseUrl}/admin/users`;

  // Lista de usuarios. Con incluirInactivos = true trae también los desactivados.
  listar(incluirInactivos = true): Observable<UsuarioBackend[]> {
    const params = new HttpParams().set('includeInactive', incluirInactivos);
    return this.http.get<UsuarioBackend[]>(this.url, { params });
  }

  // Roles que se pueden asignar
  listarRoles(): Observable<RolBackend[]> {
    return this.http.get<RolBackend[]>(`${this.url}/roles`);
  }

  crear(datos: CrearUsuarioBackend): Observable<UsuarioBackend> {
    return this.http.post<UsuarioBackend>(this.url, datos);
  }

  editar(id: number, datos: EditarUsuarioBackend): Observable<UsuarioBackend> {
    return this.http.put<UsuarioBackend>(`${this.url}/${id}`, datos);
  }

  // Activo <-> Suspendido
  alternarEstado(id: number): Observable<void> {
    return this.http.patch<void>(`${this.url}/${id}/toggle-status`, {});
  }

  // El backend no borra el usuario: lo deja INACTIVO y bloqueado
  desactivar(id: number): Observable<void> {
    return this.http.delete<void>(`${this.url}/${id}`);
  }

  // Genera una contraseña temporal nueva
  resetearPassword(id: number): Observable<ResetPasswordBackend> {
    return this.http.post<ResetPasswordBackend>(`${this.url}/${id}/reset-password`, {});
  }

}
