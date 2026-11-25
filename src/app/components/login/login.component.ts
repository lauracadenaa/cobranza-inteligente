import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

import {
  Component,
  OnInit,
  OnDestroy,
  inject,
  ChangeDetectorRef
} from '@angular/core';

import { IconoComponent } from '../../shared/icono/icono.component';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, IconoComponent],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent implements OnInit, OnDestroy {

  onBackdropClick(event: MouseEvent, modal: string): void {

  // Verifica si el clic se hizo directamente sobre el fondo del modal
  if (event.target === event.currentTarget) {

    // Evita cerrar el modal de cambio obligatorio de contraseña
    if (modal === 'cambioInicial') {
      return;
    }

    this.cerrarModales();
  }
}

  // ==================================================
  // SERVICIOS
  // ==================================================

  private authService = inject(AuthService);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);

  cargandoLogin = false;

  // ==================================================
  // DATOS DEL LOGIN
  // ==================================================

  usuario = '';
  password = '';
  mostrarPasswordMain = false;
  mensajeLogin = '';
  colorMensajeLogin = '#EF4444';

  // ==================================================
  // CONTROL DE MODALES
  // ==================================================

  modalActivo:
    | 'none'
    | 'recuperar'
    | 'otp'
    | 'cambio'
    | 'cambioInicial'
    | 'exito' = 'none';

  // ==================================================
  // MODAL: RECUPERAR CONTRASEÑA
  // ==================================================

  usuarioRecuperacion = '';
  correoCorporativo = '';
  mensajeRecuperacion = '';
  cargandoRecuperacion = false;

  // ==================================================
// DATOS DE RECUPERACIÓN DEVUELTOS POR EL BACKEND
// ==================================================

    resetTokenRecuperacion: string | null = null;

    cargandoOtp = false;
    mensajeOtp = '';

    cargandoCambioRecuperacion = false;
    mensajeBackendPassword = '';

  // ==================================================
  // MODAL: OTP
  // ==================================================

  otp1 = '';
  otp2 = '';
  otp3 = '';
  otp4 = '';
  otp5 = '';
  otp6 = '';

  tiempoRestante = 300;
  intervaloTemporizador: ReturnType<typeof setInterval> | null = null;

  errorOtp = false;
  otpCorrecto = false;
  mensajeReenvio = false;

  // ==================================================
  // MODAL: CAMBIO DE CONTRASEÑA (RECUPERACIÓN)
  // ==================================================

  nuevaPassword = '';
  confirmarPassword = '';
  mostrarNuevaPassword = false;
  mostrarConfirmarPassword = false;
  mensajePasswordError = false;

  reqMin12 = false;
  reqMayuscula = false;
  reqMinuscula = false;
  reqNumero = false;
  reqEspecial = false;

  coloresSeguridad = ['#E2E8F0', '#E2E8F0', '#E2E8F0'];

  // ==================================================
  // MODAL: ACTUALIZACIÓN INICIAL DE CONTRASEÑA
  // ==================================================

  passwordTemporal = '';
  nuevaPasswordInicial = '';
  confirmarPasswordInicial = '';

  mostrarPasswordTemporal = false;
  mostrarNuevaPasswordInicial = false;
  mostrarConfirmarPasswordInicial = false;

  mensajePasswordInicialError = false;

  reqMin12Inicial = false;
  reqMayusculaInicial = false;
  reqMinusculaInicial = false;
  reqNumeroInicial = false;
  reqEspecialInicial = false;

  coloresSeguridadInicial = ['#E2E8F0', '#E2E8F0', '#E2E8F0'];

  cargandoCambioInicial = false;
  mensajeErrorCambioInicial = '';

  // ==================================================
  // INICIALIZACIÓN Y DESTRUCCIÓN
  // ==================================================

  ngOnInit(): void {

    // Si el usuario llega a la ruta de cambio obligatorio
    if (this.router.url === '/change-password') {

      const token = sessionStorage.getItem('token');

      // Sin token no puede cambiar la contraseña
      if (!token) {
        void this.router.navigate(['/login']);
        return;
      }

      // Mostrar el modal obligatorio
      this.abrirModal('cambioInicial');
    }
  }

  ngOnDestroy(): void {
    this.limpiarTemporizador();
    document.body.style.overflow = '';
  }

  // ==================================================
  // ABRIR MODALES
  // ==================================================

  abrirModal(
    modal: 'recuperar' | 'otp' | 'cambio' | 'cambioInicial' | 'exito'
  ): void {

    this.modalActivo = modal;
    document.body.style.overflow = 'hidden';

    if (modal === 'recuperar') {
      this.limpiarPrimerModal();
    }

    if (modal === 'otp') {
      this.limpiarSegundoModal();
      this.iniciarTemporizador();
    }

    if (modal === 'cambio') {
      this.limpiarTercerModal();
    }
  }

  // ==================================================
  // CERRAR MODALES
  // ==================================================


