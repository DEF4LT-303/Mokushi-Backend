import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiQuery, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { JlptLevel } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtGuard } from '../auth/guards/jwt.guard';
import { RapidFireLessonOverviewDto } from './dto/lesson-detail.dto';
import { SubmitRapidFireAnswersResponseDto } from './dto/rapid-fire-answer-response.dto';
import { SubmitRapidFireAnswersDto } from './dto/rapid-fire-answer.dto';
import { RapidFireService } from './rapid-fire.service';

@ApiTags('RapidFire')
@Controller('rapid-fire')
export class RapidFireController {
  constructor(private readonly rapidFireService: RapidFireService) { }

  @UseGuards(JwtGuard)
  @Get('stats')
  @ApiOperation({ summary: 'Get overall rapid-fire stats and lesson stats for the current user' })
  @ApiBearerAuth()
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiQuery({ name: 'jlptLevel', required: false, enum: JlptLevel })
  async getCombinedStats(@CurrentUser() user: any, @Query('jlptLevel') jlptLevel?: JlptLevel) {
    return this.rapidFireService.getCombinedStats(user.id, jlptLevel);
  }

  @UseGuards(JwtGuard)
  @Get('start/:lessonId')
  @ApiOperation({ summary: 'Start a rapid-fire quiz and return the lesson words' })
  @ApiBearerAuth()
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiOkResponse({ type: RapidFireLessonOverviewDto })
  async startQuiz(@CurrentUser() user: any, @Param('lessonId') lessonId: string) {
    return this.rapidFireService.getLessonDetail(user.id, lessonId);
  }

  @UseGuards(JwtGuard)
  @Post('submit/:lessonId')
  @ApiOperation({ summary: 'Submit rapid-fire answers for a lesson and update stats' })
  @ApiBearerAuth()
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiOkResponse({ type: SubmitRapidFireAnswersResponseDto })
  async submitAnswers(
    @CurrentUser() user: any,
    @Param('lessonId') lessonId: string,
    @Body() body: SubmitRapidFireAnswersDto,
  ) {
    return this.rapidFireService.submitAnswers(user.id, lessonId, body);
  }
}