
import { ApiProperty } from '@nestjs/swagger';
import { JlptLevel, ModuleType } from '@prisma/client';
import { IsEnum, IsString } from 'class-validator';

export class CreateModuleDto {
  @ApiProperty({ description: 'Unique slug for the module' })
  @IsString()
  slug: string;

  @ApiProperty({ description: 'Name of the module' })
  @IsString()
  name: string;

  @ApiProperty({ description: 'Description of the module' })
  @IsString()
  description: string;

  @ApiProperty({ enum: JlptLevel, description: 'JLPT level for the module' })
  @IsEnum(JlptLevel)
  jlptLevel: JlptLevel;

  @ApiProperty({ enum: ModuleType, description: 'Type of the module' })
  @IsEnum(ModuleType)
  type: ModuleType;
}
