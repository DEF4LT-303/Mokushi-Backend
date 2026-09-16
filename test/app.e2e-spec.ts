import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request = require('supertest');
import cookieParser = require('cookie-parser');
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

describe('Mokushi Backend E2E Suite', () => {
  let app: INestApplication<App>;
  const testEmail = `e2e-${Date.now()}@test.com`;
  const testPassword = 'Password123!';
  let accessTokenCookie: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Authentication and User Flow', () => {
    it('/auth/register (POST) - Register a new user', () => {
      return request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: testEmail,
          password: testPassword,
          fullName: 'E2E User',
        })
        .expect(201)
        .expect((res) => {
          expect(res.body.message).toBe('Registration successful');
          expect(res.body.user.email).toBe(testEmail);
          
          // Verify that cookies are set in the response headers
          const cookies = res.headers['set-cookie'] as unknown as string[];
          expect(cookies).toBeDefined();
          const hasAccessToken = cookies.some((c: string) => c.includes('access_token'));
          expect(hasAccessToken).toBe(true);
        });
    });

    it('/auth/login (POST) - Login and receive JWT cookies', () => {
      return request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: testEmail,
          password: testPassword,
        })
        .expect(200)
        .expect((res) => {
          expect(res.body.message).toBe('Login successful');
          
          const cookies = res.headers['set-cookie'] as unknown as string[];
          expect(cookies).toBeDefined();
          
          const accessToken = cookies.find((c: string) => c.startsWith('access_token='));
          expect(accessToken).toBeDefined();
          accessTokenCookie = accessToken!;
        });
    });

    it('/auth/me (GET) - Get current user profile (Authorized)', () => {
      return request(app.getHttpServer())
        .get('/auth/me')
        .set('Cookie', [accessTokenCookie])
        .expect(200)
        .expect((res) => {
          expect(res.body.email).toBe(testEmail);
          expect(res.body.fullName).toBe('E2E User');
        });
    });

    it('/auth/me (GET) - Get current user profile (Unauthorized without cookies)', () => {
      return request(app.getHttpServer())
        .get('/auth/me')
        .expect(401);
    });

    it('/auth/logout (POST) - Logout and clear session cookies', () => {
      return request(app.getHttpServer())
        .post('/auth/logout')
        .set('Cookie', [accessTokenCookie])
        .expect(201)
        .expect((res) => {
          expect(res.body.message).toBe('Logged out successfully');
          
          const cookies = res.headers['set-cookie'] as unknown as string[];
          expect(cookies).toBeDefined();
          // Access token cookie should be set to clear
          const clearedToken = cookies.some((c: string) => c.includes('access_token=;'));
          expect(clearedToken).toBe(true);
        });
    });
  });
});
