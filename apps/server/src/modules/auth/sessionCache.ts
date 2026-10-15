import type { MembershipRole } from '@pv/shared';

const TTL_MS = 60_000;
const MAX_ENTRIES = 10_000;

/**
 * Per-instance cache of "is this session live, and what is the user's role" (07: role cached for
 * 60 s). Revocations on this instance drop the entry at once; another instance notices within
 * the TTL, and the access token itself expires after 15 minutes regardless.
 */
export class SessionCache {
  private readonly entries = new Map<string, { role: MembershipRole | null; at: number }>();

  constructor(private readonly now: () => number = Date.now) {}

  /** `undefined` when not cached; `null` role when the session is dead or not a member. */
  get(sessionId: string): MembershipRole | null | undefined {
    const entry = this.entries.get(sessionId);
    if (!entry) return undefined;
    if (this.now() - entry.at > TTL_MS) {
      this.entries.delete(sessionId);
      return undefined;
    }
    return entry.role;
  }

  set(sessionId: string, role: MembershipRole | null): void {
    if (this.entries.size >= MAX_ENTRIES) this.entries.clear();
    this.entries.set(sessionId, { role, at: this.now() });
  }

  delete(sessionId: string): void {
    this.entries.delete(sessionId);
  }

  clear(): void {
    this.entries.clear();
  }
}
