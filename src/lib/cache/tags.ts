export const CACHE_TAGS = {
  favorites: (userId: string) => `user:${userId}:favorites`,
} as const;
