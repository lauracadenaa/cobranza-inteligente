
import { Component, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-cartera-tabs',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './cartera-tabs.component.html',
  styleUrl: './cartera-tabs.component.css'
})
export class CarteraTabsComponent {

  @Output() pestanaSeleccionada = new EventEmitter<string>();

  pestanas: string[] = [
    'Integración de cartera',
    'Segmentos',
    'Análisis de cartera',
  ];

  pestanaActiva = 'Integración de cartera';

  seleccionarPestana(nombre: string): void {
    this.pestanaActiva = nombre;
    this.pestanaSeleccionada.emit(nombre);
  }
}