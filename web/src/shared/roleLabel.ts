export function roleLabel(role: string): string {
  if (role === 'admin') return 'Administrador';
  if (role === 'office') return 'Oficina';
  if (role === 'chain_owner') return 'Propietario';
  if (role === 'manager') return 'Gerente';
  if (role === 'sub_manager') return 'Subgerente';
  if (role === 'area_lead') return 'Encargado de zona';
  if (role === 'employee') return 'Empleado';
  return role;
}
