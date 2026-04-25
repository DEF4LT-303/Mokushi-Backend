import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { OptionalJwtGuard } from 'src/auth/guards/optional-jwt.guard';
import { LeaderboardEntryDto } from './dto/leaderboard-entry.dto';
import { LeaderboardResponseDto } from './dto/leaderboard-response.dto';
import { LeaderboardService } from './leaderboard.service';

@ApiTags('Leaderboard')
@Controller('leaderboard')
export class LeaderboardController {
  constructor(private readonly leaderboardService: LeaderboardService) { }

  @Get('global/average')
  @UseGuards(OptionalJwtGuard)
  @ApiOperation({ summary: 'Get categorized leaderboard with global and module-specific rankings' })
  @ApiQuery({
    name: 'jlptLevel',
    required: false,
    enum: ['N4', 'N5'],
    description: 'Filter by JLPT level (N4 or N5)',
  })
  @ApiOkResponse({
    description: 'Categorized leaderboard with Global Program, Grammar, Vocabulary, and Listening rankings',
    type: LeaderboardResponseDto,
  })
  getGlobalAverage(
    @CurrentUser() user?: any,
    @Query('jlptLevel') jlptLevel?: string,
  ) {
    const userId = user?.id || user?.sub;
    return this.leaderboardService.getCategorizedLeaderboard(userId, jlptLevel);
  }

  @Get('module/:moduleId/average')
  @UseGuards(OptionalJwtGuard)
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
  getModuleAverage(
    @Param('moduleId') moduleId: string,
    @CurrentUser() user?: any,
  ) {
    const userId = user?.id || user?.sub;
    return this.leaderboardService.getModuleLeaderboard(moduleId, userId);
  }
}