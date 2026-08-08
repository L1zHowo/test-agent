import { Injectable } from '@nestjs/common';
import { RedisService } from './redis.service';

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

@Injectable()
export class RateLimiterService {
  constructor(private readonly redis: RedisService) {}

  /** 固定窗口频率限流，计数存储在 Redis，适合多实例部署。 */
  async checkRateLimit(
    key: string,
    limit: number,
    windowSeconds: number,
  ): Promise<RateLimitResult> {
    const client = this.redis.getClient();
    const count = await client.incr(key);
    if (count === 1) await client.expire(key, windowSeconds);

    const ttl = Math.max(await client.ttl(key), 1);
    if (count > limit) {
      await client.decr(key);
      return { allowed: false, remaining: 0, retryAfterSeconds: ttl };
    }

    return {
      allowed: true,
      remaining: Math.max(limit - count, 0),
      retryAfterSeconds: ttl,
    };
  }

  /** 并发槽位限制，必须在 finally 或连接断开时释放。 */
  async acquireConcurrent(key: string, maxConcurrent: number): Promise<RateLimitResult> {
    const client = this.redis.getClient();
    const count = await client.incr(key);
    if (count === 1) await client.expire(key, 3600);

    if (count > maxConcurrent) {
      await client.decr(key);
      return { allowed: false, remaining: 0, retryAfterSeconds: 1 };
    }

    return { allowed: true, remaining: maxConcurrent - count, retryAfterSeconds: 0 };
  }

  async releaseConcurrent(key: string): Promise<void> {
    const client = this.redis.getClient();
    const count = await client.decr(key);
    if (count <= 0) await client.del(key);
  }
}
