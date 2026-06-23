import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { AuthService, LoginResult, PublicUser } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { Public } from '../common/decorators/public.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  register(@Body() dto: RegisterDto): Promise<PublicUser> {
    return this.auth.register(dto.username, dto.password);
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto): Promise<LoginResult> {
    return this.auth.login(dto.username, dto.password);
  }
}
