import { Routes } from '@angular/router';

export const OVERTIME_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/overtime-page/overtime-page/overtime-page.component').then(
        (m) => m.OvertimePageComponent
      )
  }
];
