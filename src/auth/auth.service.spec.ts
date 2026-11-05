import { JwtService } from "@nestjs/jwt";
import { Test, TestingModule } from "@nestjs/testing";
import { PlanType, Role } from "@prisma/client";
import { SafeUser } from "prisma/safe-user.select";
import { DatabaseService } from "src/database/database.service";
import { UsersService } from "src/users/users.service";
import { AuthService } from "./auth.service";

describe("AuthService", () => {
  let service: AuthService;
  let databaseService: any;
  let jwtService: any;
  let usersService: any;

  const mockSafeUser: SafeUser = {
    id: "user-uuid-123",
    email: "test@mokushiken.com",
    fullName: "Mokushi Learner",
    firstName: "Mokushi",
    lastName: "Learner",
    picture: "https://example.com/avatar.jpg",
    role: Role.USER,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-02T00:00:00.000Z"),
    purchases: [
      {
        planType: PlanType.N5,
        purchasedAt: new Date("2026-01-03T00:00:00.000Z"),
      },
      {
        planType: PlanType.RAPID_FIRE_N5,
        purchasedAt: new Date("2026-01-04T00:00:00.000Z"),
      },
    ],
  };

  beforeEach(async () => {
    databaseService = {
      user: {
        findUnique: jest.fn(),
        update: jest.fn(),
        create: jest.fn(),
      },
      refreshToken: {
        create: jest.fn().mockResolvedValue({ id: "rt-1" }),
        findFirst: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
    };

    jwtService = {
      sign: jest.fn().mockReturnValue("mock-token"),
      verify: jest.fn(),
    };

    usersService = {
      findById: jest.fn(),
      findOrCreateGoogleUser: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: DatabaseService,
          useValue: databaseService,
        },
        {
          provide: JwtService,
          useValue: jwtService,
        },
        {
          provide: UsersService,
          useValue: usersService,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("generateTokensAndSave", () => {
    it("should generate tokens and return user profile including purchases", async () => {
      usersService.findById.mockResolvedValue(mockSafeUser);

      const result = await service.generateTokensAndSave("user-uuid-123");

      expect(result).toBeDefined();
      expect(result.accessToken).toBe("mock-token");
      expect(result.refreshToken).toBe("mock-token");
      expect(result.user).toEqual(mockSafeUser);
      expect(result.user.purchases).toHaveLength(2);
      expect(result.user.purchases[0].planType).toBe(PlanType.N5);
      expect(databaseService.refreshToken.create).toHaveBeenCalled();
    });

    it("should throw an error if user is not found", async () => {
      usersService.findById.mockResolvedValue(null);

      await expect(
        service.generateTokensAndSave("non-existent-id"),
      ).rejects.toThrow("User not found");
    });
  });

  describe("getCurrentUser", () => {
    it("should return the safe user with purchases", async () => {
      usersService.findById.mockResolvedValue(mockSafeUser);

      const result = await service.getCurrentUser("user-uuid-123");

      expect(result).toEqual(mockSafeUser);
      expect(result.purchases).toEqual(mockSafeUser.purchases);
    });

    it("should throw an error if userId is missing", async () => {
      await expect(service.getCurrentUser("")).rejects.toThrow(
        "User ID is required",
      );
    });

    it("should throw an error if user is not found", async () => {
      usersService.findById.mockResolvedValue(null);

      await expect(service.getCurrentUser("missing-id")).rejects.toThrow(
        "User not found",
      );
    });
  });
});
