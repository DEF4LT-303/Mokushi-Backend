import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiCreatedResponse, ApiForbiddenResponse, ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { JwtGuard } from 'src/auth/guards/jwt.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { CreateGrammarRuleDto } from 'src/module/dto/create-grammar-rule.dto';
import { CreateLessonDto } from 'src/module/dto/create-lesson.dto';
import { UpdateGrammarRuleDto } from 'src/module/dto/update-grammar-rule.dto';
import { UpdateLessonDto } from 'src/module/dto/update-lesson.dto';
import { LessonsService } from './lessons.service';

@ApiTags('Lessons')
@Controller('lessons')
export class LessonsController {
  constructor(private readonly lessonsService: LessonsService) { }

  @Get()
  @ApiOperation({ summary: 'Get all lessons with their grammar rules' })
  @ApiOkResponse({ description: 'List of all lessons and their grammar rules' })
  getAllLessonsWithRules() {
    return this.lessonsService.getAllLessonsWithRules();
  }

  @Get('modules/:moduleId')
  @ApiOperation({ summary: 'Get all lessons for a module' })
  @ApiOkResponse({ description: 'List of lessons for the module' })
  @ApiNotFoundResponse({ description: 'Module not found' })
  getLessonsByModule(@Param('moduleId') moduleId: string) {
    return this.lessonsService.getLessonsByModule(moduleId);
  }

  @UseGuards(JwtGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Post('modules/:moduleId')
  @ApiOperation({ summary: 'Create a lesson for a module' })
  @ApiCreatedResponse({ description: 'Lesson created successfully' })
  @ApiBody({ type: CreateLessonDto })
  @ApiBearerAuth()
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiNotFoundResponse({ description: 'Module not found' })
  createLesson(
    @Param('moduleId') moduleId: string,
    @Body() createLessonDto: CreateLessonDto,
  ) {
    return this.lessonsService.createLesson(moduleId, createLessonDto);
  }

  @Get(':lessonId')
  @ApiOperation({ summary: 'Get a lesson by ID' })
  @ApiOkResponse({ description: 'Lesson fetched successfully' })
  @ApiNotFoundResponse({ description: 'Lesson not found' })
  getLessonById(@Param('lessonId') lessonId: string) {
    return this.lessonsService.getLessonById(lessonId);
  }

  @UseGuards(JwtGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Patch(':lessonId')
  @ApiOperation({ summary: 'Update a lesson by ID' })
  @ApiOkResponse({ description: 'Lesson updated successfully' })
  @ApiBody({ type: UpdateLessonDto })
  @ApiBearerAuth()
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiNotFoundResponse({ description: 'Lesson not found' })
  updateLesson(
    @Param('lessonId') lessonId: string,
    @Body() updateLessonDto: UpdateLessonDto,
  ) {
    return this.lessonsService.updateLesson(lessonId, updateLessonDto);
  }

  @UseGuards(JwtGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Delete(':lessonId')
  @ApiOperation({ summary: 'Delete a lesson by ID' })
  @ApiOkResponse({ description: 'Lesson deleted successfully' })
  @ApiBearerAuth()
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiNotFoundResponse({ description: 'Lesson not found' })
  deleteLesson(@Param('lessonId') lessonId: string) {
    return this.lessonsService.deleteLesson(lessonId);
  }

  @Get(':lessonId/rules')
  @ApiOperation({ summary: 'Get all grammar rules for a lesson' })
  @ApiOkResponse({ description: 'List of grammar rules for the lesson' })
  @ApiNotFoundResponse({ description: 'Lesson not found' })
  getRulesByLesson(@Param('lessonId') lessonId: string) {
    return this.lessonsService.getRulesByLesson(lessonId);
  }

  @UseGuards(JwtGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Post(':lessonId/rules')
  @ApiOperation({ summary: 'Create a grammar rule for a lesson' })
  @ApiCreatedResponse({ description: 'Grammar rule created successfully' })
  @ApiBody({ type: CreateGrammarRuleDto })
  @ApiBearerAuth()
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiNotFoundResponse({ description: 'Lesson not found' })
  createRule(
    @Param('lessonId') lessonId: string,
    @Body() createGrammarRuleDto: CreateGrammarRuleDto,
  ) {
    return this.lessonsService.createRule(lessonId, createGrammarRuleDto);
  }

  @Get('rules/:ruleId')
  @ApiOperation({ summary: 'Get a grammar rule by ID' })
  @ApiOkResponse({ description: 'Grammar rule fetched successfully' })
  @ApiNotFoundResponse({ description: 'Grammar rule not found' })
  getRuleById(@Param('ruleId') ruleId: string) {
    return this.lessonsService.getRuleById(ruleId);
  }

  @UseGuards(JwtGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Patch('rules/:ruleId')
  @ApiOperation({ summary: 'Update a grammar rule by ID' })
  @ApiOkResponse({ description: 'Grammar rule updated successfully' })
  @ApiBody({ type: UpdateGrammarRuleDto })
  @ApiBearerAuth()
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiNotFoundResponse({ description: 'Grammar rule not found' })
  updateRule(
    @Param('ruleId') ruleId: string,
    @Body() updateGrammarRuleDto: UpdateGrammarRuleDto,
  ) {
    return this.lessonsService.updateRule(ruleId, updateGrammarRuleDto);
  }

  @UseGuards(JwtGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Delete('rules/:ruleId')
  @ApiOperation({ summary: 'Delete a grammar rule by ID' })
  @ApiOkResponse({ description: 'Grammar rule deleted successfully' })
  @ApiBearerAuth()
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiNotFoundResponse({ description: 'Grammar rule not found' })
  deleteRule(@Param('ruleId') ruleId: string) {
    return this.lessonsService.deleteRule(ruleId);
  }
}
