
import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { API_CONFIG } from '../config/api.config';

// ==================================================
// INTERCEPTOR DE AUTENTICACIÓN
// ==================================================

export const authInterceptor: HttpInterceptorFn = (req, next) => {

  const router = inject(Router);

  // Solo intervenir las peticiones dirigidas a nuestra API
  if (!req.url.startsWith(API_CONFIG.baseUrl)) {
    return next(req);
  }

  // No enviar un token anterior al iniciar sesión
  if (req.url.includes('/auth/login')) {
    return next(req);
  }

  // Recuperar el token guardado al iniciar sesión
  const token = sessionStorage.getItem('token');

  // Agregar el token al encabezado de autenticación
  const peticionAutenticada = token
    ? req.clone({
        setHeaders: {
          Authorization: `Bearer ${token}`
        }
      })
    : req;

  // Enviar petición y detectar errores del backend
  return next(peticionAutenticada).pipe(

    catchError((error: HttpErrorResponse) => {

      // Detectar el bloqueo por cambio obligatorio de contraseña
      if (
        error.status === 403 &&
        error.error?.code === 'PASSWORD_CHANGE_REQUIRED'
      ) {

        const ruta = error.error?.redirectTo || '/change-password';

        console.warn(
          'El usuario debe cambiar su contraseña antes de continuar.'
        );

        // Redirigir a la pantalla de cambio obligatorio
        void router.navigateByUrl(ruta);
      }

      // Mantener el error disponible para el componente que hizo la petición
      return throwError(() => error);
    })
  );
};