cerrarModales(): void {

  // El cambio inicial de contraseña es obligatorio
  if (this.modalActivo === 'cambioInicial') {
    return;
  }

  // Si el usuario está en el modal de éxito
  if (this.modalActivo === 'exito') {

    // Limpiar el token de la sesión
    sessionStorage.removeItem('token');

    // Limpiar los campos del login
    this.usuario = '';
    this.password = '';
    this.mensajeLogin = '';

    // Cerrar el modal
    this.modalActivo = 'none';
    document.body.style.overflow = '';

    // Detener el temporizador OTP
    this.limpiarTemporizador();

    // Regresar a la pantalla de inicio de sesión
    void this.router.navigate(['/login']);

    return;
  }

  // Cierre normal de los demás modales
  this.modalActivo = 'none';
  document.body.style.overflow = '';
  this.limpiarTemporizador();
}

  // ==================================================
  // MOSTRAR Y OCULTAR CONTRASEÑAS
  // ==================================================

  toggleMostrarPassword(
    tipo:
      | 'main'
      | 'nueva'
      | 'confirmar'
      | 'temporal'
      | 'nuevaInicial'
      | 'confirmarInicial'
  ): void {

    if (tipo === 'main') {
      this.mostrarPasswordMain = !this.mostrarPasswordMain;

    } else if (tipo === 'nueva') {
      this.mostrarNuevaPassword = !this.mostrarNuevaPassword;

    } else if (tipo === 'confirmar') {
      this.mostrarConfirmarPassword = !this.mostrarConfirmarPassword;

    } else if (tipo === 'temporal') {
      this.mostrarPasswordTemporal = !this.mostrarPasswordTemporal;

    } else if (tipo === 'nuevaInicial') {
      this.mostrarNuevaPasswordInicial = !this.mostrarNuevaPasswordInicial;

    } else if (tipo === 'confirmarInicial') {
      this.mostrarConfirmarPasswordInicial = !this.mostrarConfirmarPasswordInicial;
    }
  }

  // ==================================================
  // INICIAR SESIÓN CON EL BACKEND
  // ==================================================

  iniciarSesion(): void {

    const usuario = this.usuario.trim();
    const password = this.password;

    if (!usuario || !password.trim()) {
      this.mensajeLogin = 'Debes completar todos los campos.';
      this.colorMensajeLogin = '#EF4444';
      return;
    }

    if (this.cargandoLogin) {
      return;
    }

    this.cargandoLogin = true;
    this.mensajeLogin = '';

    this.authService.iniciarSesion({
      username: usuario,
      password: password
    }).subscribe({

      next: (respuesta) => {

  console.log('RESPUESTA DEL LOGIN:', respuesta);

  // Finalizar el estado de carga
  this.cargandoLogin = false;

  // Guardar el token recibido
  if (respuesta.token) {
    sessionStorage.setItem('token', respuesta.token);
  }

  // Comprobar si debe cambiar la contraseña
  if (respuesta.mustChangePassword === true) {

    this.passwordTemporal = password;
    this.nuevaPasswordInicial = '';
    this.confirmarPasswordInicial = '';
    this.mensajeErrorCambioInicial = '';

    // Abrir el modal obligatorio
this.abrirModal('cambioInicial');

// Forzar la actualización de la vista
this.cdr.detectChanges();

console.log('MODAL ACTIVO:', this.modalActivo);

  } else {

    this.mensajeLogin = 'Inicio de sesión correcto.';
    this.colorMensajeLogin = '#10989B';

    // Ir al Dashboard
    void this.router.navigate(['/dashboard']);
  }
},

      error: (error) => {

        console.log('ERROR DEL LOGIN:', error);

        this.cargandoLogin = false;

        if (error.status === 401) {

          this.mensajeLogin = 'Usuario o contraseña incorrectos.';

        } else if (error.status === 0) {

          this.mensajeLogin =
            'No se pudo conectar con el servidor. Verifica la conexión.';

        } else {

          this.mensajeLogin =
            'Ocurrió un error al iniciar sesión. Inténtalo nuevamente.';
        }

        this.colorMensajeLogin = '#EF4444';

        console.error('Error en el inicio de sesión:', error);
      }
    });
  }

  // ==================================================
  // VALIDAR MODAL DE RECUPERACIÓN
  // ==================================================

  get botonContinuarDisabled(): boolean {
    return !this.usuarioRecuperacion.trim() ||
      !this.correoCorporativo.trim();
  }

  limpiarPrimerModal(): void {
    this.usuarioRecuperacion = '';
    this.correoCorporativo = '';
    this.mensajeRecuperacion = '';
  }

  cambioRecuperacion(): void {
    this.mensajeRecuperacion = '';
  }
  
  // ==================================================
