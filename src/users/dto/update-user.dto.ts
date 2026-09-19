import { ApiPropertyOptional } from "@nestjs/swagger";
import { Role } from "@prisma/client";
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
} from "class-validator";

export class UpdateUserDto {
  @ApiPropertyOptional({
    description: "User name",
    example: "John Doe",
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({
    description: "User email address",
    example: "user@example.com",
  })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({
    description: "User password",
    example: "password123",
  })
  @IsOptional()
  @IsString()
  @MinLength(6)
  password?: string;

  @ApiPropertyOptional({
    description: "User role",
    example: "USER",
    enum: Role,
  })
  @IsOptional()
  @IsEnum(Role)
  role?: Role;
}
