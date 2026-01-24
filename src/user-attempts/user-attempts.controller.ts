import { Body, Controller, Param, Patch, Post } from '@nestjs/common';
import { ApiBadRequestResponse, ApiBearerAuth, ApiBody, ApiCreatedResponse, ApiForbiddenResponse, ApiOkResponse, ApiOperation, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { CreateUserAnswerDto } from './dto/create-user-answer.dto';
import { CreateUserAttemptDto } from './dto/create-user-attempt.dto';
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
}
