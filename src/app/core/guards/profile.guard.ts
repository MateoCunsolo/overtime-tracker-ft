import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { AuthService } from '../services/auth.service';
import { ProfileService } from '../services/profile.service';

export const profileGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const profileService = inject(ProfileService);
  const router = inject(Router);

  if (!auth.isLoggedIn() || !profileService.getProfile()) {
    const returnUrl = router.url.split('?')[0] || '/dashboard';
    return router.createUrlTree(['/auth'], {
      queryParams: { returnUrl }
    });
  }

  return true;
};
