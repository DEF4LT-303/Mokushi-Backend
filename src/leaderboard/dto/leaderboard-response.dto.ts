import { ApiProperty } from '@nestjs/swagger';
import { LeaderboardCategoryDto } from './leaderboard-category.dto';

export class LeaderboardResponseDto {
  @ApiProperty({
    description: 'Global Program leaderboard',
    type: LeaderboardCategoryDto,
  })
  'Global Program': LeaderboardCategoryDto;

  @ApiProperty({
    description: 'Grammar module leaderboard',
    type: LeaderboardCategoryDto,
  })
  Grammar!: LeaderboardCategoryDto;

  @ApiProperty({
    description: 'Vocabulary module leaderboard',
    type: LeaderboardCategoryDto,
  })
  Vocabulary!: LeaderboardCategoryDto;

  @ApiProperty({
    description: 'Listening module leaderboard',
    type: LeaderboardCategoryDto,
  })
  Listening!: LeaderboardCategoryDto;
}
