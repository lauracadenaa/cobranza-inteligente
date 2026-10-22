import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.css',
  imports: [CommonModule],
})

export class SidebarComponent {

  // ==================================================
  // NAVEGACIÓN
  // ==================================================

  private router = inject(Router);


  // ==================================================
  // OPCIÓN DEL MENÚ SELECCIONADA
  // ==================================================

  opcionSeleccionada = 'Inicio';


  // ==================================================
  // CAMBIAR OPCIÓN SELECCIONADA
  // ==================================================

  seleccionarOpcion(opcion: string): void {
    this.opcionSeleccionada = opcion;
  }


  // ==================================================
// MODAL CERRAR SESIÓN
// ==================================================

// Controla si el modal está visible
mostrarModalCerrarSesion = false;


// ==================================================
// ABRIR MODAL
// ==================================================

cerrarSesion(): void {
  this.mostrarModalCerrarSesion = true;
}


// ==================================================
// CANCELAR CIERRE DE SESIÓN
// ==================================================

cancelarCerrarSesion(): void {
  this.mostrarModalCerrarSesion = false;
}


// ==================================================
// CONFIRMAR CIERRE DE SESIÓN
// ==================================================

confirmarCerrarSesion(): void {

  // Eliminar los datos de autenticación
  sessionStorage.removeItem('token');
  sessionStorage.removeItem('refreshToken');

  // Redirigir al login
  void this.router.navigateByUrl('/login');

}
}