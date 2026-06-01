import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Extracts the current authenticated user from the request object.
 * Use with JwtGuard, OptionalJwtGuard, or LocalGuard.
 */
export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
