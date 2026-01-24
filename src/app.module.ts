import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './auth/auth.module';
import { AuthMiddleware } from './auth/middleware/auth.middleware';
import { DatabaseModule } from './database/database.module';
import { ModuleModule } from './module/module.module';
import { QuestionsModule } from './questions/questions.module';
import { UsersModule } from './users/users.module';
import { UserAttemptsModule } from './user-attempts/user-attempts.module';

@Module({
  imports: [
    DatabaseModule,
    AuthModule,
    UsersModule,
    ModuleModule,
    QuestionsModule,
    UserAttemptsModule,
    JwtModule.register({
      secret: process.env.JWT_ACCESS_SECRET,
      signOptions: { expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m' },
    }),
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerModule
    }
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(AuthMiddleware)
      .forRoutes('*'); // Apply to all routes
  }
}
