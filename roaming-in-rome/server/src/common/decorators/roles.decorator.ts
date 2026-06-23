import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';

/**
 * Restricts a route to the given roles. Enforced by RolesGuard.
 * Example: @Roles('ROLE_ADMIN')
 */
export const Roles = (...roles: string[]): MethodDecorator & ClassDecorator =>
  SetMetadata(ROLES_KEY, roles);
