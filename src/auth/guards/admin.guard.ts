import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { SafeUser } from 'prisma/safe-user.select';
import { isAdmin } from 'src/common/utils/role.helpers';
import { JwtGuard } from './jwt.guard';

/**
 * Requires JWT token and admin role. Convenience guard combining JwtGuard + admin check.
 */
@Injectable()
export class AdminGuard extends JwtGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    // First check if JWT authentication passes
    const isAuthenticated = await super.canActivate(context);
    if (!isAuthenticated) {
      return false;
    }

    // Get the user from the request
    const request = context.switchToHttp().getRequest();
    const user = request.user as SafeUser;

    if (!user || !user.id) {
      throw new ForbiddenException('User not found in request');
    }

    // Check if user has admin role using the helper function
    if (!isAdmin(user.role)) {
      throw new ForbiddenException('Admin access required');
    }

    return true;
  }
}
