import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { inject } from '@angular/core';
import { AuthService } from '../../core/services/auth.service';



@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent implements OnInit, OnDestroy {

  // Servicio que conecta el login con el backend
private authService = inject(AuthService);

// Indica si el login está procesándose
cargandoLogin = false;

  usuario = '';
  password = '';
  mostrarPasswordMain = false;
  mensajeLogin = '';
  colorMensajeLogin = '#EF4444';

  modalActivo: 'none' | 'recuperar' | 'otp' | 'cambio' | 'exito' = 'none';

  usuarioRecuperacion = '';
  correoCorporativo = '';
  mensajeRecuperacion = '';

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

  ngOnInit(): void {}

  ngOnDestroy(): void {
    this.limpiarTemporizador();
    document.body.style.overflow = '';
  }

  abrirModal(modal: 'recuperar' | 'otp' | 'cambio' | 'exito'): void {
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

  cerrarModales(): void {
    this.modalActivo = 'none';
    document.body.style.overflow = '';
    this.limpiarTemporizador();
  }

  onBackdropClick(event: MouseEvent, _targetModal: string): void {
    if ((event.target as HTMLElement).classList.contains('modal')) {
      this.cerrarModales();
    }
  }

  toggleMostrarPassword(tipo: 'main' | 'nueva' | 'confirmar'): void {
    if (tipo === 'main') {
      this.mostrarPasswordMain = !this.mostrarPasswordMain;
    } else if (tipo === 'nueva') {
      this.mostrarNuevaPassword = !this.mostrarNuevaPassword;
    } else {
      this.mostrarConfirmarPassword = !this.mostrarConfirmarPassword;
    }
  }

  
  iniciarSesion(): void {
    // 1. Obtener los datos del formulario
    const usuario = this.usuario.trim();
    const password = this.password;

    // 2. Validar que los campos estén completos
    if (!usuario || !password.trim()) {
      this.mensajeLogin = 'Debes completar todos los campos.';
      this.colorMensajeLogin = '#EF4444';
      return;
    }

    // 3. Evitar enviar varias peticiones al mismo tiempo
    if (this.cargandoLogin) {
      return;
    }

    this.cargandoLogin = true;
    this.mensajeLogin = '';

    // 4. Enviar usuario y contraseña al backend
    this.authService.iniciarSesion({
      username: usuario,
      password: password
    }).subscribe({
      // 5. Si el backend acepta el inicio de sesión
      next: (respuesta) => {
        this.cargandoLogin = false;

        // Guardar el token para utilizarlo en futuras peticiones
        if (respuesta.token) {
          sessionStorage.setItem('token', respuesta.token);
        }

        if (respuesta.mustChangePassword) {
          this.mensajeLogin =
            'Inicio de sesión correcto. Debes cambiar tu contraseña.';
        } else {
          this.mensajeLogin = 'Inicio de sesión correcto.';
        }

        this.colorMensajeLogin = '#10989B';
      },

      // 6. Si ocurre un error
      error: (error) => {
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

  get botonContinuarDisabled(): boolean {
    return !this.usuarioRecuperacion.trim() || !this.correoCorporativo.trim();
  }

  limpiarPrimerModal(): void {
    this.usuarioRecuperacion = '';
    this.correoCorporativo = '';
    this.mensajeRecuperacion = '';
  }

  cambioRecuperacion(): void {
    this.mensajeRecuperacion = '';
  }

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
        const anterior = input.previousElementSibling as HTMLInputElement | null;

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

  validarOtp(): void {
    const codigo = this.otp1 + this.otp2 + this.otp3 +
      this.otp4 + this.otp5 + this.otp6;

    if (codigo === '123456') {
      this.errorOtp = false;
      this.otpCorrecto = true;
      this.limpiarTemporizador();

      setTimeout(() => this.abrirModal('cambio'), 500);
    } else {
      this.errorOtp = true;
      this.otpCorrecto = false;
    }
  }

  reenviarCodigo(): void {
    this.limpiarOtp();
    this.errorOtp = false;
    this.otpCorrecto = false;
    this.mensajeReenvio = true;
    this.iniciarTemporizador();
  }

  limpiarSegundoModal(): void {
    this.limpiarOtp();
    this.errorOtp = false;
    this.otpCorrecto = false;
    this.mensajeReenvio = false;
    this.tiempoRestante = 300;
    this.limpiarTemporizador();
  }

  private limpiarOtp(): void {
    this.otp1 = '';
    this.otp2 = '';
    this.otp3 = '';
    this.otp4 = '';
    this.otp5 = '';
    this.otp6 = '';
  }

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
    if (!this.requisitosCumplidos) {
      return;
    }

    if (!this.confirmarPassword || this.nuevaPassword !== this.confirmarPassword) {
      this.mensajePasswordError = true;
      return;
    }

    this.mensajePasswordError = false;
    this.abrirModal('exito');
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
}