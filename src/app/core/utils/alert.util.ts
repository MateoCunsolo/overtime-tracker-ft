import Swal from 'sweetalert2';

export const AppSwal = Swal.mixin({
  buttonsStyling: false,
  customClass: {
    popup: 'swal-popup',
    title: 'swal-title',
    htmlContainer: 'swal-content',
    confirmButton: 'swal-btn swal-btn-confirm',
    cancelButton: 'swal-btn swal-btn-cancel'
  }
});