// SOLICITAR CÓDIGO DE RECUPERACIÓN AL BACKEND
// ==================================================

solicitarCodigoRecuperacion(): void {

  const username = this.usuarioRecuperacion.trim();
  const email = this.correoCorporativo.trim();

  if (!username || !email) {
    this.mensajeRecuperacion = 'Debes completar todos los campos.';
    return;
  }

  if (this.cargandoRecuperacion) {
    return;
  }

  this.cargandoRecuperacion = true;
  this.mensajeRecuperacion = '';

  this.authService.iniciarRecuperacion({
    username,
    email
  }).subscribe({

    next: (respuesta) => {

      console.log('RESPUESTA RECUPERACIÓN:', respuesta);

      this.cargandoRecuperacion = false;

      // Guardar los datos de recuperación
      // para utilizarlos al validar el OTP.
      this.usuarioRecuperacion = username;
      this.correoCorporativo = email;

      // Abrir automáticamente el modal OTP.
      this.abrirModal('otp');

      // Actualizar la vista.
      this.cdr.detectChanges();

    },

    error: (error) => {

      this.cargandoRecuperacion = false;

      console.error('ERROR AL SOLICITAR RECUPERACIÓN:', error);

      if (error.status === 0) {
        this.mensajeRecuperacion =
          'No se pudo conectar con el servidor.';

      } else if (error.status === 400 || error.status === 404) {
        this.mensajeRecuperacion =
          'No fue posible iniciar la recuperación. Verifica tus datos.';

      } else {
        this.mensajeRecuperacion =
          'Ocurrió un error al solicitar el código. Inténtalo nuevamente.';
      }

      this.cdr.detectChanges();
    }

  });
}

  // ==================================================
  // TEMPORIZADOR OTP
  // ==================================================

  iniciarTemporizador(): void {

    this.limpiarTemporizador();
    this.tiempoRestante = 300;

    this.intervaloTemporizador = setInterval(() => {

      if (this.tiempoRestante > 0) {
        this.tiempoRestante--;
      }

      if (this.tiempoRestante === 0) {
        this.limpiarTemporizador();
      }

    }, 1000);
  }

  limpiarTemporizador(): void {

    if (this.intervaloTemporizador !== null) {
      clearInterval(this.intervaloTemporizador);
      this.intervaloTemporizador = null;
    }
  }

  get tiempoFormateado(): string {

    const minutos = Math.floor(this.tiempoRestante / 60);
    const segundos = this.tiempoRestante % 60;

    return `${minutos}:${segundos.toString().padStart(2, '0')}`;
  }

  // ==================================================
  // ESCRIBIR OTP
  // ==================================================

  escribirOtp(event: Event, posicion: number): void {

    const input = event.target as HTMLInputElement;
    const valor = input.value.replace(/\D/g, '').slice(0, 1);

    input.value = valor;
    this.asignarOtp(posicion, valor);

    this.errorOtp = false;
    this.otpCorrecto = false;
    this.mensajeReenvio = false;

    if (valor && posicion < 6) {
      (input.nextElementSibling as HTMLInputElement | null)?.focus();
    }
  }

  borrarOtp(event: KeyboardEvent, posicion: number): void {

    const input = event.target as HTMLInputElement;

    if (event.key === 'Backspace' || event.key === 'Delete') {

      event.preventDefault();

      if (input.value) {

        input.value = '';
        this.asignarOtp(posicion, '');

      } else if (posicion > 1) {

        const anterior =
          input.previousElementSibling as HTMLInputElement | null;

        if (anterior) {
          anterior.value = '';
          this.asignarOtp(posicion - 1, '');
          anterior.focus();
        }
      }

      return;
    }

    if (
      event.key.length === 1 &&
      !/^\d$/.test(event.key) &&
      !event.ctrlKey &&
      !event.metaKey
    ) {
      event.preventDefault();
    }
  }

  private asignarOtp(posicion: number, valor: string): void {

    switch (posicion) {
      case 1: this.otp1 = valor; break;
      case 2: this.otp2 = valor; break;
      case 3: this.otp3 = valor; break;
      case 4: this.otp4 = valor; break;
      case 5: this.otp5 = valor; break;
      case 6: this.otp6 = valor; break;
    }
  }

  get botonValidarOtpDisabled(): boolean {

    return !(
      this.otp1 &&
      this.otp2 &&
      this.otp3 &&
      this.otp4 &&
      this.otp5 &&
      this.otp6
    );
  }

  // ==================================================
  // VALIDAR OTP
  // ==================================================
    // ==================================================
