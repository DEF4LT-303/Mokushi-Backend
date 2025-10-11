import { Injectable } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { Request } from "express";
import { DatabaseService } from "src/database/database.service";
import { SafeUser } from "prisma/safe-user.select";

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly databaseService: DatabaseService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        // First try to extract from cookies
        (request: Request) => {
          return request?.cookies?.access_token;
        },
        // Fallback to Authorization header for backward compatibility
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_ACCESS_SECRET || 'default',
    })
  }

  async validate(payload: any) {
    // Fetch full user data from database
    const user = await this.databaseService.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        fullName: true,
        firstName: true,
        lastName: true,
        picture: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (user) {
      return user as SafeUser;
    }
    
    // Fallback to just userId if user not found
    return {
      userId: payload.sub,
    };
  }
}