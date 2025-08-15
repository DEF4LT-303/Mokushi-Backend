import { Body, Controller, Get, HttpException, HttpStatus, Post, Req, Res, UseGuards, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthGuard } from '@nestjs/passport';
import { ApiBody, ApiConflictResponse, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Prisma } from '@prisma/client';
import { Request, Response } from 'express';
import { CreateUserDto } from 'src/users/dto/create-user.dto';
import { UsersService } from 'src/users/users.service';
import { AuthService } from './auth.service';
import { LocalGuard } from './guards/local.guard';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly usersService: UsersService,
    private readonly authService: AuthService,
    private readonly jwtService: JwtService,
  ) { }

  @Post('login')
  @UseGuards(LocalGuard)
  @ApiOperation({ summary: 'Login user and return JWT token' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        email: { type: 'string', example: 'user@example.com' },
        password: { type: 'string', example: 'password123' },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'JWT token returned on success' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(@Req() req: Request) {
    return this.authService.generateTokensAndSave((req.user as any).id);
  }

  @Post('register')
  @ApiOperation({ summary: 'Register a new user and return JWT token' })
  @ApiBody({ type: CreateUserDto })
  @ApiResponse({ status: 201, description: 'User registered successfully' })
  @ApiConflictResponse({ description: 'Email already exists' })
  async register(@Body(ValidationPipe) createUserDto: CreateUserDto) {
    try {
      const user = await this.usersService.create(createUserDto);
      return this.authService.generateTokensAndSave(user.id);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new HttpException(
            'Email already exists',
            HttpStatus.CONFLICT
          );
        }
      }
      throw error;
    }
  }

  @Post('refresh-token')
  @ApiOperation({ summary: 'Refresh access token using refresh token' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        refresh_token: { type: 'string' },
      },
      required: ['refresh_token'],
    },
  })
  @ApiResponse({ status: 201, description: 'New tokens returned' })
  @ApiResponse({ status: 401, description: 'Invalid or expired refresh token' })
  async refresh(@Body('refresh_token') refreshToken: string) {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET
      });
      const userId = payload.sub;

      return await this.authService.rotateRefreshToken(userId, refreshToken);
    } catch {
      throw new HttpException(
        'Invalid or expired refresh token',
        HttpStatus.UNAUTHORIZED,
      );
    }
  }

  @Post('logout')
  @ApiOperation({ summary: 'Logout user and revoke refresh tokens' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        refresh_token: { type: 'string' },
      },
      required: ['refresh_token'],
    },
  })
  @ApiResponse({ status: 200, description: 'Tokens revoked successfully' })
  async logout(@Body('refresh_token') refreshToken: string) {

    try {
      return await this.authService.logout(refreshToken);
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.UNAUTHORIZED);
    }
  }

  @Get('google')
  @UseGuards(AuthGuard('google'))
  @ApiOperation({ summary: 'Initiate Google OAuth login' })
  async googleAuth() {
    // This route will redirect to Google OAuth
  }

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  @ApiOperation({ summary: 'Google OAuth callback - handle authentication' })
  @ApiResponse({ status: 200, description: 'Google authentication successful' })
  async googleAuthCallback(@Req() req: Request, @Res() res: Response) {
    try {
      const googleProfile = req.user as any;
      const tokens = await this.authService.handleGoogleAuth(googleProfile);

      // Redirect to frontend with tokens
      const redirectUrl = process.env.FRONTEND_REDIRECT_URL || 'http://localhost:3000/oauth-callback';
      const queryParams = new URLSearchParams({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
      });

      res.redirect(`${redirectUrl}?${queryParams.toString()}`);
    } catch (error) {
      const errorRedirectUrl = process.env.FRONTEND_ERROR_REDIRECT_URL || 'http://localhost:3000/error';
      res.redirect(errorRedirectUrl);
    }
  }

  @Get('me')
  @UseGuards(AuthGuard('jwt'))
  async getCurrentUser(@Req() req) {
    return this.authService.getCurrentUser(req.user.userId);
  }
}
