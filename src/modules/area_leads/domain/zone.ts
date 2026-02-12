export type ZoneKey = 'kitchen' | 'floor' | 'bar';

export const ZONES: ReadonlyArray<{ key: ZoneKey; label: string }> = [
  { key: 'kitchen', label: 'Cocina' },
  { key: 'floor', label: 'Sala' },
  { key: 'bar', label: 'Barra' },
];
