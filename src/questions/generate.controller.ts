import { Body, Controller, Post, UseGuards, ValidationPipe } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtGuard } from 'src/auth/guards/jwt.guard';
import { GenerateQuestionsDto } from './dto/generate-questions.dto';
import { QuestionGenerationService } from './question-generation.service';

@ApiTags('Questions')
@Controller('questions')
export class QuestionGenerationController {
  constructor(private readonly generationService: QuestionGenerationService) { }

  @Post('generate')
  @UseGuards(JwtGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Generate questions for a lesson using Gemini' })
  @ApiOkResponse({ description: 'Generated questions returned as JSON' })
  generate(@Body(ValidationPipe) dto: GenerateQuestionsDto) {
    return this.generationService.generateQuestions(dto.lessonId, dto.count);
  }
}
