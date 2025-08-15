import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { hashToken, parseExpiryToDate } from 'src/common/utils/jwt.helpers';
import { DatabaseService } from 'src/database/database.service';
import { UsersService } from 'src/users/users.service';
import { AuthPayloadDto } from './dto/auth.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly jwtService: JwtService,
    private readonly usersService: UsersService,
  ) { }

  async validateUser(authPayloadDto: AuthPayloadDto) {
    const { email, password } = authPayloadDto;

    const user = await this.databaseService.user.findUnique({
      where: { email },
    });

    if (!user) return null;

    if (!user.password) {
      throw new Error('This account is linked to a third-party provider. Please use the respective OAuth login method.');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) return null;

    return user;
  }

  async generateTokensAndSave(userId: string) {
    const accessToken = this.jwtService.sign(
      { sub: userId },
      { expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m' }
    );

    const refreshToken = this.jwtService.sign(
      { sub: userId },
      {
        expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
        secret: process.env.JWT_REFRESH_SECRET
      }
    );

    const hashedToken = hashToken(refreshToken);

    const expiresAt = parseExpiryToDate(process.env.JWT_REFRESH_EXPIRES_IN || '7d');

    await this.databaseService.refreshToken.create({
      data: {
        userId,
        tokenHash: hashedToken,
        expiresAt,
      },
    });

    const user = await this.usersService.findById(userId);

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      user: {
        id: user?.id,
        email: user?.email,
        firstName: user?.firstName,
        lastName: user?.lastName,
        fullName: user?.fullName,
        picture: user?.picture,
      },
    };
  }

  async rotateRefreshToken(userId: string, refreshToken: string) {
    const hashedToken = hashToken(refreshToken);

    const storedToken = await this.databaseService.refreshToken.findFirst({
      where: {
        userId,
        tokenHash: hashedToken,
        revoked: false,
        expiresAt: {
          gt: new Date(),
        },
      },
    });

    if (!storedToken) {
      throw new Error('Invalid or expired refresh token');
    }

    // Revoke old token
    await this.databaseService.refreshToken.update({
      where: { id: storedToken.id },
      data: { revoked: true },
    });

    // Issue new tokens
    return this.generateTokensAndSave(userId);
  }

  async revokeAllTokens(userId: string) {
    await this.databaseService.refreshToken.updateMany({
      where: { userId, revoked: false },
      data: { revoked: true },
    });
  }

  async logout(refreshToken: string) {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET,
      });
      const userId = payload.sub;
      const hashedToken = hashToken(refreshToken);

      await this.databaseService.refreshToken.updateMany({
        where: {
          userId,
          tokenHash: hashedToken,
          revoked: false,
        },
        data: { revoked: true },
      });

      return { message: 'Logged out successfully' };
    } catch {
      throw new Error('Invalid refresh token');
    }
  }

  async handleGoogleAuth(googleProfile: {
    email: string;
    firstName: string;
    lastName: string;
    picture: string;
  }) {
    // Find or create user from Google profile
    const user = await this.usersService.findOrCreateGoogleUser(googleProfile);

    // Generate JWT tokens
    return this.generateTokensAndSave(user.id);
  }

  async getCurrentUser(userId: string) {
    return this.usersService.findById(userId);
  }
}

