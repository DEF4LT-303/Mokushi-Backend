import { JwtService } from "@nestjs/jwt";
import { Test, TestingModule } from "@nestjs/testing";
import { PlanType, Role } from "@prisma/client";
import { SafeUser } from "prisma/safe-user.select";
import { DatabaseService } from "src/database/database.service";
import { UsersService } from "src/users/users.service";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";

describe("AuthController", () => {
  let controller: AuthController;
  let authService: any;
  let usersService: any;

  const mockSafeUser: SafeUser = {
    id: "user-123",
    email: "test@mokushiken.com",
    fullName: "Test User",
    firstName: "Test",
    lastName: "User",
    picture: null,
    role: Role.USER,
    createdAt: new Date(),
    updatedAt: new Date(),
    purchases: [
      {
        planType: PlanType.N5,
        purchasedAt: new Date(),
      },
    ],
  };

  beforeEach(async () => {
    authService = {
      generateTokensAndSave: jest.fn().mockResolvedValue({
        accessToken: "access-token-123",
        refreshToken: "refresh-token-123",
        user: mockSafeUser,
      }),
      getCurrentUser: jest.fn().mockResolvedValue(mockSafeUser),
      rotateRefreshToken: jest.fn(),
      logout: jest.fn(),
    };

    usersService = {
      create: jest.fn().mockResolvedValue({ id: "user-123" }),
      findById: jest.fn().mockResolvedValue(mockSafeUser),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: authService,
        },
        {
          provide: UsersService,
          useValue: usersService,
        },
        {
          provide: DatabaseService,
          useValue: {},
        },
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn(),
            verify: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
  });

  describe("login", () => {
    it("should return user with purchases and set auth cookies", async () => {
      const mockReq = { user: { id: "user-123" } } as any;
      const mockRes = { cookie: jest.fn() } as any;

      const response = await controller.login(mockReq, mockRes);

      expect(response.message).toBe("Login successful");
      expect(response.user).toEqual(mockSafeUser);
      expect(response.user.purchases).toHaveLength(1);
      expect(response.user.purchases[0].planType).toBe(PlanType.N5);
      expect(mockRes.cookie).toHaveBeenCalled();
    });
  });

  describe("register", () => {
    it("should register user and return user with purchases", async () => {
      const createUserDto = {
        email: "new@mokushiken.com",
        password: "Password123!",
        fullName: "New User",
      };
      const mockRes = { cookie: jest.fn() } as any;

      const response = await controller.register(createUserDto as any, mockRes);

      expect(response.message).toBe("Registration successful");
      expect(response.user).toEqual(mockSafeUser);
      expect(response.user.purchases).toBeDefined();
      expect(mockRes.cookie).toHaveBeenCalled();
    });
  });

  describe("getCurrentUser", () => {
    it("should return current user with purchases", async () => {
      const mockReq = { user: { id: "user-123" } } as any;

      const response = await controller.getCurrentUser(mockReq);

      expect(response).toEqual(mockSafeUser);
      expect(response.purchases).toEqual(mockSafeUser.purchases);
    });
  });
});
