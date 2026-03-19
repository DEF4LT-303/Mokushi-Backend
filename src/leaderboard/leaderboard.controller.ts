import { Controller, Get, Param } from '@nestjs/common';
import { ApiBody, ApiOkResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { LeaderboardEntryDto } from './dto/leaderboard-entry.dto';
import { LeaderboardService } from './leaderboard.service';

@ApiTags('Leaderboard')
@Controller('leaderboard')
export class LeaderboardController {
  constructor(private readonly leaderboardService: LeaderboardService) { }

  @Get('global/average')
  @ApiOperation({ summary: 'Get global average leaderboard' })
  @ApiBody({ type: [LeaderboardEntryDto] })
  @ApiOkResponse({ description: 'List of leaderboard entries with average scores' })
  getGlobalAverage() {
    return this.leaderboardService.getGlobalAverageLeaderboard();
  }

  @Get('module/:moduleId/average')
  @ApiOperation({ summary: 'Get module-specific average leaderboard' })
  @ApiBody({ type: [LeaderboardEntryDto] })
  @ApiOkResponse({ description: 'List of leaderboard entries for the module with average scores' })
  @ApiParam({
    name: 'moduleId',
    type: String,
    description: 'Module ID to fetch leaderboard for',
    example: 'module123',
  })
  getModuleAverage(@Param('moduleId') moduleId: string) {
    return this.leaderboardService.getModuleAverageLeaderboard(moduleId);
  }
}