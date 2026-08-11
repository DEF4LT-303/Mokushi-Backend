import { ApiProperty } from '@nestjs/swagger';

export class RapidFireWordDto {
  @ApiProperty({ description: 'Rapid fire word ID' })
  id!: string;

  @ApiProperty({ description: 'Japanese word' })
  word!: string;

  @ApiProperty({ description: 'Japanese reading' })
  reading!: string;

  @ApiProperty({ description: 'Romaji reading' })
  romaji!: string;

  @ApiProperty({ description: 'English meaning' })
  meaning!: string;
}
