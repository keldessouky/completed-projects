import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * The authenticated principal attached to the request by JwtStrategy.
 * Identity always comes from the verified token — never from path/body params.
 */
export interface AuthUser {
  id: number;
  username: string;
  role: string;
}

/**
 * Injects the authenticated user (or one of its fields) into a handler.
 * Example: `@CurrentUser() user: AuthUser` or `@CurrentUser('id') id: number`.
 */
export const CurrentUser = createParamDecorator(
  (data: keyof AuthUser | undefined, ctx: ExecutionContext): AuthUser | AuthUser[keyof AuthUser] => {
    const request = ctx.switchToHttp().getRequest<{ user: AuthUser }>();
    const user = request.user;
    return data ? user[data] : user;
  },
);
