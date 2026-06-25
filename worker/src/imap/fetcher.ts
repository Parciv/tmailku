// Loop semua akun IMAP aktif, fetch email baru, parse, simpan.
import PostalMime from "postal-mime";
import type { Env } from "../types";
import { ImapClient, type ImapConfig } from "./client";
import { storeEmail, type ParsedEmail } from "../lib/storage";
import { addLog } from "../lib/log";
import { now } from "../lib/util";

export async function pollAllImap(env: Env): Promise<void> {
  const { results } = await env.DB.prepare(
    `SELECT i.*, i.host AS hostname, i.password_encrypted AS password, (i.polling_interval_minutes * 60) AS poll_interval, d.domain
		 FROM imap_settings i
		 JOIN domains d ON d.id = i.domain_id
		 WHERE i.enabled = 1
		   AND COALESCE(d.receive_imap_enabled, 0) = 1
		   AND COALESCE(d.is_enabled, CASE WHEN d.status = 'disabled' THEN 0 ELSE 1 END) = 1`,
  )
    .all<any>()
    .catch(() => ({ results: [] as any[] }));
  for (const acc of results ?? []) {
    const intervalMs =
      (Number(acc.polling_interval_minutes || 2) || 2) * 60 * 1000;
    if (acc.last_sync_at && now() - Number(acc.last_sync_at) < intervalMs)
      continue;
    await pollAccount(env, acc).catch(async (e) => {
      await env.DB.prepare(
        "UPDATE imap_settings SET last_error = ?, last_sync_at = ?, last_test_status = ?, updated_at = ? WHERE id = ?",
      )
        .bind(String(e?.message || e), now(), "failed", now(), acc.id)
        .run();
      await addLog(
        env,
        "error",
        "imap",
        "sync gagal " + (acc.domain || acc.username) + ": " + (e?.message || e),
      );
    });
  }
}

export async function pollAccount(env: Env, acc: any): Promise<number> {
  const cfg: ImapConfig = {
    hostname: acc.hostname,
    port: acc.port,
    encryption: acc.encryption,
    username: acc.username,
    password: acc.password,
    folder: acc.folder || "INBOX",
  };
  const client = new ImapClient(cfg);
  let count = 0;
  await client.connect();
  try {
    await client.login();
    await client.selectFolder();
    const sinceUid = acc.force ? Math.max(0, Number(acc.last_uid || 0) - 50) : Number(acc.last_uid || 0);
    const uids = await client.searchSince(sinceUid);
    let maxUid = acc.last_uid || 0;
    for (const uid of uids.slice(0, 25)) {
      const raw = await client.fetchMessage(uid);
      if (raw) {
        const parsed = await parseRaw(raw, acc.domain);
        if (parsed) {
          const stored = await storeEmail(env, "imap", parsed);
          if (stored) count++;
        }
      }
      if (uid > maxUid) maxUid = uid;
    }
    await env.DB.prepare(
      "UPDATE imap_settings SET last_uid = ?, last_sync_at = ?, last_error = NULL, last_test_status = ?, updated_at = ? WHERE id = ?",
    )
      .bind(maxUid, now(), "success", now(), acc.id)
      .run();
    if (count > 0)
      await addLog(
        env,
        "info",
        "imap",
        "sync " + (acc.domain || acc.username) + ": " + count + " email baru",
      );
  } finally {
    await client.logout();
  }
  return count;
}

async function parseRaw(raw: Uint8Array, domain?: string): Promise<ParsedEmail | null> {
  try {
    const email = await PostalMime.parse(raw);
    const rawText = new TextDecoder().decode(raw);
    const to = pickRecipient(email, rawText, domain);
    if (!to) return null;
    return {
      messageId: email.messageId,
      fromAddr: email.from?.address,
      fromName: email.from?.name,
      toAddr: to,
      subject: email.subject,
      text: email.text,
      html: email.html || undefined,
      attachments: (email.attachments || []).map((a: any) => ({
        filename: a.filename,
        mimeType: a.mimeType,
        content: a.content,
      })),
      raw,
    };
  } catch {
    return null;
  }
}

function pickRecipient(email: any, rawText: string, domain?: string): string {
  const candidates = new Set<string>();
  const add = (v?: string) => {
    const s = String(v || "").trim().toLowerCase();
    const m = s.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i);
    if (m) candidates.add(m[0].toLowerCase());
  };

  for (const r of email.to || []) add(r.address);
  for (const r of email.cc || []) add(r.address);
  for (const r of email.bcc || []) add(r.address);

  for (const header of [
    "delivered-to",
    "x-original-to",
    "x-envelope-to",
    "envelope-to",
    "apparently-to",
    "original-recipient",
    "to",
    "cc",
  ]) {
    const re = new RegExp("^" + header + ":\\s*(.+)$", "gim");
    let m: RegExpExecArray | null;
    while ((m = re.exec(rawText))) add(m[1]);
  }

  const wanted = String(domain || "").toLowerCase();
  if (wanted) {
    const match = [...candidates].find((addr) => addr.endsWith("@" + wanted));
    if (match) return match;
  }
  return [...candidates][0] || "";
}
