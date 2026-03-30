export function roleLabel(role: string): string {
  if (role === 'admin') return 'Administrador';
  if (role === 'owner') return 'Propietario';
  if (role === 'office') return 'Oficina';
  if (role === 'manager') return 'Gerente';
  if (role === 'area_lead') return 'Encargado de zona';
  if (role === 'employee') return 'Empleado';
  return role;
}
