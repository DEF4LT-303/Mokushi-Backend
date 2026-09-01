import { Test, TestingModule } from '@nestjs/testing';
import { DatabaseService } from '../database/database.service';
import { QuestionsService } from './questions.service';

describe('QuestionsService', () => {
  let service: QuestionsService;
  let databaseService: any;

  beforeEach(async () => {
    databaseService = {
      question: {
        create: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        deleteMany: jest.fn(),
      },
      lesson: {
        findUnique: jest.fn(),
      },
      module: {
        findUnique: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QuestionsService,
        {
          provide: DatabaseService,
          useValue: databaseService,
        },
      ],
    }).compile();

    service = module.get<QuestionsService>(QuestionsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a question', async () => {
      const dto: any = { content: 'test question', options: [], correctAnswer: 'A', questionType: 'GRAMMAR', moduleId: 'mod-1' };
      databaseService.question.create.mockResolvedValue(dto);

      const result = await service.create(dto);
      expect(result).toEqual(dto);
      expect(databaseService.question.create).toHaveBeenCalledWith({ data: dto });
    });
  });

  describe('findMany', () => {
    it('should find questions with filters and resolve lessonId if specified', async () => {
      databaseService.lesson.findUnique.mockResolvedValue({ id: 'les-1', moduleId: 'mod-1' });
      databaseService.question.findMany.mockResolvedValue([]);
      databaseService.question.count.mockResolvedValue(0);

      const result = await service.findMany({ lessonId: 'les-1' });
      expect(result).toEqual({ count: 0, data: [] });
      expect(databaseService.lesson.findUnique).toHaveBeenCalledWith({
        where: { id: 'les-1' },
        select: { moduleId: true },
      });
    });
  });
});
