import { Body, Controller, Get, HttpException, HttpStatus, Post, Req, Res, UseGuards, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthGuard } from '@nestjs/passport';
import { ApiBody, ApiConflictResponse, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Prisma } from '@prisma/client';
import { Request, Response } from 'express';
import { clearAuthCookies, setAuthCookies } from 'src/common/utils/cookie.helpers';
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
  @ApiOperation({ summary: 'Login user and return JWT token in cookies' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        email: { type: 'string', example: 'user@example.com' },
        password: { type: 'string', example: 'password123' },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'User logged in successfully with cookies set' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.generateTokensAndSave((req.user as any).id);

    // Set secure HTTP-only cookies
    const isProduction = process.env.NODE_ENV === 'production';
    setAuthCookies(res, result.accessToken, result.refreshToken, isProduction);

    return {
      message: 'Login successful',
      user: result.user,
    };
  }

  @Post('register')
  @ApiOperation({ summary: 'Register a new user and return JWT token in cookies' })
  @ApiBody({ type: CreateUserDto })
  @ApiResponse({ status: 201, description: 'User registered successfully with cookies set' })
  @ApiConflictResponse({ description: 'Email already exists' })
  async register(@Body(ValidationPipe) createUserDto: CreateUserDto, @Res({ passthrough: true }) res: Response) {
    try {
      const user = await this.usersService.create(createUserDto);
      const result = await this.authService.generateTokensAndSave(user.id);

      // Set secure HTTP-only cookies
      const isProduction = process.env.NODE_ENV === 'production';
      setAuthCookies(res, result.accessToken, result.refreshToken, isProduction);

      return {
        message: 'Registration successful',
        user: result.user,
      };
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
  @ApiOperation({ summary: 'Refresh access token using refresh token from cookie' })
  @ApiResponse({ status: 201, description: 'New tokens returned in cookies' })
  @ApiResponse({ status: 401, description: 'Invalid or expired refresh token' })
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    try {
      const refreshToken = req.cookies?.refresh_token;
      if (!refreshToken) {
        throw new HttpException('Refresh token not found', HttpStatus.UNAUTHORIZED);
      }

      const payload = this.jwtService.verify(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET
      });
      const userId = payload.sub;

      const result = await this.authService.rotateRefreshToken(userId, refreshToken);

      // Set new secure HTTP-only cookies
      const isProduction = process.env.NODE_ENV === 'production';
      setAuthCookies(res, result.accessToken, result.refreshToken, isProduction);

      return {
        message: 'Tokens refreshed successfully',
        user: result.user,
      };
    } catch {
      throw new HttpException(
        'Invalid or expired refresh token',
        HttpStatus.UNAUTHORIZED,
      );
    }
  }

  @Post('logout')
  @ApiOperation({ summary: 'Logout user and revoke refresh tokens' })
  @ApiResponse({ status: 200, description: 'Tokens revoked successfully and cookies cleared' })
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    try {
      const refreshToken = req.cookies?.refresh_token;
      if (refreshToken) {
        await this.authService.logout(refreshToken);
      }

      // Clear cookies
      clearAuthCookies(res);

      return { message: 'Logged out successfully' };
    } catch (error) {
      // Clear cookies even if there's an error
      clearAuthCookies(res);
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

      // Set secure HTTP-only cookies
      const isProduction = process.env.NODE_ENV === 'production';
      setAuthCookies(res, tokens.accessToken, tokens.refreshToken, isProduction);

      // Redirect to frontend with success message
      const redirectUrl = process.env.FRONTEND_REDIRECT_URL || 'http://localhost:3000/oauth-callback';
      res.redirect(`${redirectUrl}?success=true`);
    } catch (error) {
      const errorRedirectUrl = process.env.FRONTEND_ERROR_REDIRECT_URL || 'http://localhost:3000/error';
      res.redirect(errorRedirectUrl);
    }
  }

  @Get('me')
  @UseGuards(AuthGuard('jwt'))
  async getCurrentUser(@Req() req) {
    return this.authService.getCurrentUser(req.user.id);
  }

  @Get('test-auth')
  @ApiOperation({ summary: 'Test authentication middleware' })
  @ApiResponse({ status: 200, description: 'Authentication status' })
  async testAuth(@Req() req) {
    if (req.user) {
      return {
        authenticated: true,
        userId: req.user.id,
        message: 'User is authenticated via middleware or JWT guard'
      };
    }
    return {
      authenticated: false,
      message: 'User is not authenticated'
    };
  }
}
