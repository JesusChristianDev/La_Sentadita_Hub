import type { PersonProfile } from '@/modules/people/domain/personProfile';

/**
 * Projection de usuario autenticado para UI.
 */
export type UserProfileView = PersonProfile;

/**
 * @deprecated Usa UserProfileView o contratos canónicos.
 */
export type Profile = UserProfileView;
