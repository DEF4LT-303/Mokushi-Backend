import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

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