import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { JlptLevel } from "@prisma/client";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { JwtGuard } from "../auth/guards/jwt.guard";
import { OptionalJwtGuard } from "../auth/guards/optional-jwt.guard";
import { RapidFireLessonOverviewDto } from "./dto/lesson-detail.dto";
import {
  QueryRapidFireLessonsDto,
  QueryRapidFireWordsDto,
} from "./dto/query-rapid-fire.dto";
import { SubmitRapidFireAnswersResponseDto } from "./dto/rapid-fire-answer-response.dto";
import { SubmitRapidFireAnswersDto } from "./dto/rapid-fire-answer.dto";
import { RapidFireLessonDto } from "./dto/rapid-fire-lesson.dto";
import {
  RapidFireWordDetailDto,
  RapidFireWordDto,
  ToggleHardWordResponseDto,
} from "./dto/rapid-fire-word.dto";
import { RapidFireService } from "./rapid-fire.service";

@ApiTags("RapidFire")
@Controller("rapid-fire")
export class RapidFireController {
  constructor(private readonly rapidFireService: RapidFireService) {}

  // ==========================================
  // LESSONS ENDPOINTS
  // ==========================================

  @UseGuards(OptionalJwtGuard)
  @Get("lessons")
  @ApiOperation({
    summary: "Get list of all rapid-fire lessons with word count and unlock status",
  })
  @ApiOkResponse({
    type: [RapidFireLessonDto],
    description: "List of rapid-fire lessons",
  })
  async getAllLessons(
    @CurrentUser() user: any,
    @Query() query: QueryRapidFireLessonsDto,
  ): Promise<RapidFireLessonDto[]> {
    return this.rapidFireService.getAllLessons(query, user?.id, user);
  }

  @UseGuards(OptionalJwtGuard)
  @Get("lessons/:lessonId")
  @ApiOperation({
    summary: "Get single rapid-fire lesson metadata by ID",
  })
  @ApiParam({ name: "lessonId", description: "Rapid fire lesson ID" })
  @ApiOkResponse({
    type: RapidFireLessonDto,
    description: "Rapid fire lesson metadata",
  })
  @ApiNotFoundResponse({ description: "Lesson not found" })
  async getLessonById(
    @CurrentUser() user: any,
    @Param("lessonId") lessonId: string,
  ): Promise<RapidFireLessonDto> {
    return this.rapidFireService.getLessonById(lessonId, user?.id, user);
  }

  @UseGuards(OptionalJwtGuard)
  @Get("lessons/:lessonId/words")
  @ApiOperation({
    summary: "Fetch all vocabulary words for a rapid-fire lesson (study/flashcard mode)",
  })
  @ApiParam({ name: "lessonId", description: "Rapid fire lesson ID" })
  @ApiOkResponse({
    type: [RapidFireWordDto],
    description: "List of vocabulary words in this lesson",
  })
  @ApiNotFoundResponse({ description: "Lesson not found" })
  @ApiForbiddenResponse({
    description: "Lesson is premium and user has not purchased access",
  })
  async getLessonWords(
    @CurrentUser() user: any,
    @Param("lessonId") lessonId: string,
  ): Promise<RapidFireWordDto[]> {
    return this.rapidFireService.getRapidFireWordsForLesson(
      lessonId,
      user?.id,
      user,
    );
  }

  // ==========================================
  // WORDS ENDPOINTS
  // ==========================================

  @UseGuards(OptionalJwtGuard)
  @Get("words")
  @ApiOperation({
    summary: "Search and query rapid-fire vocabulary words across lessons and levels",
  })
  @ApiOkResponse({
    description: "Paginated list of vocabulary words with lesson details",
  })
  async searchWords(
    @CurrentUser() user: any,
    @Query() query: QueryRapidFireWordsDto,
  ): Promise<{ total: number; words: RapidFireWordDetailDto[] }> {
    return this.rapidFireService.searchWords(query, user?.id);
  }

  @UseGuards(JwtGuard)
  @Get("hard-words")
  @ApiOperation({
    summary: "Get all words bookmarked/marked as hard by current user",
  })
  @ApiBearerAuth()
  @ApiUnauthorizedResponse({ description: "Unauthorized" })
  @ApiQuery({ name: "jlptLevel", required: false, enum: JlptLevel })
  @ApiOkResponse({
    description: "List of hard words for current user",
  })
  async getHardWords(
    @CurrentUser() user: any,
    @Query("jlptLevel") jlptLevel?: JlptLevel,
  ): Promise<{ total: number; hardWords: RapidFireWordDetailDto[] }> {
    return this.rapidFireService.getUserHardWords(user.id, jlptLevel);
  }

