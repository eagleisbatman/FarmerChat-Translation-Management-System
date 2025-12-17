/**
 * Redis cache adapter (optional, falls back to memory cache if not available)
 */

import type { CacheAdapter } from "./types";

let redisClient: any = null;
let redisAvailable = false;

// Try to initialize Redis
try {
  const redis = require("ioredis");
  const redisUrl = process.env.REDIS_URL;
  
  if (redisUrl) {
    redisClient = new redis(redisUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times: number) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
    });

    redisClient.on("error", (error: Error) => {
      console.error("Redis connection error:", error);
      redisAvailable = false;
    });

    redisClient.on("connect", () => {
      console.log("Redis connected");
      redisAvailable = true;
    });

    redisClient.on("ready", () => {
      redisAvailable = true;
    });
  }
} catch (error) {
  console.log("Redis not available, using memory cache");
  redisAvailable = false;
}

export class RedisCache implements CacheAdapter {
  private prefix: string;

  constructor(prefix: string = "linguaflow:") {
    this.prefix = prefix;
  }

  private getKey(key: string): string {
    return `${this.prefix}${key}`;
  }

  async get<T>(key: string): Promise<T | null> {
    if (!redisAvailable || !redisClient) {
      return null;
    }

    try {
      const value = await redisClient.get(this.getKey(key));
      if (!value) {
        return null;
      }
      return JSON.parse(value) as T;
    } catch (error) {
      console.error("Redis get error:", error);
      return null;
    }
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    if (!redisAvailable || !redisClient) {
      return;
    }

    try {
      const serialized = JSON.stringify(value);
      if (ttl) {
        await redisClient.setex(this.getKey(key), ttl, serialized);
      } else {
        await redisClient.set(this.getKey(key), serialized);
      }
    } catch (error) {
      console.error("Redis set error:", error);
    }
  }

  async delete(key: string): Promise<void> {
    if (!redisAvailable || !redisClient) {
      return;
    }

    try {
      await redisClient.del(this.getKey(key));
    } catch (error) {
      console.error("Redis delete error:", error);
    }
  }

  async clear(): Promise<void> {
    if (!redisAvailable || !redisClient) {
      return;
    }

    try {
      const keys = await redisClient.keys(`${this.prefix}*`);
      if (keys.length > 0) {
        await redisClient.del(...keys);
      }
    } catch (error) {
      console.error("Redis clear error:", error);
    }
  }

  async has(key: string): Promise<boolean> {
    if (!redisAvailable || !redisClient) {
      return false;
    }

    try {
      const exists = await redisClient.exists(this.getKey(key));
      return exists === 1;
    } catch (error) {
      console.error("Redis has error:", error);
      return false;
    }
  }

  isAvailable(): boolean {
    return redisAvailable && redisClient !== null;
  }
}

