import { newId } from "@sbi/contracts";
import { and, eq, inArray, isNull } from "drizzle-orm";
import type { Database } from "../client";
import { accounts, mediaObjects } from "../schema";

export interface StoredAccount {
  accountId: string;
  createdAt: Date;
  linkedAt: Date | null;
  consentVersion: string | null;
}

export interface AccountRepository {
  /** First sign-in creates the account; later ones find it. */
  findOrCreate(issuer: string, subject: string, now: Date): Promise<StoredAccount>;
  /** Claims kept, unowned photos for the account; returns how many it now owns of those keys. */
  link(accountId: string, keys: string[], consentVersion: string, now: Date): Promise<number>;
  /** Withdraws the opt-in: photos stay kept but are no longer tied to the account. */
  unlink(accountId: string): Promise<number>;
}

function affected(result: unknown): number {
  const [header] = result as [{ affectedRows?: number }];
  return header.affectedRows ?? 0;
}

function toAccount(row: typeof accounts.$inferSelect): StoredAccount {
  return {
    accountId: row.accountId,
    consentVersion: row.consentVersion,
    createdAt: row.createdAt,
    linkedAt: row.linkedAt,
  };
}

export function createAccountRepository(db: Database): AccountRepository {
  const find = async (issuer: string, subject: string) => {
    const [row] = await db
      .select()
      .from(accounts)
      .where(and(eq(accounts.issuer, issuer), eq(accounts.subject, subject)));
    return row ? toAccount(row) : undefined;
  };

  return {
    async findOrCreate(issuer, subject, now) {
      const existing = await find(issuer, subject);
      if (existing) return existing;
      // Two first requests can race; the unique index keeps one row and both read it back.
      await db
        .insert(accounts)
        .values({ accountId: newId(), createdAt: now, issuer, subject })
        .onDuplicateKeyUpdate({ set: { issuer } });
      const created = await find(issuer, subject);
      if (!created) throw new Error("Account was not created.");
      return created;
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
