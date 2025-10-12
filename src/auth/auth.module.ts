import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { DatabaseModule } from 'src/database/database.module';
import { UsersModule } from 'src/users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AdminGuard } from './guards/admin.guard';
import { GoogleStrategy } from './strategies/google.strategy';
import { JwtStrategy } from './strategies/jwt.strategy';
import { localStrategy } from './strategies/local.strategy';

@Module({
  imports: [
    DatabaseModule,
    PassportModule,
    UsersModule,
    JwtModule.register({
      secret: process.env.JWT_ACCESS_SECRET,
      signOptions: { expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m' },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, localStrategy, JwtStrategy, GoogleStrategy, AdminGuard],
  exports: [AdminGuard],
})
export class AuthModule { }
