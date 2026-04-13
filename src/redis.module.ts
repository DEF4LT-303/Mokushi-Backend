import { CacheModule } from '@nestjs/cache-manager';
import { Module } from '@nestjs/common';
import * as redisStore from 'cache-manager-ioredis-yet';

@Module({
  imports: [
    CacheModule.register({
      store: redisStore,
      url: process.env.REDIS_URL || 'redis://localhost:6379',
      ttl: 60,
    }),
  ],
  exports: [CacheModule],
})
export class RedisModule { }