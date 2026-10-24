import { Test, TestingModule } from "@nestjs/testing";
import { ModuleController } from "./module.controller";
import { ModuleService } from "./module.service";
import { DatabaseService } from "src/database/database.service";
import { UserAttemptsService } from "src/user-attempts/user-attempts.service";

describe("ModuleController", () => {
  let controller: ModuleController;
  let userAttemptsService: any;

  beforeEach(async () => {
    userAttemptsService = {
      cancelAttempt: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ModuleController],
      providers: [
        {
          provide: ModuleService,
          useValue: {},
        },
        {
          provide: DatabaseService,
          useValue: {},
        },
        {
          provide: UserAttemptsService,
          useValue: userAttemptsService,
        },
      ],
    }).compile();

    controller = module.get<ModuleController>(ModuleController);
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
  });

  describe("cancelQuiz", () => {
    it("should call userAttemptsService.cancelAttempt and return the result", async () => {
      const mockUser = { id: "user-1" };
      const dto = { userAttemptId: "att-1" };
      const expectedResult = {
        success: true,
        message: "Quiz attempt cancelled successfully",
      };

      userAttemptsService.cancelAttempt.mockResolvedValue(expectedResult);

      const result = await controller.cancelQuiz(mockUser, dto);

      expect(userAttemptsService.cancelAttempt).toHaveBeenCalledWith(
        "att-1",
        "user-1",
      );
      expect(result).toEqual(expectedResult);
    });
  });
});
