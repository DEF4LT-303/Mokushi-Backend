import { Body, Controller, Delete, Get, Param, Patch, Post, Query, ValidationPipe } from '@nestjs/common';
import { ApiBody, ApiCreatedResponse, ApiForbiddenResponse, ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiQuery, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { CreateQuestionDto } from './dto/create-question.dto';
import { UpdateQuestionDto } from './dto/update-question.dto';
import { QuestionsService } from './questions.service';

@ApiTags('Questions')
@Controller('questions')
export class QuestionsController {
  constructor(private readonly questionsService: QuestionsService) { }

  @Post()
  @ApiOperation({ summary: 'Create a new question' })
  @ApiCreatedResponse({ description: 'Question created successfully' })
  @ApiBody({ type: CreateQuestionDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  create(@Body(ValidationPipe) createQuestionDto: CreateQuestionDto) {
    return this.questionsService.create(createQuestionDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get questions with optional filters' })
  @ApiOkResponse({ description: 'List of questions' })
  @ApiQuery({ name: 'moduleId', required: false })
  @ApiQuery({ name: 'type', required: false, enum: ['MULTIPLE_CHOICE', 'TRUE_FALSE', 'FILL_IN_THE_BLANK'] })
  @ApiQuery({ name: 'lessonType', required: false, enum: ['Grammar', 'Vocabulary', 'Kanji'] })
  @ApiQuery({ name: 'skip', required: false })
  @ApiQuery({ name: 'take', required: false })
  findMany(
    @Query('moduleId') moduleId?: string,
    @Query('type') type?: string,
    @Query('lessonType') lessonType?: string,
    @Query('skip') skip?: string,
    @Query('take') take?: string,
  ) {
    return this.questionsService.findMany({
      moduleId,
      type,
      lessonType,
      skip: skip ? Number(skip) : undefined,
      take: take ? Number(take) : undefined,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a question by ID' })
  @ApiOkResponse({ description: 'Question fetched successfully' })
  @ApiNotFoundResponse({ description: 'Question not found' })
  findOne(@Param('id') id: string) {
    return this.questionsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a question by ID' })
  @ApiOkResponse({ description: 'Question updated successfully' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiNotFoundResponse({ description: 'Question not found' })
  update(@Param('id') id: string, @Body(ValidationPipe) updateQuestionDto: UpdateQuestionDto) {
    return this.questionsService.update(id, updateQuestionDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a question by ID' })
  @ApiOkResponse({ description: 'Question deleted successfully' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiNotFoundResponse({ description: 'Question not found' })
  remove(@Param('id') id: string) {
    return this.questionsService.remove(id);
  }
}


