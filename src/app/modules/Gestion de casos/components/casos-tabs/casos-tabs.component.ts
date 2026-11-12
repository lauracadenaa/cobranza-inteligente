
import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-casos-tabs',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './casos-tabs.component.html',
  styleUrl: './casos-tabs.component.css'
})
export class CasosTabsComponent {

  @Input() pestanaActiva: string = 'Cola general';

  @Output() pestanaSeleccionada = new EventEmitter<string>();

  pestanas: string[] = [
    'Cola general',
    'Mis casos',
    'Sin asignar',
    'Desbordes IA',
    'Casos críticos',
    'Prejurídicos'
  ];

  seleccionarPestana(nombre: string): void {
    this.pestanaSeleccionada.emit(nombre);
  }
}
