import { IsString, MaxLength, MinLength } from 'class-validator';

/**
 * Self-registration payload. Note there is no `role` field: the role is set
 * server-side, which closes the privilege-escalation hole in the original app
 * (where the client could POST `role: 'ROLE_ADMIN'`).
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
