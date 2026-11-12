
import { Routes } from '@angular/router';

import { DashboardComponent } from './components/dashboard/dashboard.component';
import { LoginComponent } from './components/login/login.component';
import { CarteraComponent } from './modules/Cartera/components/cartera.component';
import { GestionCasosComponent } from './modules/Gestion de casos/components/gestion-casos.component';

export const routes: Routes = [

  // Inicio de sesión
  {
    path: 'login',
    component: LoginComponent
  },

  // Cambio obligatorio de contraseña
  {
    path: 'change-password',
    component: LoginComponent
  },

  // Dashboard
  {
    path: 'dashboard',
    component: DashboardComponent
  },

  // Módulo Cartera
  {
    path: 'cartera',
    component: CarteraComponent
  },

  // Módulo Gestión de casos
  {
    path: 'gestion-casos',
    component: GestionCasosComponent
  },

  // Ruta inicial
  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full'
  }

];
