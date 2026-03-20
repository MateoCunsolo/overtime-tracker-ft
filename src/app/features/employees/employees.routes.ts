import { Routes } from '@angular/router';

export const EMPLOYEES_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/employees-page/employees-page/employees-page.component').then(
        (m) => m.EmployeesPageComponent
      )
  }
];
