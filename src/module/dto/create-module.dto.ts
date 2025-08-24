import { JlptLevel, ModuleType } from '@prisma/client';
import { IsEnum, IsString } from 'class-validator';

export class CreateModuleDto {
  @IsString()
  slug: string;

  @IsString()
  name: string;

  @IsString()
  description: string;

  @IsEnum(JlptLevel)
  jlptLevel: JlptLevel;

  @IsEnum(ModuleType)
  type: ModuleType;
}
