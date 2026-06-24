import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';

describe('AuthService', () => {
  let service: AuthService;
  let users: jest.Mocked<Pick<UsersService, 'findByUsername' | 'create'>>;
  let jwt: jest.Mocked<Pick<JwtService, 'signAsync'>>;

  beforeEach(() => {
    users = { findByUsername: jest.fn(), create: jest.fn() };
    jwt = { signAsync: jest.fn().mockResolvedValue('signed.jwt.token') };
    service = new AuthService(users as unknown as UsersService, jwt as unknown as JwtService);
  });

  describe('register', () => {
    it('forces ROLE_USER regardless of any client input', async () => {
      users.findByUsername.mockResolvedValue(null);
      users.create.mockImplementation((username, passwordHash, role) =>
        Promise.resolve({ id: 7, username, passwordHash, role }),
      );

      const result = await service.register('alice', 'password123');

      expect(users.create).toHaveBeenCalledWith('alice', expect.any(String), 'ROLE_USER');
      expect(result).toEqual({ id: 7, username: 'alice', role: 'ROLE_USER' });
      // never leak the hash
      expect(result).not.toHaveProperty('passwordHash');
    });

    it('hashes the password before storing it', async () => {
      users.findByUsername.mockResolvedValue(null);
      users.create.mockImplementation((username, passwordHash, role) =>
        Promise.resolve({ id: 1, username, passwordHash, role }),
      );

      await service.register('bob', 'supersecret');

      const storedHash = users.create.mock.calls[0][1];
      expect(storedHash).not.toBe('supersecret');
      await expect(bcrypt.compare('supersecret', storedHash)).resolves.toBe(true);
    });

    it('rejects a duplicate username with 409', async () => {
      users.findByUsername.mockResolvedValue({
        id: 1,
        username: 'taken',
        passwordHash: 'x',
        role: 'ROLE_USER',
      });

      await expect(service.register('taken', 'password123')).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(users.create).not.toHaveBeenCalled();
    });
  });

  describe('login', () => {
    it('issues a token carrying the user id and role on valid credentials', async () => {
      const passwordHash = await bcrypt.hash('password123', 10);
      users.findByUsername.mockResolvedValue({
        id: 42,
        username: 'carol',
        passwordHash,
        role: 'ROLE_ADMIN',
      });

      const result = await service.login('carol', 'password123');

      expect(jwt.signAsync).toHaveBeenCalledWith({
        sub: 42,
        username: 'carol',
        role: 'ROLE_ADMIN',
      });
      expect(result).toEqual({
        token: 'signed.jwt.token',
        user: { id: 42, username: 'carol', role: 'ROLE_ADMIN' },
      });
    });

    it('rejects an unknown user with 401', async () => {
      users.findByUsername.mockResolvedValue(null);
      await expect(service.login('ghost', 'whatever')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('rejects a wrong password with 401', async () => {
      const passwordHash = await bcrypt.hash('correct', 10);
      users.findByUsername.mockResolvedValue({
        id: 1,
        username: 'dave',
        passwordHash,
        role: 'ROLE_USER',
      });
      await expect(service.login('dave', 'wrong')).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });
});
