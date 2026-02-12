function resolveMessage(
  code: string | undefined,
  messages: Record<string, string>,
): string | null {
  if (!code) return null;
  return messages[code] ?? null;
}

const LOGIN_ERROR_MESSAGES = {
  disabled: 'Tu usuario esta desactivado. Contacta a tu manager o al equipo de oficina.',
  missing: 'Escribe tu email y contrasena para continuar.',
  bad: 'Email o contrasena incorrectos. Verifica tus datos e intenta de nuevo.',
} as const;

const EMPLOYEE_ERROR_MESSAGES = {
  missing: 'Completa todos los campos obligatorios antes de guardar.',
  invalid_email: 'El email no tiene un formato valido.',
  weak_password: 'La contrasena es debil. Usa al menos 8 caracteres.',
  invalid_role: 'El rol seleccionado no es valido.',
  no_effective_restaurant: 'No hay restaurante activo. Ve a /app y selecciona un restaurante.',
  restaurant_mismatch: 'No tienes permisos para gestionar usuarios de otro restaurante.',
  restaurant_invalid: 'El restaurante no existe o esta inactivo.',
  global_user: 'Ese usuario es global (admin/office) y no se gestiona desde Equipo.',
  manager_protected: 'Solo admin u office pueden editar un gerente.',
  manager_exists: 'Ya existe un manager activo en este restaurante.',
  sub_manager_exists: 'Ya existe un sub manager activo en este restaurante.',
} as const;

const EMPLOYEE_SUCCESS_MESSAGES = {
  created: 'Empleado creado correctamente.',
} as const;

const PROFILE_ERROR_MESSAGES = {
  missing: 'Completa todos los campos obligatorios.',
  invalid_email: 'El email no tiene un formato valido.',
  bad_password: 'Contrasena actual incorrecta.',
  weak_password: 'La contrasena es debil. Usa al menos 8 caracteres.',
  password_mismatch: 'Las contrasenas no coinciden.',
  bad_file: 'Archivo invalido. Sube una imagen JPG, PNG o WEBP.',
  file_too_large: 'La imagen pesa demasiado (maximo 2 MB).',
  bad: 'No se pudo completar la operacion. Intenta nuevamente.',
} as const;

const PROFILE_SUCCESS_MESSAGES = {
  email: 'Email actualizado. Revisa tu bandeja para confirmar el cambio (si aplica).',
  password: 'Contrasena actualizada.',
  avatar: 'Foto de perfil actualizada.',
} as const;

export type LoginErrorCode = keyof typeof LOGIN_ERROR_MESSAGES;
export type EmployeeErrorCode = keyof typeof EMPLOYEE_ERROR_MESSAGES;
export type EmployeeSuccessCode = keyof typeof EMPLOYEE_SUCCESS_MESSAGES;
export type ProfileErrorCode = keyof typeof PROFILE_ERROR_MESSAGES;
export type ProfileSuccessCode = keyof typeof PROFILE_SUCCESS_MESSAGES;
export type EmployeeStatusFilter = 'active' | 'inactive' | 'all';

export function loginPathWithError(code: LoginErrorCode): string {
  return `/login?e=${code}`;
}

export function employeesPathWithError(code: EmployeeErrorCode): string {
  return `/employees?e=${code}`;
}

export function employeesPathWithSuccess(
  code: EmployeeSuccessCode,
  status: EmployeeStatusFilter = 'active',
): string {
  return `/employees?status=${status}&ok=${code}`;
}

export function employeeDetailPathWithError(
  userId: string,
  code: EmployeeErrorCode,
): string {
  return `/employees/${userId}?e=${code}`;
}

export function mePathWithError(code: ProfileErrorCode): string {
  return `/me?e=${code}`;
}

export function mePathWithSuccess(code: ProfileSuccessCode): string {
  return `/me?ok=${code}`;
}

export function getLoginErrorMessage(code: LoginErrorCode | undefined): string | null {
  return resolveMessage(code, LOGIN_ERROR_MESSAGES);
}

export function getEmployeeErrorMessage(
  code: EmployeeErrorCode | undefined,
): string | null {
  return resolveMessage(code, EMPLOYEE_ERROR_MESSAGES);
}

export function getEmployeeSuccessMessage(
  code: EmployeeSuccessCode | undefined,
): string | null {
  return resolveMessage(code, EMPLOYEE_SUCCESS_MESSAGES);
}

export function getProfileErrorMessage(code: ProfileErrorCode | undefined): string | null {
  return resolveMessage(code, PROFILE_ERROR_MESSAGES);
}

export function getProfileSuccessMessage(
  code: ProfileSuccessCode | undefined,
): string | null {
  return resolveMessage(code, PROFILE_SUCCESS_MESSAGES);
}
