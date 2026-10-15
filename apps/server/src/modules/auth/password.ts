import bcrypt from 'bcryptjs';

/** bcrypt, cost 12 in production (07). Tests lower the cost to keep the suite fast. */
export class PasswordHasher {
  /** Compared against when the account doesn't exist, so the response time doesn't tell. */
  private readonly dummyHash: string;

  constructor(private readonly cost: number) {
    this.dummyHash = bcrypt.hashSync('not-a-real-password', cost);
  }

  hash(password: string): Promise<string> {
    return bcrypt.hash(password, this.cost);
  }

  /** False for a null hash (Google-only account), after spending the same time as a real check. */
  async verify(password: string, hash: string | null): Promise<boolean> {
    if (hash === null) {
      await bcrypt.compare(password, this.dummyHash);
      return false;
    }
    return bcrypt.compare(password, hash);
  }
}
