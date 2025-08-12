import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { hashToken, parseExpiryToDate } from 'src/common/utils/jwt.helpers';
import { DatabaseService } from 'src/database/database.service';
import { AuthPayloadDto } from './dto/auth.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly jwtService: JwtService,
  ) { }

  async validateUser(authPayloadDto: AuthPayloadDto) {
    const { email, password } = authPayloadDto;

    const user = await this.databaseService.user.findUnique({
      where: { email },
    });

    if (!user) return null;

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

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
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
      const payload = this.jwtService.verify(refreshToken);
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
}

