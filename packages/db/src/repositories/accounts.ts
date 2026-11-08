import { newId } from "@sbi/contracts";
import { and, eq, gt, inArray, isNull, lte } from "drizzle-orm";
import type { Database } from "../client";
import {
  classActivity,
  classes,
  classLessons,
  educators,
  accountTokens,
  accounts,
  mediaObjects,
  savedLessons,
  sessions,
  tutorTurns,
} from "../schema";

export type StoredAccount = typeof accounts.$inferSelect;

export interface NewAccount {
  email: string;
  firstName: string;
  lastName: string;
  ageAtSignup: number;
  passwordHash: string | null;
  googleSub: string | null;
  emailVerifiedAt: Date | null;
  createdAt: Date;
}

export type TokenPurpose = "verify-email" | "reset-password";

export interface AccountRepository {
  /** Returns undefined when the email or Google account is already registered. */
  create(account: NewAccount): Promise<StoredAccount | undefined>;
  get(accountId: string): Promise<StoredAccount | undefined>;
  findByEmail(email: string): Promise<StoredAccount | undefined>;
  findByGoogleSub(googleSub: string): Promise<StoredAccount | undefined>;
  update(
    accountId: string,
    changes: Partial<Pick<StoredAccount, "emailVerifiedAt" | "googleSub" | "passwordHash">>,
  ): Promise<void>;
  /** Claims kept, unowned photos for the account; returns how many it now owns of those keys. */
  link(accountId: string, keys: string[], consentVersion: string, now: Date): Promise<number>;
  /** Withdraws the opt-in: photos stay kept but are no longer tied to the account. */
  unlink(accountId: string): Promise<number>;
  /** Kept photos linked to the account, for export and deletion. */
  ownedPhotos(accountId: string): Promise<{ key: string; consentVersion: string | null }[]>;
  /** Removes the account and every row tied to it; photos must be deleted first, with their bytes. */
  delete(accountId: string): Promise<void>;
}

export interface SessionRepository {
  create(sessionHash: string, accountId: string, now: Date, expiresAt: Date): Promise<void>;
  /** The account behind a live session, or undefined once it has expired or ended. */
  find(sessionHash: string, now: Date): Promise<string | undefined>;
  delete(sessionHash: string): Promise<void>;
  deleteForAccount(accountId: string): Promise<void>;
  deleteExpired(now: Date): Promise<number>;
}

export interface AccountTokenRepository {
  /** Issuing a new link of a purpose cancels any earlier one, so only the latest email works. */
  issue(
    tokenHash: string,
    accountId: string,
    purpose: TokenPurpose,
    expiresAt: Date,
  ): Promise<void>;
  /** The live token's account without using it up, so a request can be checked first. */
  peek(tokenHash: string, purpose: TokenPurpose, now: Date): Promise<string | undefined>;
  /** Uses a token up; returns its account only the first time and only before it expires. */
  consume(tokenHash: string, purpose: TokenPurpose, now: Date): Promise<string | undefined>;
  deleteExpired(now: Date): Promise<number>;
}

function affected(result: unknown): number {
  const [header] = result as [{ affectedRows?: number }];
  return header.affectedRows ?? 0;
}

function isDuplicate(error: unknown): boolean {
  const code = (error as { code?: string; cause?: { code?: string } }).code;
  const causeCode = (error as { cause?: { code?: string } }).cause?.code;
  return code === "ER_DUP_ENTRY" || causeCode === "ER_DUP_ENTRY";
}

