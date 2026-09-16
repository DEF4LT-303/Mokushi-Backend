import { Test, TestingModule } from '@nestjs/testing';
import { UserAttemptsService } from './user-attempts.service';
import { DatabaseService } from 'src/database/database.service';
import { LeaderboardService } from 'src/leaderboard/leaderboard.service';
import { NotFoundException } from '@nestjs/common';

describe('UserAttemptsService', () => {
  let service: UserAttemptsService;
  let databaseService: any;
  let leaderboardService: any;

  beforeEach(async () => {
    databaseService = {
      userAttempt: {
        create: jest.fn(),
        update: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
      userAnswer: {
        createMany: jest.fn(),
        findMany: jest.fn(),
        deleteMany: jest.fn(),
      },
      quizQuestion: {
        count: jest.fn(),
        findMany: jest.fn(),
      },
      $transaction: jest.fn().mockImplementation((val) => {
        if (typeof val === 'function') {
          return val(databaseService);
        }
        return val;
      }),
    };

    leaderboardService = {
      onAttemptCompleted: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserAttemptsService,
        {
          provide: DatabaseService,
          useValue: databaseService,
        },
        {
          provide: LeaderboardService,
          useValue: leaderboardService,
        },
      ],
    }).compile();

    service = module.get<UserAttemptsService>(UserAttemptsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createAttempt', () => {
    it('should create a new attempt with score 0 and completed false', async () => {
      const dto: any = { userId: 'user-1', quizId: 'quiz-1' };
      databaseService.userAttempt.create.mockResolvedValue({ id: 'att-1', ...dto, score: 0, completed: false });

      const result = await service.createAttempt(dto);
      expect(result.score).toBe(0);
      expect(result.completed).toBe(false);
    });
  });

  describe('submitQuizAnswers', () => {
    it('should throw NotFoundException if attempt is not found', async () => {
      databaseService.userAttempt.findUnique.mockResolvedValue(null);
      await expect(service.submitQuizAnswers('invalid-att', [])).rejects.toThrow(NotFoundException);
    });
  });
});
