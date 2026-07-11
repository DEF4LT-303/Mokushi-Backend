import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DatabaseService } from 'src/database/database.service';
import { ModuleService } from './module.service';

describe('ModuleService', () => {
  let service: ModuleService;
  let databaseService: any;

  beforeEach(async () => {
    const mockDatabaseService = {
      lesson: {
        findUnique: jest.fn(),
      },
      grammarRule: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ModuleService,
        { provide: DatabaseService, useValue: mockDatabaseService },
      ],
    }).compile();

    service = module.get<ModuleService>(ModuleService);
    databaseService = module.get(DatabaseService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should throw when creating a rule for a missing lesson', async () => {
    databaseService.lesson.findUnique.mockResolvedValue(null);

    await expect(
      service.createRule('missing-lesson', {
        japanese: '日本語',
        englishTitle: 'Japanese',
        description: 'Example rule',
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('should create nested examples when examples are provided in the same request body', async () => {
    databaseService.lesson.findUnique.mockResolvedValue({ id: 'lesson-1' });
    databaseService.grammarRule.create.mockResolvedValue({ id: 'rule-1' });

    await service.createRule('lesson-1', {
      japanese: '日本語',
      englishTitle: 'Japanese',
      description: 'Example rule',
      examples: [
        {
          japaneseSentence: '日本語です。',
          englishTranslation: 'This is Japanese.',
        },
      ],
    } as any);

    expect(databaseService.grammarRule.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          lessonId: 'lesson-1',
          examples: {
            create: [
              {
                japaneseSentence: '日本語です。',
                englishTranslation: 'This is Japanese.',
              },
            ],
          },
        }),
      }),
    );
  });
});
