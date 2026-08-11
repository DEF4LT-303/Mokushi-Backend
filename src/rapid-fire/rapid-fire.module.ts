import { Module } from '@nestjs/common';
import { DatabaseModule } from 'src/database/database.module';
import { RapidFireController } from './rapid-fire.controller';
import { RapidFireService } from './rapid-fire.service';

@Module({
  imports: [DatabaseModule],
  controllers: [RapidFireController],
  providers: [RapidFireService],
})
export class RapidFireModule { }
