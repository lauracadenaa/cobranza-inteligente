
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-cartera-rankings',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './cartera-rankings.component.html',
  styleUrl: './cartera-rankings.component.css'
})
export class CarteraRankingsComponent {

  cargarNuevaCartera(): void {
    window.dispatchEvent(new CustomEvent('cartera:navegar', {
      detail: 'Integración de cartera'
    }));
  }

  irColaGeneral(): void {
    window.dispatchEvent(new CustomEvent('cartera:navegar', {
      detail: 'Explorador de cartera'
    }));
  }

  generarReporteCartera(): void {
    alert('La generación del reporte se conectará con los datos reales de cartera.');
  }

  irCasosCriticos(): void {
    alert('La navegación a Gestión de casos críticos se conectará con la ruta correspondiente.');
  }
}
