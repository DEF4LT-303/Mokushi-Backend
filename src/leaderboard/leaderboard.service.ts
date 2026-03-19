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
        normalizedScore: { not: null },
      },
      _avg: { normalizedScore: true },  // was: score
      _count: { normalizedScore: true }, // was: score
      orderBy: { _avg: { normalizedScore: 'desc' } },
      take: 50,
    });

    const filtered = data.filter(d => d._count.normalizedScore >= 1);

    filtered.sort((a, b) => {
      if (b._avg.normalizedScore !== a._avg.normalizedScore) {
        return (b._avg.normalizedScore ?? 0) - (a._avg.normalizedScore ?? 0);
      }
      return b._count.normalizedScore - a._count.normalizedScore;
    });

    const top10 = filtered.slice(0, 10);
    const userIds = top10.map(d => d.userId);

    const users = await this.databaseService.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, fullName: true, picture: true },
    });

    const result = top10.map(entry => {
      const user = users.find(u => u.id === entry.userId);
      return {
        userId: entry.userId,
        name: user?.fullName,
        picture: user?.picture,
        avgScore: parseFloat((entry._avg.normalizedScore ?? 0).toFixed(2)),
        attempts: entry._count.normalizedScore,
      };
    });

    await this.cache.set(cacheKey, result, 60);
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
        normalizedScore: { not: null },
        quiz: { moduleId },
      },
      _avg: { normalizedScore: true },
      _count: { normalizedScore: true },
      orderBy: { _avg: { normalizedScore: 'desc' } },
      take: 50,
    });

    const filtered = data.filter(d => d._count.normalizedScore >= 1);

    filtered.sort((a, b) => {
      if (b._avg.normalizedScore !== a._avg.normalizedScore) {
        return (b._avg.normalizedScore ?? 0) - (a._avg.normalizedScore ?? 0);
      }
      return b._count.normalizedScore - a._count.normalizedScore;
    });

    const top10 = filtered.slice(0, 10);
    const userIds = top10.map(d => d.userId);

    const users = await this.databaseService.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, fullName: true, picture: true },
    });

    const result = top10.map(entry => {
      const user = users.find(u => u.id === entry.userId);
      return {
        userId: entry.userId,
        name: user?.fullName,
        picture: user?.picture,
        avgScore: parseFloat((entry._avg.normalizedScore ?? 0).toFixed(2)),
        attempts: entry._count.normalizedScore,
      };
    });

    await this.cache.set(cacheKey, result, 60);
    return result;
  }
}