export function createAccountRepository(db: Database): AccountRepository {
  const one = async (condition: ReturnType<typeof eq>) => {
    const [row] = await db.select().from(accounts).where(condition);
    return row;
  };

  return {
    async create(account) {
      const accountId = newId();
      try {
        await db.insert(accounts).values({ ...account, accountId });
      } catch (error) {
        if (isDuplicate(error)) return undefined;
        throw error;
      }
      return one(eq(accounts.accountId, accountId));
    },

    get: (accountId) => one(eq(accounts.accountId, accountId)),
    findByEmail: (email) => one(eq(accounts.email, email)),
    findByGoogleSub: (googleSub) => one(eq(accounts.googleSub, googleSub)),

    async update(accountId, changes) {
      await db.update(accounts).set(changes).where(eq(accounts.accountId, accountId));
    },

    async link(accountId, keys, consentVersion, now) {
      if (keys.length > 0) {
        // Only kept photos qualify, and one already linked elsewhere is never taken over.
        await db
          .update(mediaObjects)
          .set({ ownerAccountId: accountId })
          .where(
            and(
              inArray(mediaObjects.objectKey, keys),
              eq(mediaObjects.savedByUser, true),
              isNull(mediaObjects.ownerAccountId),
              isNull(mediaObjects.deletingAt),
            ),
          );
      }
      await db
        .update(accounts)
        .set({ consentVersion, linkedAt: now })
        .where(eq(accounts.accountId, accountId));
      if (keys.length === 0) return 0;
      const owned = await db
        .select({ key: mediaObjects.objectKey })
        .from(mediaObjects)
        .where(
          and(inArray(mediaObjects.objectKey, keys), eq(mediaObjects.ownerAccountId, accountId)),
        );
      return owned.length;
    },

    async ownedPhotos(accountId) {
      const rows = await db
        .select({ consentVersion: mediaObjects.consentVersion, key: mediaObjects.objectKey })
        .from(mediaObjects)
        .where(eq(mediaObjects.ownerAccountId, accountId));
      return rows;
    },

    async delete(accountId) {
      // One transaction, so a failure part-way never leaves a half-deleted account behind.
      await db.transaction(async (tx) => {
        const owned = tx
          .select({ classId: classes.classId })
          .from(classes)
          .where(eq(classes.ownerAccountId, accountId));
        await tx.delete(classLessons).where(inArray(classLessons.classId, owned));
        await tx.delete(classActivity).where(inArray(classActivity.classId, owned));
        await tx.delete(classes).where(eq(classes.ownerAccountId, accountId));
        await tx.delete(educators).where(eq(educators.accountId, accountId));
        await tx.delete(savedLessons).where(eq(savedLessons.accountId, accountId));
        await tx.delete(tutorTurns).where(eq(tutorTurns.accountId, accountId));
        await tx.delete(accountTokens).where(eq(accountTokens.accountId, accountId));
        await tx.delete(sessions).where(eq(sessions.accountId, accountId));
        await tx
          .update(mediaObjects)
          .set({ ownerAccountId: null })
          .where(eq(mediaObjects.ownerAccountId, accountId));
        await tx.delete(accounts).where(eq(accounts.accountId, accountId));
      });
    },

    async unlink(accountId) {
      const result = await db
        .update(mediaObjects)
        .set({ ownerAccountId: null })
        .where(eq(mediaObjects.ownerAccountId, accountId));
      await db
        .update(accounts)
        .set({ consentVersion: null, linkedAt: null })
        .where(eq(accounts.accountId, accountId));
      return affected(result);
    },
  };
}

export function createSessionRepository(db: Database): SessionRepository {
  return {
    async create(sessionHash, accountId, now, expiresAt) {
      await db.insert(sessions).values({ accountId, createdAt: now, expiresAt, sessionHash });
    },
    async find(sessionHash, now) {
      const [row] = await db
        .select({ accountId: sessions.accountId })
        .from(sessions)
        .where(and(eq(sessions.sessionHash, sessionHash), gt(sessions.expiresAt, now)));
      return row?.accountId;
    },
    async delete(sessionHash) {
      await db.delete(sessions).where(eq(sessions.sessionHash, sessionHash));
    },
    async deleteForAccount(accountId) {
      await db.delete(sessions).where(eq(sessions.accountId, accountId));
    },
    async deleteExpired(now) {
      return affected(await db.delete(sessions).where(lte(sessions.expiresAt, now)));
    },
  };
}

export function createAccountTokenRepository(db: Database): AccountTokenRepository {
  return {
    async issue(tokenHash, accountId, purpose, expiresAt) {
      await db
        .delete(accountTokens)
        .where(and(eq(accountTokens.accountId, accountId), eq(accountTokens.purpose, purpose)));
      await db.insert(accountTokens).values({ accountId, expiresAt, purpose, tokenHash });
    },
    async peek(tokenHash, purpose, now) {
      const [row] = await db
        .select({ accountId: accountTokens.accountId })
        .from(accountTokens)
        .where(
          and(
            eq(accountTokens.tokenHash, tokenHash),
            eq(accountTokens.purpose, purpose),
            gt(accountTokens.expiresAt, now),
          ),
        );
      return row?.accountId;
    },
    async consume(tokenHash, purpose, now) {
      const [row] = await db
        .select()
        .from(accountTokens)
        .where(and(eq(accountTokens.tokenHash, tokenHash), eq(accountTokens.purpose, purpose)));
      if (!row) return undefined;
      // Deleting first means two simultaneous uses cannot both succeed.
      const deleted = affected(
        await db.delete(accountTokens).where(eq(accountTokens.tokenHash, tokenHash)),
      );
      return deleted === 1 && row.expiresAt > now ? row.accountId : undefined;
    },
    async deleteExpired(now) {
      return affected(await db.delete(accountTokens).where(lte(accountTokens.expiresAt, now)));
    },
  };
}
