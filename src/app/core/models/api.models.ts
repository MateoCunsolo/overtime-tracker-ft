import { UserRole, WorkerCategory, WorkShift } from './overtime.models';

export type TokenResponse = {
  accessToken: string;
  tokenType: string;
  expiresIn: string;
};

export type AuthMeResponse = {
  email: string;
  role: UserRole;
  profile: {
    nombre: string;
    apellido: string;
    categoria: WorkerCategory;
    antiguedadAnios: number;
    workShift: WorkShift;
  } | null;
  settings: { cutoffDay: number } | null;
};

export type LoginRequest = {
  email: string;
  password: string;
};

export type RegisterRequest = LoginRequest & {
  nombre: string;
  apellido: string;
  categoria: WorkerCategory;
  antiguedadAnios: number;
  workShift: WorkShift;
};

/** Cuerpo de `PUT /auth/profile` (sin email ni contraseña). */
export type UpdateProfileRequest = {
  nombre: string;
  apellido: string;
  categoria: WorkerCategory;
  antiguedadAnios: number;
  workShift: WorkShift;
};
