/**
 * Application roles. Using a single source of truth instead of bare string
 * literals scattered across services, guards, and the seed avoids typos.
 */
export const Role = {
  User: 'ROLE_USER',
  Admin: 'ROLE_ADMIN',
} as const;

export type Role = (typeof Role)[keyof typeof Role];
