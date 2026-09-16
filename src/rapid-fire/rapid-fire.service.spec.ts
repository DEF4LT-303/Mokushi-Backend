import { Test, TestingModule } from '@nestjs/testing';
import { RapidFireService } from './rapid-fire.service';
import { DatabaseService } from 'src/database/database.service';
import { CacheService } from 'src/common/services/cache.service';

describe('RapidFireService', () => {
  let service: RapidFireService;
  let databaseService: any;
  let cacheService: any;

  beforeEach(async () => {
    databaseService = {
      rapidFireLesson: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
      },
      rapidFireLessonStat: {
        findMany: jest.fn(),
        update: jest.fn(),
      },
      rapidFireOverallStat: {
        upsert: jest.fn(),
        update: jest.fn(),
      },
      hardWord: {
        findMany: jest.fn(),
        createMany: jest.fn(),
        deleteMany: jest.fn(),
      },
      $transaction: jest.fn().mockImplementation((val) => val),
    };

    cacheService = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RapidFireService,
        {
          provide: DatabaseService,
          useValue: databaseService,
        },
        {
          provide: CacheService,
          useValue: cacheService,
        },
      ],
    }).compile();

    service = module.get<RapidFireService>(RapidFireService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getCombinedStats', () => {
    it('should fetch stats from database if not cached', async () => {
      const mockOverall = { id: 'overall-1', userId: 'user-1', jlptLevel: 'N5' };
      databaseService.rapidFireOverallStat.upsert.mockResolvedValue(mockOverall);
      databaseService.rapidFireLesson.findMany.mockResolvedValue([]);
      databaseService.rapidFireLessonStat.findMany.mockResolvedValue([]);
      databaseService.hardWord.findMany.mockResolvedValue([]);

      const result = await service.getCombinedStats('user-1', 'N5');
      expect(result).toBeDefined();
      expect(cacheService.get).toHaveBeenCalled();
      expect(cacheService.set).toHaveBeenCalled();
    });
  });
});
