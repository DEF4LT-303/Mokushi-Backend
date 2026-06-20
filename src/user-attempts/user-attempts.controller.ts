import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBadRequestResponse, ApiBearerAuth, ApiBody, ApiCreatedResponse, ApiForbiddenResponse, ApiOkResponse, ApiOperation, ApiQuery, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { JwtGuard } from 'src/auth/guards/jwt.guard';
import { CreateUserAnswerDto } from './dto/create-user-answer.dto';
import { CreateUserAttemptDto } from './dto/create-user-attempt.dto';
import { QuizHistoryDetailedDto } from './dto/quiz-history-detailed.dto';
import { QuizHistoryTableItemDto } from './dto/quiz-history-table-item.dto';
import { UpdateUserAttemptDto } from './dto/update-user-attempt.dto';
import { UserAttemptsService } from './user-attempts.service';

@ApiTags('UserAttempts')
@Controller('user-attempt')
export class UserAttemptsController {
  constructor(private readonly userAttemptsService: UserAttemptsService) { }

  @Post()
  @ApiOperation({ summary: 'Start a user quiz attempt. [Called on /api/modules/{id}/quiz automatically]' })
  @ApiBearerAuth()
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiBody({ type: CreateUserAttemptDto })
  @ApiCreatedResponse({ description: 'User attempt created' })
  createAttempt(@Body() dto: CreateUserAttemptDto) {
    return this.userAttemptsService.createAttempt(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update user attempt score/status' })
  @ApiBody({ type: UpdateUserAttemptDto })
  @ApiOkResponse({ description: 'User attempt updated' })
  updateAttempt(@Param('id') id: string, @Body() dto: UpdateUserAttemptDto) {
    return this.userAttemptsService.updateAttempt(id, dto);
  }

  @Post(':id/user-answer')
  @ApiOperation({ summary: 'Submit answers for a user attempt (bulk). [Called on /api/modules/quiz/submit automatically]' })
  @ApiBearerAuth()
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiBody({ type: [CreateUserAnswerDto] })
  @ApiOkResponse({ description: 'User answers submitted' })
  @ApiBadRequestResponse({ description: 'Invalid payload or quiz question id' })
  submitAnswers(@Param('id') id: string, @Body() answers: CreateUserAnswerDto[]) {
    return this.userAttemptsService.createUserAnswers(id, answers);
  }

  @Post(':id/score')
  @ApiOperation({ summary: 'Calculate and update the score for this attempt' })
  @ApiBearerAuth()
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiOkResponse({ description: 'Score calculated and updated' })
  async scoreAttempt(@Param('id') id: string) {
    return { score: await this.userAttemptsService.calculateScore(id) };
  }

  @Get('history')
  @UseGuards(JwtGuard)
  @ApiOperation({ summary: 'Get quiz history for current user with pagination and category filtering' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Number of records to fetch', example: 20 })
  @ApiQuery({ name: 'skip', required: false, type: Number, description: 'Number of records to skip for pagination', example: 0 })
  @ApiQuery({ name: 'categoryType', required: false, enum: ['GRAMMAR', 'VOCABULARY', 'LISTENING'] })
  @ApiBearerAuth()
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiOkResponse({ type: [QuizHistoryTableItemDto], description: 'List of quiz attempts' })
  async getQuizHistory(
    @CurrentUser() user: any,
    @Query('limit') limit?: string,
    @Query('skip') skip?: string,
    @Query('categoryType') categoryType?: string,
  ) {
    const userId = user?.id || user?.sub;
    const limitNum = limit ? Math.min(Math.max(parseInt(limit, 10), 1), 100) : undefined;
    const offsetNum = skip ? Math.max(parseInt(skip, 10), 0) : undefined;
    return this.userAttemptsService.getQuizHistory(userId, limitNum, offsetNum, categoryType);
  }

  @Get(':id/detail')
  @UseGuards(JwtGuard)
  @ApiOperation({ summary: 'Get detailed quiz history for a specific attempt' })
  @ApiBearerAuth()
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiOkResponse({ type: QuizHistoryDetailedDto, description: 'Detailed quiz history' })
  async getQuizHistoryDetail(@Param('id') id: string) {
    return this.userAttemptsService.getQuizHistoryDetail(id);
  }
}
