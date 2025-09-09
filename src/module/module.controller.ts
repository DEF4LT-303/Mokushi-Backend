
import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBody, ApiCreatedResponse, ApiForbiddenResponse, ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { CreateModuleDto } from './dto/create-module.dto';
import { UpdateModuleDto } from './dto/update-module.dto';
import { ModuleService } from './module.service';

@ApiTags('Modules')
@Controller('modules')
export class ModuleController {
  constructor(private readonly moduleService: ModuleService) { }


  @UseGuards(AuthGuard('jwt'))
  @Post()
  @ApiOperation({ summary: 'Create a new module' })
  @ApiCreatedResponse({ description: 'Module created successfully' })
  @ApiBody({ type: CreateModuleDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  create(@Body() createModuleDto: CreateModuleDto) {
    return this.moduleService.create(createModuleDto);
  }


  @Get()
  @ApiOperation({ summary: 'Get all modules' })
  @ApiOkResponse({ description: 'List of modules' })
  findAll() {
    return this.moduleService.findAll();
  }


  @Get(':id')
  @ApiOperation({ summary: 'Get a module by ID' })
  @ApiOkResponse({ description: 'Module fetched successfully' })
  @ApiNotFoundResponse({ description: 'Module not found' })
  findOne(@Param('id') id: string) {
    return this.moduleService.findOne(id);
  }


  @UseGuards(AuthGuard('jwt'))
  @Patch(':id')
  @ApiOperation({ summary: 'Update a module by ID' })
  @ApiOkResponse({ description: 'Module updated successfully' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiNotFoundResponse({ description: 'Module not found' })
  update(@Param('id') id: string, @Body() updateModuleDto: UpdateModuleDto) {
    return this.moduleService.update(id, updateModuleDto);
  }


  @UseGuards(AuthGuard('jwt'))
  @Delete(':id')
  @ApiOperation({ summary: 'Delete a module by ID' })
  @ApiOkResponse({ description: 'Module deleted successfully' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiNotFoundResponse({ description: 'Module not found' })
  remove(@Param('id') id: string) {
    return this.moduleService.remove(id);
  }
}
