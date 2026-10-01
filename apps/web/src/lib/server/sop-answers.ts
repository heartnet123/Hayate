import { getDatabase } from "$lib/server/auth";
import { SOP_BODY_MAX_LENGTH } from "$lib/server/sop";
import { ensureSopSchema } from "$lib/server/sop-schema";

export interface EligibleSop {
  readonly body: string;
  readonly sopId: number;
  readonly title: string;
  readonly versionId: number;
}

export const listEligibleSops = (): readonly EligibleSop[] => {
  ensureSopSchema();
  return getDatabase()
    .prepare(
      `SELECT sops.id AS sopId, sop_versions.id AS versionId,
        sop_versions.title, sop_versions.body
       FROM sops JOIN sop_versions ON sop_versions.id = sops.active_version_id
       WHERE sops.status = 'active' ORDER BY sops.id`
    )
    .all()
    .map((row) => ({
      body: String(row.body),
      sopId: Number(row.sopId),
      title: String(row.title),
      versionId: Number(row.versionId),
    }));
};

export const recordSopAnswer = (
  ticketId: number,
  versionId: number,
  answerBody: string
): "recorded" | "ineligible" => {
  const body = answerBody.trim();
  if (
    !Number.isSafeInteger(ticketId) ||
    ticketId < 1 ||
    !Number.isSafeInteger(versionId) ||
    versionId < 1 ||
    body.length < 1 ||
    body.length > SOP_BODY_MAX_LENGTH
  ) {
    return "ineligible";
  }
  ensureSopSchema();
  const result = getDatabase()
    .prepare(
      `INSERT INTO sop_answers (ticket_id, version_id, body)
       SELECT tickets.id, sop_versions.id, ?
       FROM tickets
       JOIN sop_versions ON sop_versions.id = ?
       JOIN sops ON sops.id = sop_versions.sop_id
       WHERE tickets.id = ? AND sops.status = 'active'
         AND sops.active_version_id = sop_versions.id`
    )
    .run(body, versionId, ticketId);
  return result.changes === 1 ? "recorded" : "ineligible";
};
