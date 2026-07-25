import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { CategoryType, Prisma, QuestionType } from '@prisma/client';
import { DatabaseService } from 'src/database/database.service';

type GeneratedQuestion = {
  content: string;
  options: string[];
  correctAnswer: string;
  explanation: string | null;
  questionType: QuestionType;
};

@Injectable()
export class QuestionGenerationService {
  constructor(private readonly databaseService: DatabaseService) { }

  private mapCategoryToQuestionType(lessonSlug: string, categoryType: CategoryType): QuestionType {
    if (categoryType === CategoryType.GRAMMAR) return QuestionType.GRAMMAR;
    if (categoryType === CategoryType.VOCABULARY) {
      return lessonSlug.includes('kanji') ? QuestionType.KANJI : QuestionType.VOCABULARY;
    }
    // LISTENING has no direct QuestionType equivalent; default to VOCABULARY
    return QuestionType.VOCABULARY;
  }

  private buildPromptFromLesson(lesson: any, count: number, questionType: QuestionType) {
    const parts: string[] = [`Lesson: ${lesson.title}`];

    for (const rule of lesson.grammarRules ?? []) {
      parts.push(`Rule: ${rule.englishTitle || rule.japanese}`);
      if (rule.description) parts.push(`Description: ${rule.description}`);
      if (rule.structurePattern) parts.push(`Structure: ${rule.structurePattern}`);
      if (rule.usageNotes) parts.push(`Usage: ${rule.usageNotes}`);

      if (rule.examples?.length) {
        parts.push('Examples:');
        for (const ex of rule.examples) {
          parts.push(`- Japanese: ${ex.japaneseSentence}`);
          parts.push(`  English: ${ex.englishTranslation}`);
        }
      }
    }

    parts.push(
      `Generate EXACTLY ${count} multiple-choice questions of type "${questionType}" based on the above rules and examples.`,
      'Return ONLY a JSON array of objects with EXACTLY these fields:',
      '- content: string (the question text)',
      '- options: array of exactly 4 strings (answer choices)',
      '- correctAnswer: string (must exactly match one of the options)',
      '- explanation: string (brief explanation of the correct answer)',
      `- questionType: string, must be exactly "${questionType}"`,
      'No markdown, no code fences, no text outside the JSON array.',
    );

    return parts.join('\n');
  }

  async generateQuestions(lessonId: string, count: number) {
    const lesson = await this.databaseService.lesson.findUnique({
      where: { id: lessonId },
      include: {
        grammarRules: { include: { examples: true } },
        module: true,
      },
    });

    if (!lesson) {
      throw new NotFoundException(`Lesson with id '${lessonId}' not found`);
    }

    if (!lesson.module) {
      throw new InternalServerErrorException(`Lesson '${lessonId}' has no associated module`);
    }

    const apiKey = process.env.API_KEY;
    if (!apiKey) {
      throw new InternalServerErrorException('Gemini API configuration is missing (API_KEY)');
    }

    const questionType = this.mapCategoryToQuestionType(lesson.module.slug, lesson.module.categoryType);
    const prompt = this.buildPromptFromLesson(lesson, count, questionType);
    const generated = await this.callGemini(prompt, apiKey, questionType);

    return {
      moduleId: lesson.module.id,
      questions: generated,
    };
  }

  private async callGemini(prompt: string, apiKey: string, questionType: QuestionType): Promise<GeneratedQuestion[]> {
    const model = process.env.AI_MODEL || 'gemini-2.0-flash-lite';
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

    let res: Response;
    try {
      res = await fetch(`${endpoint}?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.7,
          },
        }),
      });
    } catch (err) {
      throw new InternalServerErrorException(`Failed to reach Gemini API: ${err instanceof Error ? err.message : String(err)}`);
    }

    const rawText = await res.text();

    if (!res.ok) {
      const snippet = rawText.length > 500 ? rawText.slice(0, 500) + '...[truncated]' : rawText;
      throw new InternalServerErrorException(`Gemini API returned ${res.status}: ${snippet}`);
    }

    const payload = JSON.parse(rawText);
    const generatedText = payload?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!generatedText) {
      throw new InternalServerErrorException('Gemini API response missing expected candidates/content/parts structure');
    }

    return this.parseGeneratedQuestions(generatedText, questionType);
  }

  private parseGeneratedQuestions(text: string, fallbackType: QuestionType): GeneratedQuestion[] {
    let parsed: any;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new InternalServerErrorException(`Provider returned unparsable JSON: ${text.slice(0, 500)}`);
    }

    const questions = Array.isArray(parsed) ? parsed : parsed.questions ?? parsed.data ?? null;

    if (!Array.isArray(questions)) {
      throw new InternalServerErrorException(`Expected array of questions, got: ${JSON.stringify(parsed).slice(0, 500)}`);
    }

    return questions.map((q, i) => this.validateAndNormalize(q, i, fallbackType));
  }

  private validateAndNormalize(q: any, index: number, fallbackType: QuestionType): GeneratedQuestion {
    if (typeof q.content !== 'string' || !q.content.trim()) {
      throw new InternalServerErrorException(`Question ${index}: missing or invalid 'content'`);
    }
    if (!Array.isArray(q.options) || q.options.length < 2 || !q.options.every((o: any) => typeof o === 'string')) {
      throw new InternalServerErrorException(`Question ${index}: 'options' must be an array of strings`);
    }
    if (typeof q.correctAnswer !== 'string' || !q.options.includes(q.correctAnswer)) {
      throw new InternalServerErrorException(`Question ${index}: 'correctAnswer' must match one of the options`);
    }

    const questionType = Object.values(QuestionType).includes(q.questionType) ? q.questionType : fallbackType;

    return {
      content: q.content,
      options: q.options,
      correctAnswer: q.correctAnswer,
      explanation: typeof q.explanation === 'string' ? q.explanation : null,
      questionType,
    };
  }

  toCreateManyInput(questions: GeneratedQuestion[], moduleId: string): Prisma.QuestionCreateManyInput[] {
    return questions.map(q => ({
      content: q.content,
      options: q.options as Prisma.InputJsonValue,
      correctAnswer: q.correctAnswer,
      explanation: q.explanation,
      questionType: q.questionType,
      moduleId,
    }));
  }
}