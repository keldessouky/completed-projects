import { Injectable } from '@nestjs/common';
import { User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  /** Indexed unique lookup by username. */
  findByUsername(username: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { username } });
  }

  /**
   * Creates a user with a pre-hashed password. Role is decided by the caller
   * (AuthService forces ROLE_USER for self-registration) — never by the client.
   */
  create(username: string, passwordHash: string, role: string): Promise<User> {
    return this.prisma.user.create({
      data: { username, passwordHash, role },
    });
  }
}
