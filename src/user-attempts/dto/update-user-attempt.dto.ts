import { PartialType } from '@nestjs/swagger';
import { CreateUserAttemptDto } from './create-user-attempt.dto';
import { UserAttemptStatus } from '@prisma/client';

export class UpdateUserAttemptDto extends PartialType(CreateUserAttemptDto) {
  score?: number;
  status?: UserAttemptStatus;
}