// LIMPIAR LOS CAMPOS DEL OTP
// ==================================================

limpiarSegundoModal(): void {
  this.otp1 = '';
  this.otp2 = '';
  this.otp3 = '';
  this.otp4 = '';
  this.otp5 = '';
  this.otp6 = '';

  this.errorOtp = false;
  this.otpCorrecto = false;
  this.mensajeReenvio = false;
  this.mensajeOtp = '';
}

// ==================================================
// REENVIAR CÓDIGO DE RECUPERACIÓN
// ==================================================

reenviarCodigo(): void {

  if (this.cargandoRecuperacion) {
    return;
  }

  this.cargandoRecuperacion = true;
  this.mensajeOtp = '';
  this.errorOtp = false;

  this.authService.iniciarRecuperacion({
    username: this.usuarioRecuperacion.trim(),
    email: this.correoCorporativo.trim()
  }).subscribe({

    next: (respuesta) => {

      this.cargandoRecuperacion = false;

      // Limpiar los seis campos del código anterior
      this.limpiarSegundoModal();

      // Reiniciar los cinco minutos
      this.iniciarTemporizador();

      this.mensajeReenvio = true;

      console.log('CÓDIGO REENVIADO:', respuesta.message);
    },

    error: (error) => {

      this.cargandoRecuperacion = false;
      this.errorOtp = true;

      this.mensajeOtp =
        error.error?.message ||
        'No fue posible reenviar el código. Inténtalo nuevamente.';

      console.error('ERROR AL REENVIAR OTP:', error);
    }
  });
}
  
