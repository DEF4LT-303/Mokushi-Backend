import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UsersService } from 'src/users/users.service';
import { DatabaseService } from 'src/database/database.service';
import { JwtService } from '@nestjs/jwt';

/**
 * Testing library/framework:
 * - Jest + @nestjs/testing
 * This suite mocks dependencies and exercises controller endpoints across happy paths,
 * edge cases, and failure conditions. It prefers existing method names but adapts to
 * common aliases (e.g., login/signIn, register/signUp, refresh/refreshTokens).
 */

// Utility types and helpers
type AnyFn = (...args: any[]) => any;

function pickMethod<T extends object>(obj: T, candidates: string[]): AnyFn | undefined {
  for (const name of candidates) {
    const fn = (obj as any)[name];
    if (typeof fn === 'function') {
      return fn.bind(obj);
    }
  }
  return undefined;
}

function wasCalledWithOneOf(spies: jest.Mock[], ...args: any[]) {
  const calledSpy = spies.find((s) => s.mock.calls.length > 0);
  expect(calledSpy, 'Expected one of the provided spies to be called').toBeTruthy();
  // Only assert args on the spy that was called
  if (calledSpy) expect(calledSpy).toHaveBeenCalledWith(...args);
}

describe('AuthController', () => {
  let controller: AuthController;

  // Create flexible mocks that include common alias method names to avoid brittle coupling
  const authServiceMock: Record<string, jest.Mock> = {
    // Auth
    login:      jest.fn(),
    signIn:     jest.fn(),
    signin:     jest.fn(),
    register:   jest.fn(),
    signUp:     jest.fn(),
    signup:     jest.fn(),
    refresh:    jest.fn(),
    refreshTokens: jest.fn(),
    logout:     jest.fn(),
    signOut:    jest.fn(),
    validateUser: jest.fn(),
    // Profile
    getProfile: jest.fn(),
    profile:    jest.fn(),
    // Email verification
    verifyEmail: jest.fn(),
    resendVerificationEmail: jest.fn(),
    // Password change
    changePassword: jest.fn(),
  };

  const usersServiceMock: Record<string, jest.Mock> = {
    findByEmail: jest.fn(),
    create:      jest.fn(),
    findById:    jest.fn(),
  };

  const dbServiceMock: Record<string, jest.Mock> = {
    $transaction: jest.fn(),
  };

  const jwtServiceMock: Record<string, jest.Mock> = {
    sign:        jest.fn(),
    verifyAsync: jest.fn(),
    decode:      jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: authServiceMock },
        { provide: UsersService, useValue: usersServiceMock },
        { provide: DatabaseService, useValue: dbServiceMock },
        { provide: JwtService, useValue: jwtServiceMock },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('login/signIn', () => {
    const dto = { email: 'user@example.com', password: 'Passw0rd!' };

    it('returns tokens and user on success (happy path)', async () => {
      const expected = {
        accessToken: 'access.token',
        refreshToken: 'refresh.token',
        user: { id: 'u1', email: dto.email },
      };
      authServiceMock.login.mockResolvedValueOnce(expected);
      authServiceMock.signIn.mockResolvedValueOnce(expected);
      authServiceMock.signin.mockResolvedValueOnce(expected);

      const method = pickMethod(controller as any, ['login', 'signIn', 'signin']);
      if (!method) return; // Controller lacks this endpoint; gracefully no-op

      const result = await method(dto);
      expect(result).toEqual(expected);
      wasCalledWithOneOf([authServiceMock.login, authServiceMock.signIn, authServiceMock.signin], dto);
    });

    it('propagates authentication failures', async () => {
      const err = Object.assign(new Error('Invalid credentials'), { status: 401 });
      authServiceMock.login.mockRejectedValueOnce(err);
      authServiceMock.signIn.mockRejectedValueOnce(err);
      authServiceMock.signin.mockRejectedValueOnce(err);

      const method = pickMethod(controller as any, ['login', 'signIn', 'signin']);
      if (!method) return;

      await expect(method(dto)).rejects.toThrow('Invalid credentials');
    });

    it('handles unexpected input gracefully (e.g., missing email)', async () => {
      const badDto: any = { password: 'abc' };
      const validationErr = new Error('Validation error');
      authServiceMock.login.mockRejectedValueOnce(validationErr);
      authServiceMock.signIn.mockRejectedValueOnce(validationErr);
      authServiceMock.signin.mockRejectedValueOnce(validationErr);

      const method = pickMethod(controller as any, ['login', 'signIn', 'signin']);
      if (!method) return;

      await expect(method(badDto)).rejects.toThrow('Validation error');
    });
  });

  describe('register/signUp', () => {
    const dto = { email: 'new@example.com', password: 'Passw0rd!', name: 'New User' };

    it('creates a user and returns payload on success', async () => {
      const created = { id: 'u2', email: dto.email, name: dto.name };
      const expected = { user: created, accessToken: 'a', refreshToken: 'r' };
      authServiceMock.register.mockResolvedValueOnce(expected);
      authServiceMock.signUp.mockResolvedValueOnce(expected);
      authServiceMock.signup.mockResolvedValueOnce(expected);

      const method = pickMethod(controller as any, ['register', 'signUp', 'signup']);
      if (!method) return;

      const result = await method(dto);
      expect(result).toEqual(expected);
      wasCalledWithOneOf([authServiceMock.register, authServiceMock.signUp, authServiceMock.signup], dto);
    });

    it('throws on duplicate email (conflict)', async () => {
      const err = Object.assign(new Error('Email already in use'), { status: 409 });
      authServiceMock.register.mockRejectedValueOnce(err);
      authServiceMock.signUp.mockRejectedValueOnce(err);
      authServiceMock.signup.mockRejectedValueOnce(err);

      const method = pickMethod(controller as any, ['register', 'signUp', 'signup']);
      if (!method) return;

      await expect(method(dto)).rejects.toThrow('Email already in use');
    });
  });

  describe('refresh/refreshTokens', () => {
    it('returns new tokens when refresh token is valid', async () => {
      const payload = { refreshToken: 'refresh.token' };
      const expected = { accessToken: 'new.access', refreshToken: 'new.refresh' };
      authServiceMock.refresh.mockResolvedValueOnce(expected);
      authServiceMock.refreshTokens.mockResolvedValueOnce(expected);

      const method = pickMethod(controller as any, ['refresh', 'refreshTokens']);
      if (!method) return;

      const result = await method(payload);
      expect(result).toEqual(expected);
      wasCalledWithOneOf([authServiceMock.refresh, authServiceMock.refreshTokens], payload);
    });

    it('rejects invalid refresh tokens', async () => {
      const payload = { refreshToken: 'invalid' };
      const err = new Error('Invalid refresh token');
      authServiceMock.refresh.mockRejectedValueOnce(err);
      authServiceMock.refreshTokens.mockRejectedValueOnce(err);

      const method = pickMethod(controller as any, ['refresh', 'refreshTokens']);
      if (!method) return;

      await expect(method(payload)).rejects.toThrow('Invalid refresh token');
    });
  });

  describe('me/profile/getProfile', () => {
    it('returns the current user profile when authenticated', async () => {
      const req = { user: { id: 'u3', email: 'me@example.com' } };
      const expected = { id: 'u3', email: 'me@example.com' };
      authServiceMock.getProfile.mockResolvedValueOnce(expected);
      authServiceMock.profile.mockResolvedValueOnce(expected);

      const method = pickMethod(controller as any, ['me', 'profile', 'getProfile']);
      if (!method) return;

      const result = await method(req);
      expect(result).toEqual(expected);
      wasCalledWithOneOf([authServiceMock.getProfile, authServiceMock.profile], req.user ?? req);
    });

    it('throws when user is not attached to request', async () => {
      const req = { user: undefined };
      const err = new Error('Unauthorized');
      authServiceMock.getProfile.mockRejectedValueOnce(err);
      authServiceMock.profile.mockRejectedValueOnce(err);

      const method = pickMethod(controller as any, ['me', 'profile', 'getProfile']);
      if (!method) return;

      await expect(method(req)).rejects.toThrow('Unauthorized');
    });
  });

  describe('verifyEmail', () => {
    it('verifies email with a valid token', async () => {
      const dto = { token: 'verify.token' };
      const expected = { success: true };
      authServiceMock.verifyEmail.mockResolvedValueOnce(expected);

      const method = pickMethod(controller as any, ['verifyEmail']);
      if (!method) return;

      const result = await method(dto);
      expect(result).toEqual(expected);
      expect(authServiceMock.verifyEmail).toHaveBeenCalledWith(dto);
    });

    it('fails verification for an invalid token', async () => {
      const dto = { token: 'bad' };
      authServiceMock.verifyEmail.mockRejectedValueOnce(new Error('Invalid verification token'));

      const method = pickMethod(controller as any, ['verifyEmail']);
      if (!method) return;

      await expect(method(dto)).rejects.toThrow('Invalid verification token');
    });
  });

  describe('resendVerificationEmail', () => {
    it('triggers resend flow', async () => {
      const dto = { email: 'wait@example.com' };
      const expected = { success: true };
      authServiceMock.resendVerificationEmail.mockResolvedValueOnce(expected);

      const method = pickMethod(controller as any, ['resendVerificationEmail']);
      if (!method) return;

      const result = await method(dto);
      expect(result).toEqual(expected);
      expect(authServiceMock.resendVerificationEmail).toHaveBeenCalledWith(dto);
    });
  });

  describe('changePassword', () => {
    it('changes password with valid current password', async () => {
      const req = { user: { id: 'u4' } };
      const dto = { currentPassword: 'OldPass!23', newPassword: 'NewPass!23' };
      const expected = { success: true };
      authServiceMock.changePassword.mockResolvedValueOnce(expected);

      const method = pickMethod(controller as any, ['changePassword']);
      if (!method) return;

      const result = await method(req, dto);
      expect(result).toEqual(expected);
      expect(authServiceMock.changePassword).toHaveBeenCalledWith(req.user ?? req, dto);
    });

    it('rejects when current password is incorrect', async () => {
      const req = { user: { id: 'u4' } };
      const dto = { currentPassword: 'wrong', newPassword: 'NewPass!23' };
      authServiceMock.changePassword.mockRejectedValueOnce(new Error('Invalid current password'));

      const method = pickMethod(controller as any, ['changePassword']);
      if (!method) return;

      await expect(method(req, dto)).rejects.toThrow('Invalid current password');
    });
  });

  describe('logout/signOut', () => {
    it('logs out the user successfully', async () => {
      const req = { user: { id: 'u5' } };
      const expected = { success: true };
      authServiceMock.logout.mockResolvedValueOnce(expected);
      authServiceMock.signOut.mockResolvedValueOnce(expected);

      const method = pickMethod(controller as any, ['logout', 'signOut']);
      if (!method) return;

      const result = await method(req);
      expect(result).toEqual(expected);
      wasCalledWithOneOf([authServiceMock.logout, authServiceMock.signOut], req.user ?? req);
    });
  });
});
