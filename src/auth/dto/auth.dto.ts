import { IsEmail } from "class-validator";

export class AuthPayloadDto {
  @IsEmail()
  email!: string;

  password!: string;
}