  @UseGuards(OptionalJwtGuard)
  @Get("words/:wordId")
  @ApiOperation({
    summary: "Get details for a single vocabulary word by ID",
  })
  @ApiParam({ name: "wordId", description: "Rapid fire word ID" })
  @ApiOkResponse({
    type: RapidFireWordDetailDto,
    description: "Word detail including lesson info and user hard mark",
  })
  @ApiNotFoundResponse({ description: "Word not found" })
  async getWordById(
    @CurrentUser() user: any,
    @Param("wordId") wordId: string,
  ): Promise<RapidFireWordDetailDto> {
    return this.rapidFireService.getWordById(wordId, user?.id);
  }

  // ==========================================
  // HARD WORDS (BOOKMARK) ACTIONS
  // ==========================================

  @UseGuards(JwtGuard)
  @Post("words/:wordId/toggle-hard")
  @ApiOperation({
    summary: "Toggle hard/bookmarked status of a vocabulary word for current user",
  })
  @ApiParam({ name: "wordId", description: "Rapid fire word ID" })
  @ApiBearerAuth()
  @ApiUnauthorizedResponse({ description: "Unauthorized" })
  @ApiOkResponse({
    type: ToggleHardWordResponseDto,
    description: "Updated hard status and total hard words count",
  })
  async toggleHardWord(
    @CurrentUser() user: any,
    @Param("wordId") wordId: string,
  ): Promise<ToggleHardWordResponseDto> {
    return this.rapidFireService.toggleHardWord(user.id, wordId);
  }

  @UseGuards(JwtGuard)
  @Post("words/:wordId/hard")
  @ApiOperation({
    summary: "Explicitly mark a vocabulary word as hard/bookmarked",
  })
  @ApiParam({ name: "wordId", description: "Rapid fire word ID" })
  @ApiBearerAuth()
  @ApiUnauthorizedResponse({ description: "Unauthorized" })
  @ApiOkResponse({
    type: ToggleHardWordResponseDto,
    description: "Marked as hard result",
  })
  async markHardWord(
    @CurrentUser() user: any,
    @Param("wordId") wordId: string,
  ): Promise<ToggleHardWordResponseDto> {
    return this.rapidFireService.markHardWord(user.id, wordId);
  }

  @UseGuards(JwtGuard)
  @Delete("words/:wordId/hard")
  @ApiOperation({
    summary: "Explicitly unmark/remove a vocabulary word from hard words",
  })
  @ApiParam({ name: "wordId", description: "Rapid fire word ID" })
  @ApiBearerAuth()
  @ApiUnauthorizedResponse({ description: "Unauthorized" })
  @ApiOkResponse({
    type: ToggleHardWordResponseDto,
    description: "Unmarked from hard result",
  })
  async unmarkHardWord(
    @CurrentUser() user: any,
    @Param("wordId") wordId: string,
  ): Promise<ToggleHardWordResponseDto> {
    return this.rapidFireService.unmarkHardWord(user.id, wordId);
  }

  // ==========================================
  // STATS & QUIZ SESSION ENDPOINTS
  // ==========================================

  @UseGuards(JwtGuard)
  @Get("stats")
  @ApiOperation({
    summary:
      "Get overall rapid-fire stats and lesson stats for the current user",
  })
  @ApiBearerAuth()
  @ApiUnauthorizedResponse({ description: "Unauthorized" })
  @ApiQuery({ name: "jlptLevel", required: false, enum: JlptLevel })
  async getCombinedStats(
    @CurrentUser() user: any,
    @Query("jlptLevel") jlptLevel?: JlptLevel,
  ) {
    return this.rapidFireService.getCombinedStats(user.id, jlptLevel);
  }

  @UseGuards(JwtGuard)
  @Get("start/:lessonId")
  @ApiOperation({
    summary: "Start a rapid-fire quiz session and return the lesson words and initial stats",
  })
  @ApiBearerAuth()
  @ApiUnauthorizedResponse({ description: "Unauthorized" })
  @ApiOkResponse({ type: RapidFireLessonOverviewDto })
  async startQuiz(
    @CurrentUser() user: any,
    @Param("lessonId") lessonId: string,
  ) {
    return this.rapidFireService.getLessonDetail(user.id, lessonId, user);
  }

  @UseGuards(JwtGuard)
  @Post("submit/:lessonId")
  @ApiOperation({
    summary: "Submit rapid-fire answers for a lesson and update stats",
  })
  @ApiBearerAuth()
  @ApiUnauthorizedResponse({ description: "Unauthorized" })
  @ApiOkResponse({ type: SubmitRapidFireAnswersResponseDto })
  async submitAnswers(
    @CurrentUser() user: any,
    @Param("lessonId") lessonId: string,
    @Body() body: SubmitRapidFireAnswersDto,
  ) {
    return this.rapidFireService.submitAnswers(user.id, lessonId, body, user);
  }
}
