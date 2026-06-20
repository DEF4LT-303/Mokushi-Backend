
import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards, ValidationPipe } from '@nestjs/common';
import { ApiBadRequestResponse, ApiBearerAuth, ApiBody, ApiCreatedResponse, ApiForbiddenResponse, ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiQuery, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { JwtGuard } from 'src/auth/guards/jwt.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { SubmitQuizDto } from '../user-attempts/dto/submit-quiz.dto';
import { UserAttemptsService } from '../user-attempts/user-attempts.service';
import { CreateModuleDto } from './dto/create-module.dto';
import { CreateQuizConfigDto } from './dto/create-quiz-config.dto';
import { ModuleQuizResponseDto } from './dto/module-quiz-response.dto';
import { UpdateModuleDto } from './dto/update-module.dto';
import { ModuleService } from './module.service';

@ApiTags('Modules')
@Controller('modules')
export class ModuleController {
  constructor(
    private readonly moduleService: ModuleService,
    private readonly userAttemptsService: UserAttemptsService,
  ) { }


  @UseGuards(JwtGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Post()
  @ApiOperation({ summary: 'Create a new module' })
  @ApiCreatedResponse({ description: 'Module created successfully' })
  @ApiBody({ type: CreateModuleDto })
  @ApiBearerAuth()
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  create(@Body() createModuleDto: CreateModuleDto) {
    return this.moduleService.create(createModuleDto);
  }


  @Get()
  @ApiOperation({ summary: 'Get modules with optional filters' })
  @ApiOkResponse({ description: 'List of modules with total count' })
  @ApiQuery({ name: 'jlptLevel', required: false, enum: ['N4', 'N5'] })
  @ApiQuery({ name: 'categoryType', required: false, enum: ['GRAMMAR', 'VOCABULARY', 'LISTENING'] })
  @ApiQuery({ name: 'skip', required: false })
  @ApiQuery({ name: 'take', required: false })
  findMany(
    @Query('jlptLevel') jlptLevel?: string,
    @Query('categoryType') categoryType?: string,
    @Query('skip') skip?: string,
    @Query('take') take?: string,
  ) {
    return this.moduleService.findMany({
      jlptLevel,
      categoryType,
      skip: skip ? Number(skip) : undefined,
      take: take ? Number(take) : undefined,
    });
  }

  @Get('rules')
  @ApiOperation({ summary: 'Get all rules' })
  @ApiOkResponse({ description: 'List of all rules' })
  async fetchAllRules() {
    return this.moduleService.fetchAllRules();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a module by ID' })
  @ApiOkResponse({ description: 'Module fetched successfully' })
  @ApiNotFoundResponse({ description: 'Module not found' })
  findOne(@Param('id') id: string) {
    return this.moduleService.findOne(id);
  }

  @Get(':id/quiz-configs')
  @ApiOperation({ summary: 'Get all available quiz configurations for a module' })
  @ApiOkResponse({ description: 'List of quiz configurations' })
  @ApiNotFoundResponse({ description: 'Module not found' })
  async getQuizConfigs(@Param('id') id: string) {
    return this.moduleService.getQuizConfigsByModule(id);
  }

  @UseGuards(JwtGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Post(':id/quiz-configs')
  @ApiOperation({ summary: 'Create a new quiz configuration for a module (Admin only)' })
  @ApiCreatedResponse({ description: 'Quiz configuration created successfully' })
  @ApiBody({ type: CreateQuizConfigDto })
  @ApiBearerAuth()
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  async createQuizConfig(
    @Param('id') moduleId: string,
    @Body() createQuizConfigDto: CreateQuizConfigDto
  ) {
    return this.moduleService.createQuizConfig(moduleId, createQuizConfigDto);
  }

  @UseGuards(JwtGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Patch(':id/quiz-configs/:configId')
  @ApiOperation({ summary: 'Update a quiz configuration' })
  @ApiOkResponse({ description: 'Quiz configuration updated successfully' })
  @ApiBody({ type: CreateQuizConfigDto })
  @ApiBearerAuth()
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiNotFoundResponse({ description: 'Quiz config not found' })
  async updateQuizConfig(
    @Param('configId') configId: string,
    @Body() dto: CreateQuizConfigDto
  ) {
    return this.moduleService.updateQuizConfig(configId, dto);
  }

  @UseGuards(JwtGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Delete(':id/quiz-configs/:configId')
  @ApiOperation({ summary: 'Delete a quiz configuration' })
  @ApiOkResponse({ description: 'Quiz configuration deleted successfully' })
  @ApiBearerAuth()
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiNotFoundResponse({ description: 'Quiz config not found' })
  async deleteQuizConfig(
    @Param('configId') configId: string,
  ) {
    return this.moduleService.deleteQuizConfig(configId);
  }

  @UseGuards(JwtGuard)
  @Get(':id/quiz')
  @ApiOperation({ summary: 'Start a quiz for a module with selected configuration (creates a UserAttempt automatically)' })
  @ApiOkResponse({ description: 'Quiz started with questions and timing info', type: ModuleQuizResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid quiz config' })
  @ApiNotFoundResponse({ description: 'Module or quiz config not found' })
  @ApiQuery({ name: 'quizConfigId', required: true, type: String, description: 'ID of the quiz configuration to use' })
  async getModuleQuiz(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Query('quizConfigId') quizConfigId: string
  ) {
    const quiz = await this.moduleService.getQuizByModule(id, quizConfigId);
    // Automatically create a UserAttempt for this quiz for the current user
    const attempt = await this.userAttemptsService.createAttempt({
      userId: user.id,
      quizId: quiz.quiz.id
    });

    // Calculate deadline for frontend
    const startedAt = attempt.startedAt;
    const deadline = new Date(startedAt.getTime() + quiz.quiz.durationSec * 1000);

    return {
      userAttemptId: attempt.id,
      startedAt: startedAt.toISOString(),
      deadline: deadline.toISOString(),
      durationSec: quiz.quiz.durationSec,
      ...quiz
    };
  }

  @UseGuards(JwtGuard)
  @Post('/quiz/submit')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Submit quiz answers for a user attempt (this endpoint handles saving answers and calculating score)' })
  @ApiBody({ type: SubmitQuizDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiBadRequestResponse({ description: 'Missing or invalid payload' })
  @ApiOkResponse({ description: 'Quiz submitted successfully. Returns score.', schema: { example: { success: true, score: 8 } } })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  async submitQuiz(
    @CurrentUser() user: any,
    @Body(ValidationPipe) body: SubmitQuizDto
  ) {
    // (Optionally: verify attempt belongs to this user)
    const submission = await this.userAttemptsService.submitQuizAnswers(body.userAttemptId, body.answers);
    return { success: true, submission };
  }


  @UseGuards(JwtGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Patch(':id')
  @ApiOperation({ summary: 'Update a module by ID' })
  @ApiOkResponse({ description: 'Module updated successfully' })
  @ApiBearerAuth()
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiNotFoundResponse({ description: 'Module not found' })
  update(@Param('id') id: string, @Body() updateModuleDto: UpdateModuleDto) {
    return this.moduleService.update(id, updateModuleDto);
  }


  @UseGuards(JwtGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Delete(':id')
  @ApiOperation({ summary: 'Delete a module by ID' })
  @ApiOkResponse({ description: 'Module deleted successfully' })
  @ApiBearerAuth()
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiNotFoundResponse({ description: 'Module not found' })
  remove(@Param('id') id: string) {
    return this.moduleService.remove(id);
  }
}
