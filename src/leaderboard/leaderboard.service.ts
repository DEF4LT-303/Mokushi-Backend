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

  // ----------------------------
  // GLOBAL AVERAGE LEADERBOARD
  // ----------------------------
  async getGlobalAverageLeaderboard() {
    const cacheKey = 'leaderboard:global:avg';

    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    const data = await this.databaseService.userAttempt.groupBy({
      by: ['userId'],
      where: {
        completed: true,
      },
      _avg: {
        score: true,
      },
      _count: {
        score: true,
      },
      orderBy: {
        _avg: {
          score: 'desc',
        },
      },
      take: 50,
    });

    // Filter minimum attempts (IMPORTANT)
    const filtered = data.filter(d => d._count.score >= 1);

    // Sort (tie-breaker)
    filtered.sort((a, b) => {
      if (b._avg.score !== a._avg.score) {
        return (b._avg.score ?? 0) - (a._avg.score ?? 0);
      }
      return b._count.score - a._count.score;
    });

    const top10 = filtered.slice(0, 10);

    const userIds = top10.map(d => d.userId);

    const users = await this.databaseService.user.findMany({
      where: { id: { in: userIds } },
      select: {
        id: true,
        fullName: true,
        picture: true,
      },
    });

    const result = top10.map(entry => {
      const user = users.find(u => u.id === entry.userId);
      return {
        userId: entry.userId,
        name: user?.fullName,
        picture: user?.picture,
        avgScore: entry._avg.score,
        attempts: entry._count.score,
      };
    });

    await this.cache.set(cacheKey, result, 60_000);

    return result;
  }

  // ----------------------------
  // MODULE AVERAGE LEADERBOARD
  // ----------------------------
  async getModuleAverageLeaderboard(moduleId: string) {
    const cacheKey = `leaderboard:module:${moduleId}:avg`;

    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    const data = await this.databaseService.userAttempt.groupBy({
      by: ['userId'],
      where: {
        completed: true,
        quiz: {
          moduleId: moduleId,
        },
      },
      _avg: {
        score: true,
      },
      _count: {
        score: true,
      },
      orderBy: {
        _avg: {
          score: 'desc',
        },
      },
      take: 50,
    });

    const filtered = data.filter(d => d._count.score >= 1);

    filtered.sort((a, b) => {
      if (b._avg.score !== a._avg.score) {
        return (b._avg.score ?? 0) - (a._avg.score ?? 0);
      }
      return b._count.score - a._count.score;
    });

    const top10 = filtered.slice(0, 10);

    const userIds = top10.map(d => d.userId);

    const users = await this.databaseService.user.findMany({
      where: { id: { in: userIds } },
      select: {
        id: true,
        fullName: true,
        picture: true,
      },
    });

    const result = top10.map(entry => {
      const user = users.find(u => u.id === entry.userId);
      return {
        userId: entry.userId,
        name: user?.fullName,
        picture: user?.picture,
        avgScore: entry._avg.score,
        attempts: entry._count.score,
      };
    });

    await this.cache.set(cacheKey, result, 60_000);

    return result;
  }
}