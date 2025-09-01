import { Injectable, NestMiddleware, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request, Response, NextFunction } from 'express';
import { DatabaseService } from 'src/database/database.service';
import { hashToken } from 'src/common/utils/jwt.helpers';

@Injectable()
export class AuthMiddleware implements NestMiddleware {
  constructor(
    private readonly jwtService: JwtService,
    private readonly databaseService: DatabaseService,
  ) {}

  async use(req: Request, res: Response, next: NextFunction) {
    const accessToken = req.cookies?.access_token;
    
    if (!accessToken) {
      return next();
    }

    try {
      // Verify access token
      const payload = this.jwtService.verify(accessToken, {
        secret: process.env.JWT_ACCESS_SECRET,
      });
      
      // Token is valid, continue
      req.user = { userId: payload.sub };
      return next();
    } catch (error) {
      // Access token is expired or invalid, try to refresh
      const refreshToken = req.cookies?.refresh_token;
      
      if (!refreshToken) {
        // No refresh token, clear cookies and continue
        res.clearCookie('access_token', { path: '/' });
        res.clearCookie('refresh_token', { path: '/' });
        return next();
      }

      try {
        // Verify refresh token
        const refreshPayload = this.jwtService.verify(refreshToken, {
          secret: process.env.JWT_REFRESH_SECRET,
        });

        const userId = refreshPayload.sub;
        const hashedToken = hashToken(refreshToken);

        // Check if refresh token exists and is valid
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
          throw new UnauthorizedException('Invalid refresh token');
        }

        // Generate new access token
        const newAccessToken = this.jwtService.sign(
          { sub: userId },
          { expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m' }
        );

        // Set new access token cookie
        const isProduction = process.env.NODE_ENV === 'production';
        res.cookie('access_token', newAccessToken, {
          httpOnly: true,
          secure: isProduction,
          sameSite: isProduction ? 'strict' : 'lax',
          maxAge: 15 * 60 * 1000, // 15 minutes
          path: '/',
        });

        // Set user in request and continue
        req.user = { userId };
        return next();
      } catch (refreshError) {
        // Refresh token is invalid, clear cookies and continue
        res.clearCookie('access_token', { path: '/' });
        res.clearCookie('refresh_token', { path: '/' });
        return next();
      }
    }
  }
}
