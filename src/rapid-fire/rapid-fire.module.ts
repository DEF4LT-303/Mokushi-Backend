import { Module } from '@nestjs/common';
import { CacheService } from 'src/common/services/cache.service';
import { DatabaseModule } from 'src/database/database.module';
import { RapidFireController } from './rapid-fire.controller';
import { RapidFireService } from './rapid-fire.service';

@Module({
  imports: [DatabaseModule],
  controllers: [RapidFireController],
  providers: [RapidFireService, CacheService],
})
export class RapidFireModule { }
