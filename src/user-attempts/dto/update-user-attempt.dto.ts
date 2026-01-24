import { PartialType } from '@nestjs/swagger';
import { CreateUserAttemptDto } from './create-user-attempt.dto';

export class UpdateUserAttemptDto extends PartialType(CreateUserAttemptDto) {
  score?: number;
  completed?: boolean;
}
