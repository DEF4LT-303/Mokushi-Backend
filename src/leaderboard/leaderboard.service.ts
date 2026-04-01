import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable } from '@nestjs/common';
import { Cache } from 'cache-manager';
import { DatabaseService } from 'src/database/database.service';

@Injectable()
export class LeaderboardService {
  constructor(
    private readonly databaseService: DatabaseService,
    @Inject(CACHE_MANAGER) private cache: Cache,
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
    };

    await this.cache.set(cacheKey, result, 60);
    return result;
  }

  // ============================
  // GLOBAL LEADERBOARD
  // ============================
  async getGlobalLeaderboard(userId?: string) {
    return this.buildLeaderboard(
      userId
        ? `leaderboard:global:${userId}`
        : 'leaderboard:global:anon',
      {
        completed: true,
        normalizedScore: { not: null },
      },
      userId,
    );
  }

  // ============================
  // MODULE LEADERBOARD
  // ============================
  async getModuleLeaderboard(moduleId: string, userId?: string) {
    return this.buildLeaderboard(
      `leaderboard:module:${moduleId}:${userId || 'anon'}`,
      {
        completed: true,
        normalizedScore: { not: null },
        quiz: { moduleId },
      },
      userId,
    );
  }

  // ============================
  // CATEGORY LEADERBOARD
  // ============================
  async getCategoryLeaderboard(category: string, userId?: string) {
    return this.buildLeaderboard(
      `leaderboard:category:${category}:${userId || 'anon'}`,
      {
        completed: true,
        normalizedScore: { not: null },
        quiz: {
          module: {
            categoryType: category as any,
          },
        },
      },
      userId,
    );
  }

  // ============================
  // ALL CATEGORIES COMBINED
  // ============================
  async getCategorizedLeaderboard(userId?: string) {
    const cacheKey = userId
      ? `leaderboard:categorized:${userId}`
      : 'leaderboard:categorized:anon';

    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    const categories = ['GRAMMAR', 'VOCABULARY', 'LISTENING'];

    const result: any = {};

    result['Global Program'] =
      await this.getGlobalLeaderboard(userId);

    for (const category of categories) {
      result[
        category.charAt(0) +
        category.slice(1).toLowerCase()
      ] = await this.getCategoryLeaderboard(
        category,
        userId,
      );
    }

    await this.cache.set(cacheKey, result, 60);
    return result;
  }
}