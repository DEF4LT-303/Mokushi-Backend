import {
  Injectable,
  NestMiddleware,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { NextFunction, Request, Response } from "express";
import {
  clearAuthCookies,
  getCookieOptions,
} from "src/common/utils/cookie.helpers";
import { hashToken } from "src/common/utils/jwt.helpers";
import { DatabaseService } from "src/database/database.service";

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

      // Token is valid
      req.user = { id: payload.sub, userId: payload.sub };
      return next();
    } catch (error) {
      // Access token is expired or invalid, try to refresh
      const refreshToken = req.cookies?.refresh_token;

      if (!refreshToken) {
        // No refresh token, clear cookies and continue
        clearAuthCookies(res);
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
          throw new UnauthorizedException("Invalid refresh token");
        }

        // Generate new access token
        const newAccessToken = this.jwtService.sign(
          { sub: userId },
          { expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || "15m" },
        );

        // Set new access token cookie using matching cookie options
        const isProduction = process.env.NODE_ENV === "production";
        const baseOptions = getCookieOptions(isProduction);
        res.cookie("access_token", newAccessToken, {
          ...baseOptions,
          maxAge: parseInt(process.env.COOKIE_ACCESS_MAX_AGE || "900000", 10),
        });

        // Mutate req.cookies and authorization header for the current in-flight request
        if (req.cookies) {
          req.cookies.access_token = newAccessToken;
        }
        req.headers.authorization = `Bearer ${newAccessToken}`;

        // Set user in request with both id and userId
        req.user = { id: userId, userId };
        return next();
      } catch (refreshError) {
        // Refresh token is invalid, clear cookies and continue
        clearAuthCookies(res);
        return next();
      }
    }
  }
}
