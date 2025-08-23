import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { CreateModuleDto } from './dto/create-module.dto';
import { UpdateModuleDto } from './dto/update-module.dto';

@Injectable()
export class ModuleService {
  constructor(private readonly databaseService: DatabaseService) { }

  async create(createModuleDto: CreateModuleDto) {
    return this.databaseService.module.create({ data: createModuleDto });
  }

  findAll() {
    return this.databaseService.module.findMany();
  }

  async findOne(id: string) {
    const module = await this.databaseService.module.findUnique({ where: { id } });
    if (!module) {
      throw new NotFoundException(`Module with id '${id}' not found`);
    }
    return module;
  }

  async update(id: string, updateModuleDto: UpdateModuleDto) {
    const existing = await this.databaseService.module.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Module with id '${id}' not found`);
    }
    return this.databaseService.module.update({ where: { id }, data: updateModuleDto });
  }

  async remove(id: string) {
    const existing = await this.databaseService.module.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Module with id '${id}' not found`);
    }
    return this.databaseService.module.delete({ where: { id } });
  }
}
