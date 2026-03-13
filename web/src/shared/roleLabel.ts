export function roleLabel(role: string): string {
  if (role === 'admin') return 'Administrador';
  if (role === 'office') return 'Oficina';
  if (role === 'manager') return 'Gerente';
  if (role === 'sub_manager') return 'Subgerente';
  if (role === 'employee') return 'Empleado';
  return role;
}
