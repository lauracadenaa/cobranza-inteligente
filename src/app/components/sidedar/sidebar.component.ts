import { Component } from '@angular/core';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.css'
})
export class SidebarComponent {

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

}