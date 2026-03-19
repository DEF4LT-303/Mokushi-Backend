import { Controller, Get, Param } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { LeaderboardEntryDto } from './dto/leaderboard-entry.dto';
import { LeaderboardService } from './leaderboard.service';

@ApiTags('Leaderboard')
@Controller('leaderboard')
export class LeaderboardController {
  constructor(private readonly leaderboardService: LeaderboardService) { }

  @Get('global/average')
  @ApiOperation({ summary: 'Get global average leaderboard' })
  @ApiOkResponse({
    description: 'Top users ranked by average score globally',
    type: [LeaderboardEntryDto],
  })
  getGlobalAverage() {
    return this.leaderboardService.getGlobalAverageLeaderboard();
  }

  @Get('module/:moduleId/average')
  @ApiOperation({ summary: 'Get module-specific average leaderboard' })
  @ApiParam({
    name: 'moduleId',
    type: String,
    description: 'Module ID to fetch leaderboard for',
    example: 'module123',
  })
  @ApiOkResponse({
    description: 'Top users ranked by average score for a specific module',
    type: [LeaderboardEntryDto],
  })
  getModuleAverage(@Param('moduleId') moduleId: string) {
    return this.leaderboardService.getModuleAverageLeaderboard(moduleId);
  }
}