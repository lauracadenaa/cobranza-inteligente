
import { Routes } from '@angular/router';

import { DashboardComponent } from './components/dashboard/dashboard.component';
import { LoginComponent } from './components/login/login.component';

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

  // Ruta inicial
  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full'
  }

];