validarOtp(): void {

  const codigo = this.otp1 + this.otp2 + this.otp3 +
    this.otp4 + this.otp5 + this.otp6;

  if (codigo.length !== 6 || this.cargandoOtp) {
    return;
  }

  if (this.tiempoRestante <= 0) {
    this.errorOtp = true;
    this.mensajeOtp = 'El código ha expirado. Solicita uno nuevo.';
    return;
  }

  this.cargandoOtp = true;
  this.errorOtp = false;
  this.mensajeOtp = '';

  this.authService.verificarCodigo({
    username: this.usuarioRecuperacion.trim(),
    email: this.correoCorporativo.trim(),
    pin: codigo
  }).subscribe({

    next: (respuesta) => {

      this.cargandoOtp = false;

      if (!respuesta.resetToken) {
        this.errorOtp = true;
        this.mensajeOtp = 'No se recibió el token de recuperación.';
        return;
      }

      // Guardar el token temporal del backend
      this.resetTokenRecuperacion = respuesta.resetToken;

      this.otpCorrecto = true;
      this.errorOtp = false;

      this.limpiarTemporizador();

      setTimeout(() => {
        this.abrirModal('cambio');
      }, 500);
    },

    error: (error) => {

      this.cargandoOtp = false;
      this.errorOtp = true;
      this.otpCorrecto = false;

      console.error('ERROR VALIDANDO OTP:', error);

      if (error.status === 0) {
        this.mensajeOtp = 'No se pudo conectar con el servidor.';
      } else {
        this.mensajeOtp =
          error.error?.message ||
          'El código ingresado es incorrecto o ha expirado.';
      }
    }

  });
}


  // ==================================================
  // VALIDAR NUEVA CONTRASEÑA (RECUPERACIÓN)
  // ==================================================

  evaluarNuevaPassword(): void {

    const valor = this.nuevaPassword;

    this.mensajePasswordError = false;

    this.reqMin12 = valor.length >= 12;
    this.reqMayuscula = /[A-Z]/.test(valor);
    this.reqMinuscula = /[a-z]/.test(valor);
    this.reqNumero = /[0-9]/.test(valor);
    this.reqEspecial = /[^A-Za-z0-9]/.test(valor);

    const cumplidos = [
      this.reqMin12,
      this.reqMayuscula,
      this.reqMinuscula,
      this.reqNumero,
      this.reqEspecial
    ].filter(Boolean).length;

    this.coloresSeguridad = ['#E2E8F0', '#E2E8F0', '#E2E8F0'];

    if (valor.length > 0) {

      if (cumplidos <= 2) {
        this.coloresSeguridad[0] = '#EE1F1F';

      } else if (cumplidos <= 4) {
        this.coloresSeguridad[0] = '#F59E0B';
        this.coloresSeguridad[1] = '#F59E0B';

      } else {
        this.coloresSeguridad = ['#22C55E', '#22C55E', '#22C55E'];
      }
    }
  }

  get requisitosCumplidos(): boolean {

    return this.reqMin12 &&
      this.reqMayuscula &&
      this.reqMinuscula &&
      this.reqNumero &&
      this.reqEspecial;
  }

  cambioConfirmarPassword(): void {
    this.mensajePasswordError = false;
  }

  comprobarPasswords(): void {

    this.mensajePasswordError =
      this.confirmarPassword !== '' &&
      this.nuevaPassword !== this.confirmarPassword;
  }

  
