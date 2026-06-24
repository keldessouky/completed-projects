import { IsString, MaxLength, MinLength } from 'class-validator';

/**
 * Self-registration payload. There is deliberately no `role` field: the role is
 * assigned server-side so a client cannot grant itself elevated privileges
 * (e.g. by sending `role: 'ROLE_ADMIN'`).
 */
export class RegisterDto {
  @IsString()
  @MinLength(3)
  @MaxLength(50)
  username!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(100)
  password!: string;
}
