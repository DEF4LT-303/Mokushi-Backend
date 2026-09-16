import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './auth/auth.module';
import { AuthMiddleware } from './auth/middleware/auth.middleware';
import { DatabaseModule } from './database/database.module';
import { LeaderboardModule } from './leaderboard/leaderboard.module';
import { LessonsModule } from './lessons/lessons.module';
import { ModuleModule } from './module/module.module';
import { QuestionsModule } from './questions/questions.module';
import { RapidFireModule } from './rapid-fire/rapid-fire.module';
import { UserAttemptsModule } from './user-attempts/user-attempts.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    DatabaseModule,
    AuthModule,
    UsersModule,
    ModuleModule,
    LessonsModule,
    QuestionsModule,
    RapidFireModule,
    UserAttemptsModule,
    JwtModule.register({
      secret: process.env.JWT_ACCESS_SECRET,
      signOptions: { expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m' },
    }),
    LeaderboardModule,
    ThrottlerModule.forRoot([{
      ttl: 60000,
      limit: 100,
    }]),
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
