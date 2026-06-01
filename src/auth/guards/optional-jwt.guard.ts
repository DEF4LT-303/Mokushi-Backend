import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Optional JWT authentication. Allows both authenticated and anonymous access.
 * Returns user if valid token present, otherwise returns null.
 */
@Injectable()
export class OptionalJwtGuard extends AuthGuard('jwt') {
  handleRequest(err, user, info) {
    // Don't throw error if no user
    return user || null;
  }

  canActivate(context: ExecutionContext) {
    return super.canActivate(context) as any;
  }
}