
import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiCreatedResponse, ApiForbiddenResponse, ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiQuery, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { JwtGuard } from 'src/auth/guards/jwt.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { CreateModuleDto } from './dto/create-module.dto';
import { UpdateModuleDto } from './dto/update-module.dto';
import { ModuleService } from './module.service';

@ApiTags('Modules')
@Controller('modules')
export class ModuleController {
  constructor(private readonly moduleService: ModuleService) { }


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


  @Get(':id')
  @ApiOperation({ summary: 'Get a module by ID' })
  @ApiOkResponse({ description: 'Module fetched successfully' })
  @ApiNotFoundResponse({ description: 'Module not found' })
  findOne(@Param('id') id: string) {
    return this.moduleService.findOne(id);
  }

  @Get(':id/quiz')
  @ApiOperation({ summary: 'Get a quiz for a module with its questions' })
  @ApiOkResponse({ description: 'Quiz for the module with ordered questions' })
  @ApiNotFoundResponse({ description: 'Module not found' })
  @ApiQuery({
    name: 'numQuestions',
    required: false,
    type: Number,
    description: 'Number of random questions to include in the quiz (default: 10)',
    example: 10,
  })
  getModuleQuiz(
    @Param('id') id: string,
    @Query('numQuestions') numQuestions?: string
  ) {
    const num = numQuestions ? parseInt(numQuestions, 10) : undefined;
    return this.moduleService.getQuizByModule(id, num);
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
