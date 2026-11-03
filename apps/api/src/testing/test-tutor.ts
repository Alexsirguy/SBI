import type { TutorTurn } from "@sbi/contracts";
import type { ConversationOwner, TutorTurnRepository } from "@sbi/tutor";

const ownedBy = (owner: ConversationOwner) => (turn: TutorTurn) =>
  "accountId" in owner ? turn.accountId === owner.accountId : turn.sessionId === owner.sessionId;

/** The tutor_turns table in memory, with the same filters as the MariaDB repository. */
export function fakeTutorTurns() {
  const saved: TutorTurn[] = [];
  const remove = (keep: (turn: TutorTurn) => boolean) => {
    const before = saved.length;
    saved.splice(0, saved.length, ...saved.filter(keep));
    return before - saved.length;
  };
  const repository: TutorTurnRepository = {
    save: async (turn) => void saved.push(turn),
    listBySession: async (sessionId) => saved.filter((turn) => turn.sessionId === sessionId),
    listConversation: async (owner, lessonId) =>
      saved.filter((turn) => ownedBy(owner)(turn) && turn.lessonId === lessonId),
    listByAccount: async (accountId) => saved.filter((turn) => turn.accountId === accountId),
    deleteConversation: async (owner, lessonId) =>
      remove((turn) => !(ownedBy(owner)(turn) && turn.lessonId === lessonId)),
    deleteBySession: async (sessionId) => remove((turn) => turn.sessionId !== sessionId),
    deleteCreatedBefore: async (retentionClass, before) =>
      remove(
        (turn) => turn.retentionClass !== retentionClass || new Date(turn.createdAt) >= before,
      ),
  };
  return { saved, repository, remove };
}
