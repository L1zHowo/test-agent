import { Injectable, Logger, OnModuleDestroy, Optional } from '@nestjs/common';
import { RedisService } from './redis.service';

export interface CacheStats {
  l1Hits: number;
  l1Misses: number;
  l2Hits: number;
  l2Misses: number;
  l1Evictions: number;
  lockAcquires: number;
  lockContends: number;
  totalLoads: number;
}

export interface MultiLevelCacheConfig {
  l1MaxEntries?: number;
  l1DefaultTTL?: number;
  l2DefaultTTL?: number;
  ttlJitter?: number;
  nullValueTTL?: number;
  lockTimeout?: number;
  l1Enabled?: boolean;
  l2Enabled?: boolean;
  keyPrefix?: string;
}

type MemoryEntry<T = unknown> = {
  value: T;
  expiresAt: number;
};

@Injectable()
export class CacheService implements OnModuleDestroy {
  private readonly logger = new Logger(CacheService.name);
  private readonly memory = new Map<string, MemoryEntry>();
  private readonly locks = new Map<string, Promise<unknown>>();
  private readonly config: Required<MultiLevelCacheConfig>;
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  private readonly stats: CacheStats = {
    l1Hits: 0,
    l1Misses: 0,
    l2Hits: 0,
    l2Misses: 0,
    l1Evictions: 0,
    lockAcquires: 0,
    lockContends: 0,
    totalLoads: 0,
  };

  constructor(
    private readonly redisService: RedisService,
    @Optional() config?: MultiLevelCacheConfig,
  ) {
    this.config = {
      l1MaxEntries: config?.l1MaxEntries ?? 1000,
      l1DefaultTTL: config?.l1DefaultTTL ?? 60,
      l2DefaultTTL: config?.l2DefaultTTL ?? 300,
      ttlJitter: config?.ttlJitter ?? 0.1,
      nullValueTTL: config?.nullValueTTL ?? 30,
      lockTimeout: config?.lockTimeout ?? 10,
      l1Enabled: config?.l1Enabled ?? true,
      l2Enabled: config?.l2Enabled ?? true,
      keyPrefix: config?.keyPrefix ?? 'cache',
    };

    this.cleanupTimer = setInterval(() => this.cleanupExpired(), 60_000);
    this.logger.log('Cache service initialized');
  }

  onModuleDestroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    this.memory.clear();
  }

  async getOrSet<T>(key: string, factory: () => Promise<T>, ttlSeconds?: number): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) return cached;

    const fullKey = this.buildKey(key);
    const existingLock = this.locks.get(fullKey) as Promise<T> | undefined;
    if (existingLock) {
      this.stats.lockContends++;
      return existingLock;
    }

    this.stats.lockAcquires++;
    this.stats.totalLoads++;

    const loadPromise = (async () => {
      const value = await factory();
      await this.set(key, value, ttlSeconds);
      return value;
    })();

    this.locks.set(fullKey, loadPromise);
    try {
      return await loadPromise;
    } finally {
      this.locks.delete(fullKey);
    }
  }

  async get<T>(key: string): Promise<T | null> {
    const fullKey = this.buildKey(key);

    if (this.config.l1Enabled) {
      const memoryValue = this.getMemory<T>(fullKey);
      if (memoryValue.hit) {
        this.stats.l1Hits++;
        return memoryValue.value;
      }
      this.stats.l1Misses++;
    }

    if (this.config.l2Enabled) {
      try {
        const redisValue = await this.redisService.getCached<T>(fullKey);
        if (redisValue !== null) {
          this.stats.l2Hits++;
          this.setMemory(fullKey, redisValue, this.config.l1DefaultTTL);
          return redisValue;
        }
        this.stats.l2Misses++;
      } catch (error) {
        this.stats.l2Misses++;
        this.logger.warn(`Redis cache read failed for ${fullKey}: ${error instanceof Error ? error.message : error}`);
      }
    }

    return null;
  }

  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    const fullKey = this.buildKey(key);
    const ttl = ttlSeconds ?? this.config.l2DefaultTTL;

    if (this.config.l1Enabled) {
      this.setMemory(fullKey, value, Math.min(ttl, this.config.l1DefaultTTL));
    }

    if (this.config.l2Enabled) {
      await this.redisService.setCached(fullKey, value, this.applyJitterSeconds(ttl));
    }
  }

  async delete(key: string): Promise<void> {
    const fullKey = this.buildKey(key);
    this.memory.delete(fullKey);
    if (this.config.l2Enabled) {
      await this.redisService.del(fullKey);
    }
  }

  async deleteByPrefix(prefix: string): Promise<number> {
    const fullPrefix = this.buildKey(prefix);
    let count = 0;

    for (const key of [...this.memory.keys()]) {
      if (key.startsWith(fullPrefix)) {
        this.memory.delete(key);
        count++;
      }
    }

    if (this.config.l2Enabled) {
      const client = this.redisService.getClient();
      let cursor = '0';
      do {
        const [nextCursor, keys] = await client.scan(cursor, 'MATCH', `${fullPrefix}*`, 'COUNT', 100);
        cursor = nextCursor;
        if (keys.length > 0) {
          await client.del(...keys);
          count += keys.length;
        }
      } while (cursor !== '0');
    }

    return count;
  }

  async clear(): Promise<void> {
    this.memory.clear();
    await this.deleteByPrefix('');
  }

  async warmUp<T>(entries: Array<{ key: string; value: T }>, ttlSeconds?: number): Promise<void> {
    await Promise.all(entries.map((entry) => this.set(entry.key, entry.value, ttlSeconds)));
  }

  async warmUpWithFactory<T>(keys: string[], factory: (key: string) => Promise<T>, ttlSeconds?: number): Promise<void> {
    await Promise.all(keys.map(async (key) => {
      const existing = await this.get<T>(key);
      if (existing === null) {
        await this.set(key, await factory(key), ttlSeconds);
      }
    }));
  }

  getStats(): CacheStats & {
    l1Size: number;
    l1MaxEntries: number;
    l1HitRate: string;
    l2HitRate: string;
    overallHitRate: string;
  } {
    const l1Total = this.stats.l1Hits + this.stats.l1Misses;
    const l2Total = this.stats.l2Hits + this.stats.l2Misses;
    const totalHits = this.stats.l1Hits + this.stats.l2Hits;
    const totalRequests = l1Total + l2Total;

    return {
      ...this.stats,
      l1Size: this.memory.size,
      l1MaxEntries: this.config.l1MaxEntries,
      l1HitRate: l1Total ? `${((this.stats.l1Hits / l1Total) * 100).toFixed(1)}%` : 'N/A',
      l2HitRate: l2Total ? `${((this.stats.l2Hits / l2Total) * 100).toFixed(1)}%` : 'N/A',
      overallHitRate: totalRequests ? `${((totalHits / totalRequests) * 100).toFixed(1)}%` : 'N/A',
    };
  }

  resetStats(): void {
    this.stats.l1Hits = 0;
    this.stats.l1Misses = 0;
    this.stats.l2Hits = 0;
    this.stats.l2Misses = 0;
    this.stats.l1Evictions = 0;
    this.stats.lockAcquires = 0;
    this.stats.lockContends = 0;
    this.stats.totalLoads = 0;
  }

  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    l1: { enabled: boolean; size: number; maxEntries: number };
    l2: { enabled: boolean; status: string; latency: number };
    stats: { overallHitRate: string; totalLoads: number };
  }> {
    const l2 = this.config.l2Enabled
      ? await this.redisService.healthCheck()
      : { status: 'disabled', latency: 0 };
    const stats = this.getStats();

    return {
      status: l2.status === 'healthy' ? 'healthy' : 'degraded',
      l1: {
        enabled: this.config.l1Enabled,
        size: this.memory.size,
        maxEntries: this.config.l1MaxEntries,
      },
      l2: {
        enabled: this.config.l2Enabled,
        status: l2.status,
        latency: l2.latency,
      },
      stats: {
        overallHitRate: stats.overallHitRate,
        totalLoads: stats.totalLoads,
      },
    };
  }

  private buildKey(key: string): string {
    return `${this.config.keyPrefix}:${key}`;
  }

  private getMemory<T>(key: string): { hit: true; value: T } | { hit: false } {
    const entry = this.memory.get(key);
    if (!entry) return { hit: false };
    if (Date.now() > entry.expiresAt) {
      this.memory.delete(key);
      return { hit: false };
    }
    return { hit: true, value: entry.value as T };
  }

  private setMemory<T>(key: string, value: T, ttlSeconds: number): void {
    if (!this.config.l1Enabled) return;

    if (this.memory.size >= this.config.l1MaxEntries && !this.memory.has(key)) {
      const oldestKey = this.memory.keys().next().value;
      if (oldestKey) {
        this.memory.delete(oldestKey);
        this.stats.l1Evictions++;
      }
    }

    this.memory.set(key, {
      value,
      expiresAt: Date.now() + this.applyJitterSeconds(ttlSeconds) * 1000,
    });
  }

  private applyJitterSeconds(ttlSeconds: number): number {
    const jitterRange = ttlSeconds * this.config.ttlJitter;
    const jitter = (Math.random() - 0.5) * 2 * jitterRange;
    return Math.max(1, Math.round(ttlSeconds + jitter));
  }

  private cleanupExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.memory) {
      if (now > entry.expiresAt) {
        this.memory.delete(key);
      }
    }
  }
}
