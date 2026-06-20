import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { SafeUser } from 'prisma/safe-user.select';
import { ROLES_KEY } from '../decorators/roles.decorator';

/**
 * Role-based access control. Checks if user has required role from @Roles() decorator.
 * Use with JwtGuard and @Roles() decorator.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) { }

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user as SafeUser | undefined;

    if (!user || !('role' in user)) {
      throw new ForbiddenException('User role not found');
    }

    const hasRequired = requiredRoles.includes(user.role as Role);
    if (!hasRequired) {
      throw new ForbiddenException('Insufficient role');
    }

    return true;
  }
}


