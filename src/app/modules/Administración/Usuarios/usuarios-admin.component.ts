import { ChangeDetectorRef, Component, HostListener, OnDestroy, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { forkJoin } from 'rxjs';

import {
  EstadoUsuarioBackend,
  RolBackend,
  UsuarioBackend,
  UsuariosAdminService
} from '../../../service/usuarios-admin.service';

// ==================================================
// MODELOS DE LA PANTALLA
// ==================================================

export interface UsuarioAdmin {
  id: number;
  nombre: string;
  correo: string;
  usuario: string;
  rol: string;                    // código del rol: ADMIN, AGENT...
  estado: EstadoUsuarioBackend;   // ACTIVE, SUSPENDED o INACTIVE
}

interface FormularioUsuario {
  nombre: string;
  correo: string;
  usuario: string;
  rolId: number | null;
}

// Ventana que muestra una contraseña temporal recién generada
interface ClaveTemporal {
  titulo: string;
  usuario: string;
  clave: string;
}

// Nombres en español de los roles que manda el backend
const NOMBRES_ROLES: Record<string, string> = {
  ADMIN: 'Administrador',
  SUPERVISOR: 'Supervisor',
  AGENT: 'Agente',
  AUDIT: 'Auditor',
  ML_ENGINE: 'Motor IA'
};

// Este rol es interno del sistema: no se ofrece al crear o editar usuarios
const ROLES_OCULTOS = ['ML_ENGINE'];

// ==================================================
// GESTIÓN DE USUARIOS
// Conectada al backend: /admin/users
// ==================================================

@Component({
  selector: 'app-usuarios-admin',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './usuarios-admin.component.html',
  styleUrl: './usuarios-admin.component.css'
})
export class UsuariosAdminComponent implements OnInit, OnDestroy {

  private servicio = inject(UsuariosAdminService);

  // Esta versión de Angular no redibuja sola cuando llega una respuesta del backend:
  // hay que avisarle con refrescarVista()
  private cdr = inject(ChangeDetectorRef);

  // Datos que vienen del backend
  usuarios: UsuarioAdmin[] = [];
  private todosLosRoles: RolBackend[] = [];

  // Estados de carga
  cargando = true;
  errorCarga = '';
  guardando = false;                    // mientras se envía un formulario
  procesandoId: number | null = null;   // usuario al que se le está cambiando algo

  // Ventana para crear / editar
  modalFormularioAbierto = false;
  usuarioEnEdicion: UsuarioAdmin | null = null;
  formulario: FormularioUsuario = this.formularioVacio();
  errorFormulario = '';

  // Menú de tres puntos (⋮) de cada fila
  menuAbiertoId: number | null = null;

  alternarMenu(usuario: UsuarioAdmin, evento: MouseEvent): void {
    evento.stopPropagation();
    this.menuAbiertoId = this.menuAbiertoId === usuario.id ? null : usuario.id;
  }

  cerrarMenu(): void {
    this.menuAbiertoId = null;
  }

  // Se cierra al hacer clic en cualquier otra parte o con Escape
  @HostListener('document:click')
  @HostListener('document:keydown.escape')
  alClicFuera(): void {
    this.menuAbiertoId = null;
  }

  // Ventana para confirmar desactivación
  usuarioAEliminar: UsuarioAdmin | null = null;

  // Ventana con la contraseña temporal
  claveTemporal: ClaveTemporal | null = null;
  claveCopiada = false;

  // Mensaje corto que aparece abajo a la derecha
  mensaje = '';
  private temporizadorMensaje: ReturnType<typeof setTimeout> | null = null;

  // ==================================================
  // CARGAR DATOS
  // ==================================================

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.cargando = true;
    this.errorCarga = '';

    forkJoin({
      usuarios: this.servicio.listar(true),
      roles: this.servicio.listarRoles()
    }).subscribe({
      next: ({ usuarios, roles }) => {
        this.todosLosRoles = roles;
        this.usuarios = usuarios.map(u => this.convertir(u));
        this.cargando = false;
        this.refrescarVista();
      },
      error: (error: HttpErrorResponse) => {
        this.errorCarga = this.textoError(error, 'No se pudieron cargar los usuarios.');
        this.cargando = false;
        this.refrescarVista();
      }
    });
  }

  // Recarga solo la lista (después de crear, editar, etc.)
  private recargarUsuarios(): void {
    this.servicio.listar(true).subscribe({
      next: usuarios => {
        this.usuarios = usuarios.map(u => this.convertir(u));
        this.refrescarVista();
      },
      error: () => this.mostrarMensaje('No se pudo actualizar la lista. Recarga la página.')
    });
  }

  // Pasa un usuario del formato del backend al de la pantalla
  private convertir(u: UsuarioBackend): UsuarioAdmin {
    return {
      id: u.id,
      nombre: u.fullName ?? '',
      correo: u.email ?? '',
      usuario: u.username ?? '',
      rol: u.roleName ?? '',
      estado: u.status
    };
  }

  // ==================================================
  // AYUDAS PARA LA VISTA
  // ==================================================

  // Roles que se muestran en el selector del formulario
  get roles(): RolBackend[] {
    return this.todosLosRoles.filter(r => !ROLES_OCULTOS.includes(r.name));
  }

  nombreRol(codigo: string): string {
    return NOMBRES_ROLES[codigo] ?? codigo;
  }

  textoEstado(estado: EstadoUsuarioBackend): string {
    if (estado === 'ACTIVE') return 'Activo';
    if (estado === 'SUSPENDED') return 'Suspendido';
    return 'Inactivo';
  }

  inicial(nombre: string): string {
    return nombre.trim().charAt(0).toUpperCase() || '?';
  }

  // ==================================================
  // ACTIVAR / SUSPENDER
  // ==================================================

  // Ventana para confirmar la activación (al prender el interruptor)
  usuarioAActivar: UsuarioAdmin | null = null;

  pedirActivar(usuario: UsuarioAdmin): void {
    this.usuarioAActivar = usuario;
  }

  cancelarActivar(): void {
    if (this.procesandoId !== null) return;
    this.usuarioAActivar = null;
  }

  confirmarActivar(): void {
    const usuario = this.usuarioAActivar;
    if (!usuario) return;
    this.alternarEstado(usuario);
  }

  alternarEstado(usuario: UsuarioAdmin): void {
    if (this.procesandoId !== null) return;
    this.procesandoId = usuario.id;

    this.servicio.alternarEstado(usuario.id).subscribe({
      next: () => {
        // El backend pasa de Activo a Suspendido, o de cualquier otro estado a Activo
        usuario.estado = usuario.estado === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
        this.procesandoId = null;
        this.usuarioAActivar = null;
        this.mostrarMensaje(`${usuario.nombre} quedó ${this.textoEstado(usuario.estado).toLowerCase()}.`);
      },
      error: (error: HttpErrorResponse) => {
        this.procesandoId = null;
        this.usuarioAActivar = null;
        this.mostrarMensaje(this.textoError(error, 'No se pudo cambiar el estado.'));
      }
    });
  }

  // ==================================================
  // CREAR Y EDITAR
  // ==================================================

  abrirCrear(): void {
    this.usuarioEnEdicion = null;
    this.formulario = this.formularioVacio();
    this.errorFormulario = '';
    this.modalFormularioAbierto = true;
  }

  abrirEditar(usuario: UsuarioAdmin): void {
    this.usuarioEnEdicion = usuario;
    this.formulario = {
      nombre: usuario.nombre,
      correo: usuario.correo,
      usuario: usuario.usuario,
      rolId: this.todosLosRoles.find(r => r.name === usuario.rol)?.id ?? null
    };
    this.errorFormulario = '';
    this.modalFormularioAbierto = true;
  }

  cerrarFormulario(): void {
    if (this.guardando) return;
    this.modalFormularioAbierto = false;
  }

  guardarUsuario(): void {

    const nombre = this.formulario.nombre.trim();
    const correo = this.formulario.correo.trim();
    const usuario = this.formulario.usuario.trim();
    const rolId = this.formulario.rolId;

    // Revisiones antes de enviar (son las mismas reglas que tiene el backend)
    const error = this.validarFormulario(nombre, correo, usuario, rolId);
    if (error) {
      this.errorFormulario = error;
      return;
    }

    this.errorFormulario = '';
    this.guardando = true;

    if (this.usuarioEnEdicion) {
      const editado = this.usuarioEnEdicion;
      this.servicio.editar(editado.id, {
        email: correo,
        fullName: editado.nombre,   // el nombre no se puede cambiar
        roleId: rolId!,
        status: editado.estado
      }).subscribe({
        next: () => {
          this.guardando = false;
          this.modalFormularioAbierto = false;
          this.mostrarMensaje('Usuario actualizado.');
          this.recargarUsuarios();
        },
        error: (err: HttpErrorResponse) => {
          this.guardando = false;
          this.errorFormulario = this.textoError(err, 'No se pudo actualizar el usuario.');
          this.refrescarVista();
        }
      });
      return;
    }

    this.servicio.crear({ username: usuario, email: correo, fullName: nombre, roleId: rolId! }).subscribe({
      next: creado => {
        this.guardando = false;
        this.modalFormularioAbierto = false;
        this.recargarUsuarios();

        if (creado.temporaryPassword) {
          this.mostrarClave('Usuario creado', creado.username, creado.temporaryPassword);
        } else {
          this.mostrarMensaje('Usuario creado.');
        }
      },
      error: (err: HttpErrorResponse) => {
        this.guardando = false;
        this.errorFormulario = this.textoError(err, 'No se pudo crear el usuario.');
        this.refrescarVista();
      }
    });
  }

  private validarFormulario(nombre: string, correo: string, usuario: string, rolId: number | null): string {

    if (!nombre || !correo || !usuario || rolId === null) {
      return 'Completa todos los campos.';
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
      return 'El correo no tiene un formato válido.';
    }

    const correoRepetido = this.usuarios.some(u =>
      u.correo.toLowerCase() === correo.toLowerCase() && u !== this.usuarioEnEdicion
    );
    if (correoRepetido) {
      return 'Ya existe un usuario con ese correo.';
    }

    // Al editar, el nombre y el usuario no cambian, así que no se revisan
    if (this.usuarioEnEdicion) {
      return '';
    }

    if (nombre.length < 8 || nombre.length > 50) {
      return 'El nombre completo debe tener entre 8 y 50 caracteres.';
    }

    if (!/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/.test(nombre)) {
      return 'El nombre no puede tener números ni caracteres especiales.';
    }

    if (usuario.length < 6 || usuario.length > 20) {
      return 'El nombre de usuario debe tener entre 6 y 20 caracteres.';
    }

    const usuarioRepetido = this.usuarios.some(u => u.usuario.toLowerCase() === usuario.toLowerCase());
    if (usuarioRepetido) {
      return 'Ya existe un usuario con ese nombre de usuario.';
    }

    return '';
  }

  // ==================================================
  // RESETEAR CONTRASEÑA
  // ==================================================

  // Ventana para confirmar "Restablecer acceso"
  usuarioARestablecer: UsuarioAdmin | null = null;

  pedirRestablecer(usuario: UsuarioAdmin): void {
    this.usuarioARestablecer = usuario;
  }

  cancelarRestablecer(): void {
    if (this.procesandoId !== null) return;
    this.usuarioARestablecer = null;
  }

  confirmarRestablecer(): void {
    const usuario = this.usuarioARestablecer;
    if (!usuario) return;
    this.resetearPassword(usuario);
  }

  resetearPassword(usuario: UsuarioAdmin): void {
    if (this.procesandoId !== null) return;
    this.procesandoId = usuario.id;

    this.servicio.resetearPassword(usuario.id).subscribe({
      next: respuesta => {
        this.procesandoId = null;
        this.usuarioARestablecer = null;
        this.mostrarClave('Contraseña restablecida', respuesta.username, respuesta.temporaryPassword);
      },
      error: (error: HttpErrorResponse) => {
        this.procesandoId = null;
        this.usuarioARestablecer = null;
        this.mostrarMensaje(this.textoError(error, 'No se pudo restablecer la contraseña.'));
      }
    });
  }

  private mostrarClave(titulo: string, usuario: string, clave: string): void {
    this.claveCopiada = false;
    this.claveTemporal = { titulo, usuario, clave };
    this.refrescarVista();
  }

  copiarClave(): void {
    if (!this.claveTemporal) return;
    navigator.clipboard?.writeText(this.claveTemporal.clave)
      .then(() => {
        this.claveCopiada = true;
        this.refrescarVista();
      })
      .catch(() => this.mostrarMensaje('No se pudo copiar. Selecciónala y cópiala a mano.'));
  }

  cerrarClave(): void {
    this.claveTemporal = null;
  }

  // ==================================================
  // DESACTIVAR (el backend no borra usuarios)
  // ==================================================

  pedirEliminar(usuario: UsuarioAdmin): void {
    this.usuarioAEliminar = usuario;
  }

  cancelarEliminar(): void {
    if (this.guardando) return;
    this.usuarioAEliminar = null;
  }

  confirmarEliminar(): void {
    const usuario = this.usuarioAEliminar;
    if (!usuario) return;

    this.guardando = true;
    this.servicio.desactivar(usuario.id).subscribe({
      next: () => {
        this.guardando = false;
        this.usuarioAEliminar = null;
        usuario.estado = 'INACTIVE';
        this.mostrarMensaje(`${usuario.nombre} fue desactivado.`);
      },
      error: (error: HttpErrorResponse) => {
        this.guardando = false;
        this.usuarioAEliminar = null;
        this.mostrarMensaje(this.textoError(error, 'No se pudo desactivar el usuario.'));
      }
    });
  }

  // ==================================================
  // UTILIDADES
  // ==================================================

  private formularioVacio(): FormularioUsuario {
    const agente = this.todosLosRoles.find(r => r.name === 'AGENT');
    return { nombre: '', correo: '', usuario: '', rolId: agente?.id ?? null };
  }

  // Saca un mensaje entendible de un error del backend
  private textoError(error: HttpErrorResponse, porDefecto: string): string {
    if (error.status === 0) {
      return 'No hay conexión con el servidor.';
    }
    if (error.status === 401) {
      return 'Tu sesión terminó. Vuelve a iniciar sesión.';
    }
    if (error.status === 403) {
      return 'No tienes permiso para hacer esto (se necesita rol Administrador).';
    }

    const cuerpo = error.error;

    // Errores de validación: { details: { campo: 'mensaje' } }
    if (cuerpo?.details && typeof cuerpo.details === 'object') {
      const mensajes = Object.values(cuerpo.details).filter(Boolean);
      if (mensajes.length) {
        return mensajes.join(' ');
      }
    }

    // El backend responde "Error interno del servidor" en errores no controlados: no ayuda al usuario
    if (cuerpo?.message && error.status < 500) {
      return cuerpo.message;
    }

    return porDefecto;
  }

  private destruido = false;

  // Redibuja en el momento (sin esperar a que se mueva el mouse)
  private refrescarVista(): void {
    if (this.destruido) return;
    this.cdr.markForCheck();
    this.cdr.detectChanges();
  }

  private mostrarMensaje(texto: string): void {
    this.mensaje = texto;
    if (this.temporizadorMensaje) {
      clearTimeout(this.temporizadorMensaje);
    }
    this.temporizadorMensaje = setTimeout(() => {
      this.mensaje = '';
      this.refrescarVista();
    }, 3500);
    this.refrescarVista();
  }

  ngOnDestroy(): void {
    this.destruido = true;
    if (this.temporizadorMensaje) {
      clearTimeout(this.temporizadorMensaje);
    }
  }

}
