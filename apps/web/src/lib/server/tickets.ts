import { getDatabase } from "./auth";

export const claimTicket = (ticketId: number, agentId: number) => {
  const db = getDatabase();
  const claimed =
    db
      .prepare(
        "UPDATE tickets SET assignee_id = ? WHERE id = ? AND assignee_id IS NULL"
      )
      .run(agentId, ticketId).changes === 1;
  if (claimed) {
    return { claimed: true, owner: agentId };
  }
  const row = db
    .prepare("SELECT assignee_id FROM tickets WHERE id = ?")
    .get(ticketId);
  return {
    claimed: false,
    owner: typeof row?.assignee_id === "number" ? row.assignee_id : null,
  };
};

export const listAssignedTickets = (agentId: number) => {
  const db = getDatabase();
  const rows = db
    .prepare(`
    SELECT tickets.id, tickets.request_id AS requestId, tickets.reason,
      slack_requests.workspace, slack_requests.channel,
      slack_requests.thread_ts AS threadTs, slack_requests.owner_name AS ownerName,
      official_replies.body AS draft, official_replies.status AS deliveryStatus,
      official_replies.slack_ts AS slackTs, official_replies.error AS deliveryError
    FROM tickets JOIN slack_requests ON slack_requests.id = tickets.request_id
    LEFT JOIN official_replies ON official_replies.ticket_id = tickets.id
    WHERE tickets.assignee_id = ? ORDER BY tickets.id ASC
  `)
    .all(agentId);
  const messages = db.prepare(`
    SELECT user_name AS userName, message_ts AS messageTs, body
    FROM slack_messages WHERE request_id = ? ORDER BY message_ts ASC, id ASC
  `);
  return rows.map((row) => ({
    channel: String(row.channel),
    deliveryError:
      typeof row.deliveryError === "string" ? row.deliveryError : "",
    deliveryStatus:
      typeof row.deliveryStatus === "string" ? row.deliveryStatus : "draft",
    draft: typeof row.draft === "string" ? row.draft : "",
    id: Number(row.id),
    messages: messages.all(Number(row.requestId)).map((message) => ({
      body: String(message.body),
      messageTs: String(message.messageTs),
      userName: String(message.userName),
    })),
    ownerName: String(row.ownerName),
    reason: String(row.reason),
    slackTs: typeof row.slackTs === "string" ? row.slackTs : "",
    threadTs: String(row.threadTs),
    workspace: String(row.workspace),
  }));
};

export const listSupportTickets = () => {
  const db = getDatabase();
  const notes = db.prepare(`
    SELECT internal_notes.id, internal_notes.body, internal_notes.created_at AS createdAt,
      users.email AS author
    FROM internal_notes JOIN users ON users.id = internal_notes.author_id
    WHERE internal_notes.ticket_id = ? ORDER BY internal_notes.created_at, internal_notes.id
  `);
  return db
    .prepare(`
      SELECT tickets.id, tickets.reason, slack_requests.owner_name AS ownerName
      FROM tickets JOIN slack_requests ON slack_requests.id = tickets.request_id
      ORDER BY tickets.id DESC
    `)
    .all()
    .map((ticket) => ({
      id: Number(ticket.id),
      notes: notes.all(Number(ticket.id)).map((note) => ({
        author: String(note.author),
        body: String(note.body),
        createdAt: String(note.createdAt),
        id: Number(note.id),
      })),
      ownerName: String(ticket.ownerName),
      reason: String(ticket.reason),
    }));
};

export const addInternalNote = (
  ticketId: number,
  authorId: number,
  body: string
) =>
  getDatabase()
    .prepare(`
      INSERT INTO internal_notes (ticket_id, author_id, body)
      SELECT tickets.id, users.id, ? FROM tickets JOIN users ON users.id = ?
      WHERE tickets.id = ? AND users.role IN ('admin', 'agent')
    `)
    .run(body, authorId, ticketId).changes === 1;
