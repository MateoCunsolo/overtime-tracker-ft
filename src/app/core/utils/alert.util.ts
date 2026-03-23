import Swal from 'sweetalert2';

export const AppSwal = Swal.mixin({
  buttonsStyling: false,
  customClass: {
    popup: 'swal-popup',
    title: 'swal-title',
    htmlContainer: 'swal-content',
    confirmButton: 'swal-btn swal-btn-confirm',
    denyButton: 'swal-btn swal-btn-deny',
    cancelButton: 'swal-btn swal-btn-cancel'
  }
});

export function showProcessingAlert(text: string, title = 'Procesando'): void {
  void AppSwal.fire({
    title,
    text,
    allowOutsideClick: false,
    allowEscapeKey: false,
    didOpen: () => {
      AppSwal.showLoading();
    }
  });
}

export function closeProcessingAlert(): void {
  AppSwal.close();
}
