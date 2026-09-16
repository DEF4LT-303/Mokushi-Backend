import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common';
import { CacheService } from 'src/common/services/cache.service';
import { DatabaseService } from 'src/database/database.service';
import { LeaderboardGateway } from './leaderboard.gateway';

@Injectable()
export class LeaderboardService {
  private logger = new Logger('LeaderboardService');

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly cache: CacheService,

    @Inject(forwardRef(() => LeaderboardGateway))
    private readonly gateway: LeaderboardGateway,
  ) { }

  // ============================
  // CORE BUILDER (REUSABLE)
  // ============================
  private async buildLeaderboard(
    cacheKey: string,
    where: any,
    userId?: string,
  ) {
    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    const data = await this.databaseService.userAttempt.groupBy({
      by: ['userId'],
      where,
      _avg: { normalizedScore: true },
      _count: { normalizedScore: true },
    });

    const filtered = data.filter(d => d._count.normalizedScore >= 1);

    filtered.sort((a, b) => {
      if (b._avg.normalizedScore !== a._avg.normalizedScore) {
        return (b._avg.normalizedScore ?? 0) - (a._avg.normalizedScore ?? 0);
      }
      return b._count.normalizedScore - a._count.normalizedScore;
    });

    const top = filtered.slice(0, 10);
    const userIds = top.map(d => d.userId);

    if (userId && !userIds.includes(userId)) {
      userIds.push(userId);
    }

    const users = await this.databaseService.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, fullName: true, picture: true },
    });

    const formattedTop = top.map(entry => {
      const user = users.find(u => u.id === entry.userId);

      return {
        userId: entry.userId,
        name: user?.fullName,
        picture: user?.picture,
        avgScore: parseFloat(
          (entry._avg.normalizedScore ?? 0).toFixed(2),
        ),
        attempts: entry._count.normalizedScore,
      };
    });

    // ============================
    // CURRENT USER RANK
    // ============================
    let currentUserRank: any = null;

    if (userId) {
      const index = filtered.findIndex(e => e.userId === userId);

      if (index !== -1) {
        const entry = filtered[index];
        const user = users.find(u => u.id === userId);

        currentUserRank = {
          userId,
          name: user?.fullName,
          picture: user?.picture,
          avgScore: parseFloat(
            (entry._avg.normalizedScore ?? 0).toFixed(2),
          ),
          attempts: entry._count.normalizedScore,
          rank: index + 1,
        };
      }
    }

    const result = {
      top10: formattedTop,
      currentUserRank,
      totalUsers: filtered.length,
    };

    await this.cache.set(cacheKey, result, 60);
    return result;
  }

  private buildWhereCondition(jlptLevel?: string): any {
    const where: any = {
      completed: true,
      normalizedScore: { not: null },
    };

    if (jlptLevel) {
      where.quiz = { jlptLevel };
    }

    return where;
  }

  // =============================
  // GLOBAL LEADERBOARD
  // ============================
  async getGlobalLeaderboard(userId?: string, jlptLevel?: string) {
    const baseWhere = this.buildWhereCondition(jlptLevel);
    const cacheKey = `leaderboard:global:${jlptLevel || 'all'}:${userId || 'anon'}`;
    return this.buildLeaderboard(
      cacheKey,
      baseWhere,
      userId,
    );
  }

  // ============================
  // MODULE LEADERBOARD
  // ============================
  async getModuleLeaderboard(moduleId: string, userId?: string) {
    const where = {
      completed: true,
      normalizedScore: { not: null },
      quiz: { moduleId },
    };
    const cacheKey = `leaderboard:module:${moduleId}:${userId || 'anon'}`;
    return this.buildLeaderboard(
      cacheKey,
      where,
      userId,
    );
  }

  // ============================
  // CATEGORY LEADERBOARD
  // ============================
  async getCategoryLeaderboard(category: string, userId?: string, jlptLevel?: string) {
    const baseWhere = this.buildWhereCondition(jlptLevel);
    const where = {
      ...baseWhere,
      quiz: {
        ...baseWhere.quiz,
        module: {
          categoryType: category as any,
        },
      },
    };
    const cacheKey = `leaderboard:category:${category}:${jlptLevel || 'all'}:${userId || 'anon'}`;
    return this.buildLeaderboard(
      cacheKey,
      where,
      userId,
    );
  }

  // ============================
  // ALL CATEGORIES COMBINED
  // ============================
  async getCategorizedLeaderboard(userId?: string, jlptLevel?: string) {
    const cacheKey = `leaderboard:categorized:${jlptLevel || 'all'}:${userId || 'anon'}`;

    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    const [globalProgram, grammar, vocabulary, listening] = await Promise.all([
      this.getGlobalLeaderboard(userId, jlptLevel),
      this.getCategoryLeaderboard('GRAMMAR', userId, jlptLevel),
      this.getCategoryLeaderboard('VOCABULARY', userId, jlptLevel),
      this.getCategoryLeaderboard('LISTENING', userId, jlptLevel),
    ]);

    const result = {
      globalProgram,
      grammar,
      vocabulary,
      listening,
    };

    await this.cache.set(cacheKey, result, 60);
    return result;
  }

  // ============================
  // CACHE INVALIDATION & BROADCAST
  // ============================

  /**
   * Call this after a quiz attempt is submitted to invalidate cache
   * and broadcast updates to all connected clients
   */
  async onAttemptCompleted(userId?: string | null, moduleId?: string | null, jlptLevel?: string) {
    await this.cache.invalidatePattern(`leaderboard:`);

    try {
      const leaderboard =
        await this.getCategorizedLeaderboard(userId || undefined, jlptLevel);

      this.gateway.broadcastUpdate();
    } catch (error) {
      this.logger.error(`Broadcast error: ${error}`);
    }
  }

}