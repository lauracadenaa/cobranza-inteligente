import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';

import { DashboardService } from '../../service/dashboard.service';
import { DashboardHeader } from '../../models/dashboard.models';

@Component({
  selector: 'app-dashboard-header',
  standalone: true,

  imports: [
    CommonModule
  ],

  templateUrl: './dashboard-header.component.html',
  styleUrl: './dashboard-header.component.css'
})

export class DashboardHeaderComponent implements OnInit {

  // ==================================================
  // DATOS DEL HEADER
  // ==================================================

  header!: DashboardHeader;


  // ==================================================
  // CONTROL DEL MODAL MOTOR IA
  // ==================================================

  isModalIAOpen = false;


  // ==================================================
  // CONSTRUCTOR
  // ==================================================

  constructor(
    private dashboardService: DashboardService
  ) { }


  // ==================================================
  // INICIALIZACIÓN
  // ==================================================

  ngOnInit(): void {

    this.dashboardService.getDashboardHeader().subscribe(data => {

      this.header = data;

    });

  }


  // ==================================================
  // ABRIR MODAL MOTOR IA
  // ==================================================

  abrirModalIA(): void {

    this.isModalIAOpen = true;

  }


  // ==================================================
  // CERRAR MODAL MOTOR IA
  // ==================================================

  cerrarModalIA(): void {

    this.isModalIAOpen = false;

  }

}