actualizarPassword(): void {

  if (this.cargandoCambioRecuperacion) {
    return;
  }

  if (!this.requisitosCumplidos) {
    return;
  }

  if (
    !this.confirmarPassword ||
    this.nuevaPassword !== this.confirmarPassword
  ) {
    this.mensajePasswordError = true;
    return;
  }

  if (!this.resetTokenRecuperacion) {
    this.mensajePasswordError = true;
    this.mensajeBackendPassword =
      'La sesión de recuperación expiró. Solicita un nuevo código.';
    return;
  }

  this.cargandoCambioRecuperacion = true;
  this.mensajePasswordError = false;
  this.mensajeBackendPassword = '';

  this.authService.restablecerPassword({
    resetToken: this.resetTokenRecuperacion,
    newPassword: this.nuevaPassword
  }).subscribe({

    next: (respuesta) => {

      this.cargandoCambioRecuperacion = false;

      console.log('CONTRASEÑA ACTUALIZADA:', respuesta.message);

      this.resetTokenRecuperacion = null;

      this.nuevaPassword = '';
      this.confirmarPassword = '';

      this.abrirModal('exito');
    },

    error: (error) => {

      this.cargandoCambioRecuperacion = false;
      this.mensajePasswordError = true;

      console.error('ERROR AL ACTUALIZAR CONTRASEÑA:', error);

      this.mensajeBackendPassword =
        error.error?.message ||
        'No fue posible actualizar la contraseña. Inténtalo nuevamente.';
    }
  });
}


  limpiarTercerModal(): void {

    this.nuevaPassword = '';
    this.confirmarPassword = '';
    this.mensajePasswordError = false;

    this.reqMin12 = false;
    this.reqMayuscula = false;
    this.reqMinuscula = false;
    this.reqNumero = false;
    this.reqEspecial = false;

    this.coloresSeguridad = ['#E2E8F0', '#E2E8F0', '#E2E8F0'];
  }

  // ==================================================
  // MODAL INICIAL: COMPROBAR CONTRASEÑAS
  // ==================================================

  comprobarPasswordsIniciales(): void {

    this.mensajePasswordInicialError =
      this.confirmarPasswordInicial !== '' &&
      this.nuevaPasswordInicial !== this.confirmarPasswordInicial;
  }

  // ==================================================
  // MODAL INICIAL: VALIDAR CAMPOS
  // ==================================================

  get botonActualizarInicialDisabled(): boolean {

    return (
      !this.passwordTemporal.trim() ||
      !this.nuevaPasswordInicial ||
      !this.confirmarPasswordInicial ||
      !this.requisitosInicialesCumplidos ||
      this.nuevaPasswordInicial !== this.confirmarPasswordInicial
    );
  }

  // ==================================================
  // MODAL INICIAL: VALIDAR NUEVA CONTRASEÑA
  // ==================================================

  evaluarNuevaPasswordInicial(): void {

    const valor = this.nuevaPasswordInicial;

    this.mensajePasswordInicialError = false;

    this.reqMin12Inicial = valor.length >= 12;
    this.reqMayusculaInicial = /[A-Z]/.test(valor);
    this.reqMinusculaInicial = /[a-z]/.test(valor);
    this.reqNumeroInicial = /[0-9]/.test(valor);
    this.reqEspecialInicial = /[^A-Za-z0-9]/.test(valor);

    const cumplidos = [
      this.reqMin12Inicial,
      this.reqMayusculaInicial,
      this.reqMinusculaInicial,
      this.reqNumeroInicial,
      this.reqEspecialInicial
    ].filter(Boolean).length;

    this.coloresSeguridadInicial = [
      '#E2E8F0',
      '#E2E8F0',
      '#E2E8F0'
    ];

    if (valor.length > 0) {

      if (cumplidos <= 2) {

        this.coloresSeguridadInicial[0] = '#EE1F1F';

      } else if (cumplidos <= 4) {

        this.coloresSeguridadInicial[0] = '#F59E0B';
        this.coloresSeguridadInicial[1] = '#F59E0B';

      } else {

        this.coloresSeguridadInicial = [
          '#22C55E',
          '#22C55E',
          '#22C55E'
        ];
      }
    }
  }

  get requisitosInicialesCumplidos(): boolean {

    return this.reqMin12Inicial &&
      this.reqMayusculaInicial &&
      this.reqMinusculaInicial &&
      this.reqNumeroInicial &&
      this.reqEspecialInicial;
  }

  // ==================================================
  // MODAL INICIAL: ACTUALIZAR CONTRASEÑA EN EL BACKEND
  // ==================================================

  actualizarPasswordInicial(): void {

    if (this.cargandoCambioInicial) {
      return;
    }

    if (this.botonActualizarInicialDisabled) {
      return;
    }

    this.cargandoCambioInicial = true;
    this.mensajeErrorCambioInicial = '';

    this.authService.cambiarPassword({
      oldPassword: this.passwordTemporal,
      newPassword: this.nuevaPasswordInicial
    }).subscribe({

            next: () => {

        this.cargandoCambioInicial = false;

        // Limpiar los campos de contraseña
        this.passwordTemporal = '';
        this.nuevaPasswordInicial = '';
        this.confirmarPasswordInicial = '';

        // Mostrar modal de éxito
        this.abrirModal('exito');

        // Actualizar la vista de Angular
        this.cdr.detectChanges();

      console.log('MODAL DESPUÉS DEL CAMBIO:', this.modalActivo);
      },

      error: (error) => {

        this.cargandoCambioInicial = false;

        console.error(
          'Error al cambiar la contraseña:',
          error
        );

        if (error.status === 401) {

          this.mensajeErrorCambioInicial =
            'La contraseña temporal no es correcta.';

        } else if (error.status === 403) {

          this.mensajeErrorCambioInicial =
            'No fue posible autorizar el cambio de contraseña.';

        } else {

          this.mensajeErrorCambioInicial =
            'No se pudo actualizar la contraseña. Inténtalo nuevamente.';
        }
      }
    });
  }

}