import { SetMetadata } from '@nestjs/common';
import { Role } from '@prisma/client';

export const ROLES_KEY = 'roles';

/**
 * Specifies required roles for a route handler. Use with RolesGuard.
 * @example @Roles(Role.ADMIN) or @Roles(Role.ADMIN, Role.MODERATOR)
 */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);


