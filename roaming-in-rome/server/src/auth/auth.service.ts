import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { JwtPayload } from './jwt.strategy';
import { Role } from '../common/roles';
import { UsersService } from '../users/users.service';

const BCRYPT_ROUNDS = 10;

/** Public-facing user shape — never includes the password hash. */
export interface PublicUser {
  id: number;
  username: string;
  role: string;
}

export interface LoginResult {
  token: string;
  user: PublicUser;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
  ) {}

  /**
   * Registers a new user. The role is always ROLE_USER — the client cannot
   * choose it. Throws 409 if the username is taken.
   */
  async register(username: string, password: string): Promise<PublicUser> {
    const existing = await this.users.findByUsername(username);
    if (existing) {
      throw new ConflictException('Username already exists');
    }
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const user = await this.users.create(username, passwordHash, Role.User);
    return this.toPublicUser(user.id, user.username, user.role);
  }

  /**
   * Verifies credentials and issues a JWT. Uses a constant 401 message for
   * both "no such user" and "wrong password" so usernames can't be probed.
   */
  async login(username: string, password: string): Promise<LoginResult> {
    const user = await this.users.findByUsername(username);
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new UnauthorizedException('Invalid username or password');
    }
    const payload: JwtPayload = { sub: user.id, username: user.username, role: user.role };
    const token = await this.jwt.signAsync(payload);
    return { token, user: this.toPublicUser(user.id, user.username, user.role) };
  }

  private toPublicUser(id: number, username: string, role: string): PublicUser {
    return { id, username, role };
  }
}
