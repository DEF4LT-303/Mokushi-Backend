import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DatabaseService } from '../database/database.service';
import { LessonsService } from './lessons.service';

describe('LessonsService', () => {
  let service: LessonsService;
  let databaseService: any;

  beforeEach(async () => {
    databaseService = {
      lesson: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      module: {
        findUnique: jest.fn(),
      },
      grammarRule: {
        findMany: jest.fn(),
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LessonsService,
        {
          provide: DatabaseService,
          useValue: databaseService,
        },
      ],
    }).compile();

    service = module.get<LessonsService>(LessonsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getLessonsByModule', () => {
    it('should throw NotFoundException if module does not exist', async () => {
      databaseService.module.findUnique.mockResolvedValue(null);
      await expect(service.getLessonsByModule('invalid-module')).rejects.toThrow(NotFoundException);
    });

    it('should return lessons for a valid module', async () => {
      const mockModule = { id: 'mod-1', name: 'Test Module', lessons: [{ id: 'les-1', title: 'Lesson 1' }] };
      databaseService.module.findUnique.mockResolvedValue(mockModule);

      const result = await service.getLessonsByModule('mod-1');
      expect(result).toEqual(mockModule.lessons);
    });
  });

  describe('getRulesByLesson', () => {
    it('should throw NotFoundException if lesson does not exist', async () => {
      databaseService.lesson.findUnique.mockResolvedValue(null);
      await expect(service.getRulesByLesson('invalid-lesson')).rejects.toThrow(NotFoundException);
    });

    it('should return rules for a valid lesson', async () => {
      const mockLesson = { id: 'les-1', title: 'Lesson 1', grammarRules: [{ id: 'rule-1', englishTitle: 'Rule 1' }] };
      databaseService.lesson.findUnique.mockResolvedValue(mockLesson);

      const result = await service.getRulesByLesson('les-1');
      expect(result).toEqual(mockLesson.grammarRules);
    });
  });
});
