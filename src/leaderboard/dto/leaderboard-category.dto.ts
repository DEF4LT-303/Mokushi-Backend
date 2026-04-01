import { ApiProperty } from '@nestjs/swagger';
import { LeaderboardEntryDto } from './leaderboard-entry.dto';

export class UserRankDto extends LeaderboardEntryDto {
  @ApiProperty({ description: 'User rank in this leaderboard', example: 15 })
  rank!: number;
}

export class LeaderboardCategoryDto {
  @ApiProperty({
    description: 'Top 10 entries in this leaderboard',
    type: [LeaderboardEntryDto],
  })
  top10!: LeaderboardEntryDto[];

  @ApiProperty({
    description: 'Current user rank and details',
    type: UserRankDto,
    nullable: true,
  })
  currentUserRank?: UserRankDto | null;
}
