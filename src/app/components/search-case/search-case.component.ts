import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-search-case',
  standalone: true,

  imports: [
    CommonModule,
    FormsModule
  ],

  templateUrl: './search-case.component.html',
  styleUrl: './search-case.component.css'
})


export class SearchCaseComponent {


  // ==================================================
  // RECIBIR EL ESTADO DEL MODAL DESDE DASHBOARD
  // ==================================================

  @Input()
  isOpen = false;


  // ==================================================
  // AVISAR AL DASHBOARD QUE SE CERRÓ EL MODAL
  // ==================================================

  @Output()
  closed = new EventEmitter<void>();


  // ==================================================
  // CONTROL DE LA BÚSQUEDA
  // ==================================================

  isSearching = false;

  // ==================================================
  // TEXTO ESCRITO EN LA BÚSQUEDA
  // ==================================================

  searchText = '';

  // ==================================================
  // INICIAR BÚSQUEDA
  // ==================================================

  onSearch(): void {

    if (this.searchText.trim().length >= 3) {

      this.isSearching = true;

    } else {

      this.isSearching = false;

    }

  }

  // ==================================================
  // CERRAR MODAL
  // ==================================================

  close(): void {

    this.isSearching = false;

    this.searchText = '';

    this.closed.emit();

  }
  
// ==================================================
// LIMPIAR BÚSQUEDA
// ==================================================

clearSearch(): void {

  this.searchText = '';

  this.isSearching = false;

}

}
