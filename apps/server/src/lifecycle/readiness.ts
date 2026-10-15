/** What `GET /api/ready` needs to know about the process. */
export interface Readiness {
  /** Resolves with the round-trip time in ms; rejects when the DB is unreachable. */
  pingDb(): Promise<number>;
  /** Milliseconds since the worker's last heartbeat, or null when there is no worker (until Stage 4). */
  workerHeartbeatAgeMs(): number | null;
  isShuttingDown(): boolean;
}
