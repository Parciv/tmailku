// Admin API: login, stats, activity, CRUD domains/imap/admins/settings/api-keys/integrations.
import { Hono } from "hono";
import { setCookie, deleteCookie } from "hono/cookie";
import type { Env, Variables } from "../types";
import {
  uid,
  now,
  hashPassword,
  verifyPassword,
  signJwt,
  sha256hex,
} from "../lib/util";
import { requireAdmin } from "../lib/auth";
import { getGroup, setSetting, getAllSettings } from "../lib/settings";
import { createApiKey } from "../lib/apikeys";
import { testConnection, type ImapConfig } from "../imap/client";
import { pollAccount } from "../imap/fetcher";
import { sendTestNotification } from "../lib/notify";
import { addLog } from "../lib/log";

export const adminRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

// ---------- AUTH ----------
adminRoutes.post("/login", async (c) => {
  const { email, password } = await c.req
    .json<{ email: string; password: string }>()
    .catch(() => ({}) as any);
  const row = await c.env.DB.prepare("SELECT * FROM admins WHERE email = ?")
    .bind((email || "").trim().toLowerCase())
    .first<any>();
  if (!row || !(await verifyPassword(password || "", row.password_hash))) {
    return c.json({ error: "email atau password salah" }, 401);
  }
  const exp = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7;
  const token = await signJwt(
    { sub: row.id, email: row.email, role: row.role, exp },
    c.env.JWT_SECRET,
  );
  setCookie(c, "tmk_session", token, {
    httpOnly: true,
    secure: true,
    sameSite: "None",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  await addLog(c.env, "info", "auth", "admin login: " + row.email);
  return c.json({
    ok: true,
    token,
    mustChangePassword: !!row.must_change_password,
  });
});

adminRoutes.post("/logout", async (c) => {
  deleteCookie(c, "tmk_session", { path: "/" });
  return c.json({ ok: true });
});

// semua route di bawah perlu admin
adminRoutes.use("*", requireAdmin);

adminRoutes.get("/me", async (c) => {
  const s = c.get("admin")!;
  const row = await c.env.DB.prepare(
    "SELECT id, email, name, avatar_url, role FROM admins WHERE id = ?",
  )
    .bind(s.sub)
    .first<any>();
  return c.json(row || {});
});

// ---------- PROFIL ----------
adminRoutes.patch("/me", async (c) => {
  const s = c.get("admin")!;
  const b = await c.req.json<any>().catch(() => ({}));
  if (b.name !== undefined)
    await c.env.DB.prepare("UPDATE admins SET name = ? WHERE id = ?")
      .bind(b.name, s.sub)
      .run();
  if (b.email)
    await c.env.DB.prepare("UPDATE admins SET email = ? WHERE id = ?")
      .bind(String(b.email).toLowerCase(), s.sub)
      .run();
  if (b.avatar_url !== undefined)
    await c.env.DB.prepare("UPDATE admins SET avatar_url = ? WHERE id = ?")
      .bind(b.avatar_url, s.sub)
      .run();
  if (b.password)
    await c.env.DB.prepare(
      "UPDATE admins SET password_hash = ?, must_change_password = 0 WHERE id = ?",
    )
      .bind(await hashPassword(b.password), s.sub)
      .run();
  return c.json({ ok: true });
});

// ---------- OVERVIEW ----------
adminRoutes.get("/stats", async (c) => {
  await ensureMailSourceSchema(c.env);
  const totalEmails = await c.env.DB.prepare(
    "SELECT COUNT(*) AS n FROM emails",
  ).first<{ n: number }>();
  const totalAddresses = await c.env.DB.prepare(
    "SELECT COUNT(*) AS n FROM addresses",
  ).first<{ n: number }>();
  const totalDomains = await c.env.DB.prepare(
    "SELECT COUNT(*) AS n FROM domains",
  ).first<{ n: number }>();
  const since = now() - 24 * 3600 * 1000;
  const last24 = await c.env.DB.prepare(
    "SELECT COUNT(*) AS n FROM emails WHERE received_at > ?",
  )
    .bind(since)
    .first<{ n: number }>();
  const { results: perDomain } = await c.env.DB.prepare(
    `SELECT d.domain AS domain, COUNT(e.id) AS count FROM domains d
		 LEFT JOIN addresses a ON a.domain_id = d.id
		 LEFT JOIN emails e ON e.address_id = a.id
		 GROUP BY d.id ORDER BY count DESC`,
  ).all<any>();
  const { results: imap } = await c.env.DB.prepare(
    `SELECT d.domain AS label, i.username, i.enabled, i.last_sync_at, i.last_error
		 FROM imap_settings i
		 LEFT JOIN domains d ON d.id = i.domain_id`,
  )
    .all<any>()
    .catch(() => ({ results: [] as any[] }));
  return c.json({
    totals: {
      emails: totalEmails?.n ?? 0,
      addresses: totalAddresses?.n ?? 0,
      domains: totalDomains?.n ?? 0,
      emails24h: last24?.n ?? 0,
    },
    perDomain: perDomain ?? [],
    imapStatus: imap ?? [],
  });
});

// activity feed + log terminal
adminRoutes.get("/activity", async (c) => {
  const limit = Math.min(Number(c.req.query("limit") || "100"), 300);
  const { results } = await c.env.DB.prepare(
    "SELECT level, scope, message, created_at FROM logs ORDER BY created_at DESC LIMIT ?",
  )
    .bind(limit)
    .all<any>();
  return c.json({ events: results ?? [] });
});

// ---------- DOMAINS / MAIL SOURCES (DOMAIN-CENTRIC) ----------
const routingEndpoint = (url: string) => new URL("/inbound", url).toString();
const boolNum = (v: any) => (v ? 1 : 0);
const modeSource = (imap: any, routing: any) =>
  imap && routing ? "both" : imap ? "imap" : routing ? "routing" : "none";
const legacyStatus = (enabled: any) => (enabled ? "active" : "disabled");
const pollingMinutes = (v: any) => {
  const n = Number(v || 2);
  return [2, 5, 10, 15].includes(n) ? n : 2;
};

async function ensureMailSourceSchema(env: Env) {
  const stmts = [
    "ALTER TABLE domains ADD COLUMN is_verified INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE domains ADD COLUMN is_enabled INTEGER NOT NULL DEFAULT 1",
    "ALTER TABLE domains ADD COLUMN receive_imap_enabled INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE domains ADD COLUMN receive_routing_enabled INTEGER NOT NULL DEFAULT 1",
    "ALTER TABLE domains ADD COLUMN routing_status TEXT NOT NULL DEFAULT 'waiting'",
    "ALTER TABLE domains ADD COLUMN routing_last_email_at INTEGER",
    "ALTER TABLE domains ADD COLUMN updated_at INTEGER",
    `CREATE TABLE IF NOT EXISTS imap_settings (
			id TEXT PRIMARY KEY,
			domain_id TEXT UNIQUE REFERENCES domains(id),
			host TEXT NOT NULL,
			port INTEGER NOT NULL DEFAULT 993,
			encryption TEXT NOT NULL DEFAULT 'ssl',
			username TEXT NOT NULL,
			password_encrypted TEXT NOT NULL,
			folder TEXT NOT NULL DEFAULT 'INBOX',
			polling_interval_minutes INTEGER NOT NULL DEFAULT 2,
			enabled INTEGER NOT NULL DEFAULT 1,
			last_uid INTEGER NOT NULL DEFAULT 0,
			last_sync_at INTEGER,
			last_test_status TEXT,
			last_error TEXT,
			created_at INTEGER NOT NULL,
			updated_at INTEGER
		)`,
  ];
  for (const stmt of stmts)
    await env.DB.prepare(stmt)
      .run()
      .catch(() => {});
  await env.DB.prepare(
    `UPDATE domains SET
			is_verified = COALESCE(is_verified, verified, 0),
			is_enabled = CASE WHEN COALESCE(status, 'active') = 'disabled' THEN 0 ELSE COALESCE(is_enabled, 1) END,
			receive_imap_enabled = CASE WHEN COALESCE(source, '') IN ('imap', 'both') THEN 1 ELSE COALESCE(receive_imap_enabled, 0) END,
			receive_routing_enabled = CASE WHEN COALESCE(source, '') IN ('routing', 'both') THEN 1 ELSE COALESCE(receive_routing_enabled, 0) END,
			updated_at = COALESCE(updated_at, created_at)
		WHERE updated_at IS NULL`,
  )
    .run()
    .catch(() => {});
  await env.DB.prepare(
    `INSERT OR IGNORE INTO imap_settings (id, domain_id, host, port, encryption, username, password_encrypted, folder, polling_interval_minutes, enabled, last_uid, last_sync_at, last_error, created_at, updated_at)
		 SELECT id, domain_id, hostname, port, encryption, username, password, folder,
		        CASE WHEN poll_interval >= 60 THEN CAST(poll_interval / 60 AS INTEGER) ELSE 2 END,
		        enabled, last_uid, last_sync_at, last_error, COALESCE(last_sync_at, 0), COALESCE(last_sync_at, 0)
		 FROM imap_accounts
		 WHERE domain_id IS NOT NULL`,
  )
    .run()
    .catch(() => {});
}

function imapForTest(row: any): ImapConfig {
  return {
    hostname: row.host || row.hostname,
    port: row.port,
    encryption: row.encryption,
    username: row.username,
    password: row.password_encrypted || row.password,
    folder: row.folder || "INBOX",
  };
}

adminRoutes.get("/domains", async (c) => {
  await ensureMailSourceSchema(c.env);
  const { results } = await c.env.DB.prepare(
    `SELECT d.*,
			COALESCE(d.is_verified, d.verified, 0) AS is_verified,
			CASE WHEN COALESCE(d.status, 'active') = 'disabled' THEN 0 ELSE COALESCE(d.is_enabled, 1) END AS is_enabled,
			COALESCE(d.receive_imap_enabled, CASE WHEN d.source IN ('imap','both') THEN 1 ELSE 0 END) AS receive_imap_enabled,
			COALESCE(d.receive_routing_enabled, CASE WHEN d.source IN ('routing','both') THEN 1 ELSE 0 END) AS receive_routing_enabled,
			COUNT(DISTINCT a.id) AS alias_count,
			MAX(e.received_at) AS last_email_at,
			i.id AS imap_id, i.host AS imap_host, i.port AS imap_port, i.encryption AS imap_encryption,
			i.username AS imap_username, i.folder AS imap_folder,
			i.polling_interval_minutes AS imap_polling_interval_minutes,
			i.enabled AS imap_enabled, i.last_sync_at AS imap_last_sync_at,
			i.last_test_status AS imap_last_test_status, i.last_error AS imap_last_error
		 FROM domains d
		 LEFT JOIN addresses a ON a.domain_id = d.id
		 LEFT JOIN emails e ON e.address_id = a.id
		 LEFT JOIN imap_settings i ON i.domain_id = d.id
		 GROUP BY d.id
		 ORDER BY d.created_at DESC`,
  ).all<any>();
  const domains = (results ?? []).map((d: any) => ({
    ...d,
    verified: !!d.is_verified,
    status: d.is_enabled ? "active" : "disabled",
    routingEndpoint: routingEndpoint(c.req.url),
    imap: d.imap_id
      ? {
          id: d.imap_id,
          host: d.imap_host,
          port: d.imap_port,
          encryption: d.imap_encryption,
          username: d.imap_username,
          folder: d.imap_folder,
          polling_interval_minutes: d.imap_polling_interval_minutes,
          enabled: !!d.imap_enabled,
          last_sync_at: d.imap_last_sync_at,
          last_test_status: d.imap_last_test_status,
          last_error: d.imap_last_error,
        }
      : null,
  }));
  return c.json({ domains, routingEndpoint: routingEndpoint(c.req.url) });
});

adminRoutes.post("/domains", async (c) => {
  await ensureMailSourceSchema(c.env);
  const b = await c.req.json<any>().catch(() => ({}));
  const domain = (b.domain || "").trim().toLowerCase();
  if (!domain) return c.json({ error: "domain wajib" }, 400);
  const imapEnabled = !!b.receive_imap_enabled;
  const routingEnabled = !!b.receive_routing_enabled;
  const imap = b.imap || {};
  if (imapEnabled && (!imap.host || !imap.username || !imap.password))
    return c.json({ error: "IMAP host/username/password wajib" }, 400);
  const id = uid("dom");
  await c.env.DB.prepare(
    `INSERT INTO domains (id, domain, source, status, verified, is_verified, is_enabled, receive_imap_enabled, receive_routing_enabled, routing_status, created_at, updated_at)
		 VALUES (?, ?, ?, 'active', 0, 0, 1, ?, ?, ?, ?, ?)`,
  )
    .bind(
      id,
      domain,
      modeSource(imapEnabled, routingEnabled),
      boolNum(imapEnabled),
      boolNum(routingEnabled),
      routingEnabled ? "waiting" : "disabled",
      now(),
      now(),
    )
    .run();
  if (imapEnabled) {
    await c.env.DB.prepare(
      `INSERT INTO imap_settings (id, domain_id, host, port, encryption, username, password_encrypted, folder, polling_interval_minutes, enabled, created_at, updated_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
    )
      .bind(
        uid("imap"),
        id,
        imap.host,
        Number(imap.port || 993),
        imap.encryption || "ssl",
        imap.username,
        imap.password,
        imap.folder || "INBOX",
        pollingMinutes(imap.polling_interval_minutes),
        now(),
        now(),
      )
      .run();
  }
  await addLog(c.env, "info", "domain", "domain ditambah: " + domain);
  return c.json({ ok: true, id, routingEndpoint: routingEndpoint(c.req.url) });
});

adminRoutes.post("/domains/imap/test", async (c) => {
  await ensureMailSourceSchema(c.env);
  const b = await c.req.json<any>().catch(() => ({}));
  const imap = b.imap || b;
  if (!imap.host || !imap.username || !imap.password)
    return c.json({ error: "IMAP host/username/password wajib" }, 400);
  const res = await testConnection(
    imapForTest({ ...imap, password_encrypted: imap.password }),
  );
  return c.json(res);
});

adminRoutes.patch("/domains/:id", async (c) => {
  await ensureMailSourceSchema(c.env);
  const id = c.req.param("id");
  const b = await c.req.json<any>().catch(() => ({}));
  const cur = await c.env.DB.prepare("SELECT * FROM domains WHERE id = ?")
    .bind(id)
    .first<any>();
  if (!cur) return c.json({ error: "not found" }, 404);
  const imapEnabled =
    b.receive_imap_enabled !== undefined
      ? !!b.receive_imap_enabled
      : !!cur.receive_imap_enabled;
  const routingEnabled =
    b.receive_routing_enabled !== undefined
      ? !!b.receive_routing_enabled
      : !!cur.receive_routing_enabled;
  const enabled =
    b.is_enabled !== undefined
      ? !!b.is_enabled
      : b.status !== undefined
        ? b.status === "active"
        : cur.status !== "disabled";
  const fields: string[] = ["updated_at = ?"];
  const vals: any[] = [now()];
  const setField = (k: string, v: any) => {
    fields.push(k + " = ?");
    vals.push(v);
  };
  if (b.domain !== undefined)
    setField("domain", String(b.domain).trim().toLowerCase());
  setField("is_enabled", boolNum(enabled));
  setField("status", legacyStatus(enabled));
  setField("receive_imap_enabled", boolNum(imapEnabled));
  setField("receive_routing_enabled", boolNum(routingEnabled));
  setField("source", modeSource(imapEnabled, routingEnabled));
  if (b.verified !== undefined || b.is_verified !== undefined) {
    const verified = !!(b.is_verified ?? b.verified);
    setField("is_verified", boolNum(verified));
    setField("verified", boolNum(verified));
  }
  if (!routingEnabled) setField("routing_status", "disabled");
  else if (b.routing_status !== undefined)
    setField("routing_status", b.routing_status);
  vals.push(id);
  await c.env.DB.prepare(
    "UPDATE domains SET " + fields.join(", ") + " WHERE id = ?",
  )
    .bind(...vals)
    .run();

  if (b.imap) {
    const imap = b.imap;
    const existing = await c.env.DB.prepare(
      "SELECT id FROM imap_settings WHERE domain_id = ?",
    )
      .bind(id)
      .first<any>();
    if (existing) {
      const f: string[] = ["updated_at = ?"];
      const v: any[] = [now()];
      for (const [apiKey, dbKey] of [
        ["host", "host"],
        ["port", "port"],
        ["encryption", "encryption"],
        ["username", "username"],
        ["password", "password_encrypted"],
        ["folder", "folder"],
        ["polling_interval_minutes", "polling_interval_minutes"],
      ] as any) {
        if (imap[apiKey] !== undefined && imap[apiKey] !== "") {
          f.push(dbKey + " = ?");
          v.push(
            apiKey === "polling_interval_minutes"
              ? pollingMinutes(imap[apiKey])
              : imap[apiKey],
          );
        }
      }
      f.push("enabled = ?");
      v.push(boolNum(imapEnabled));
      v.push(existing.id);
      await c.env.DB.prepare(
        "UPDATE imap_settings SET " + f.join(", ") + " WHERE id = ?",
      )
        .bind(...v)
        .run();
    } else if (imapEnabled) {
      if (!imap.host || !imap.username || !imap.password)
        return c.json({ error: "IMAP host/username/password wajib" }, 400);
      await c.env.DB.prepare(
        `INSERT INTO imap_settings (id, domain_id, host, port, encryption, username, password_encrypted, folder, polling_interval_minutes, enabled, created_at, updated_at)
				 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
      )
        .bind(
          uid("imap"),
          id,
          imap.host,
          Number(imap.port || 993),
          imap.encryption || "ssl",
          imap.username,
          imap.password,
          imap.folder || "INBOX",
          pollingMinutes(imap.polling_interval_minutes),
          now(),
          now(),
        )
        .run();
    }
  } else if (b.receive_imap_enabled !== undefined) {
    await c.env.DB.prepare(
      "UPDATE imap_settings SET enabled = ?, updated_at = ? WHERE domain_id = ?",
    )
      .bind(boolNum(imapEnabled), now(), id)
      .run();
  }
  return c.json({ ok: true });
});

adminRoutes.post("/domains/:id/verify", async (c) => {
  await ensureMailSourceSchema(c.env);
  const row = await c.env.DB.prepare("SELECT domain FROM domains WHERE id = ?")
    .bind(c.req.param("id"))
    .first<any>();
  if (!row) return c.json({ error: "not found" }, 404);
  let verified = false;
  try {
    const r = await fetch(
      "https://cloudflare-dns.com/dns-query?name=" + row.domain + "&type=MX",
      {
        headers: { accept: "application/dns-json" },
      },
    );
    const data = await r.json<any>();
    verified =
      Array.isArray(data.Answer) &&
      data.Answer.some((a: any) =>
        /mx\..*cloudflare|route\d?\.mx\.cloudflare/i.test(a.data || ""),
      );
  } catch {}
  await c.env.DB.prepare(
    "UPDATE domains SET verified = ?, is_verified = ?, updated_at = ? WHERE id = ?",
  )
    .bind(verified ? 1 : 0, verified ? 1 : 0, now(), c.req.param("id"))
    .run();
  return c.json({ verified });
});

adminRoutes.delete("/domains/:id", async (c) => {
  await ensureMailSourceSchema(c.env);
  await c.env.DB.prepare("DELETE FROM imap_settings WHERE domain_id = ?")
    .bind(c.req.param("id"))
    .run();
  await c.env.DB.prepare("DELETE FROM domains WHERE id = ?")
    .bind(c.req.param("id"))
    .run();
  return c.json({ ok: true });
});

adminRoutes.post("/domains/:id/imap/test", async (c) => {
  await ensureMailSourceSchema(c.env);
  const body = await c.req.json<any>().catch(() => null);
  let row = body?.imap
    ? { ...body.imap, password_encrypted: body.imap.password }
    : null;
  if (!row)
    row = await c.env.DB.prepare(
      "SELECT * FROM imap_settings WHERE domain_id = ?",
    )
      .bind(c.req.param("id"))
      .first<any>();
  if (!row) return c.json({ error: "imap not configured" }, 404);
  const res = await testConnection(imapForTest(row));
  await c.env.DB.prepare(
    "UPDATE imap_settings SET last_test_status = ?, last_error = ?, updated_at = ? WHERE domain_id = ?",
  )
    .bind(
      res.ok ? "success" : "failed",
      res.ok ? null : res.error || "connection failed",
      now(),
      c.req.param("id"),
    )
    .run()
    .catch(() => {});
  return c.json(res);
});

adminRoutes.post("/domains/:id/imap/sync", async (c) => {
  await ensureMailSourceSchema(c.env);
  const row = await c.env.DB.prepare(
    "SELECT * FROM imap_settings WHERE domain_id = ?",
  )
    .bind(c.req.param("id"))
    .first<any>();
  if (!row) return c.json({ error: "imap not configured" }, 404);
  try {
    const count = await pollAccount(c.env, {
      ...row,
      hostname: row.host,
      password: row.password_encrypted,
      poll_interval: (row.polling_interval_minutes || 2) * 60,
    });
    return c.json({ ok: true, fetched: count });
  } catch (e: any) {
    return c.json({ ok: false, error: String(e?.message || e) }, 500);
  }
});

// Legacy IMAP routes kept for backward compatibility; UI no longer uses them.
adminRoutes.get("/imap-accounts", async (c) => c.json({ accounts: [] }));
adminRoutes.post("/imap-accounts", async (c) =>
  c.json({ error: "IMAP sekarang dikonfigurasi di dalam domain" }, 410),
);
adminRoutes.patch("/imap-accounts/:id", async (c) =>
  c.json({ error: "IMAP sekarang dikonfigurasi di dalam domain" }, 410),
);
adminRoutes.delete("/imap-accounts/:id", async (c) =>
  c.json({ error: "IMAP sekarang dikonfigurasi di dalam domain" }, 410),
);
adminRoutes.post("/imap-accounts/:id/test", async (c) =>
  c.json({ error: "IMAP sekarang dikonfigurasi di dalam domain" }, 410),
);
adminRoutes.post("/imap-accounts/:id/sync", async (c) =>
  c.json({ error: "IMAP sekarang dikonfigurasi di dalam domain" }, 410),
);

// ---------- ADMINS ----------
adminRoutes.get("/admins", async (c) => {
  const { results } = await c.env.DB.prepare(
    "SELECT id, email, name, role, created_at FROM admins",
  ).all<any>();
  return c.json({ admins: results ?? [] });
});

adminRoutes.post("/admins", async (c) => {
  const b = await c.req.json<any>().catch(() => ({}));
  if (!b.email || !b.password)
    return c.json({ error: "email & password wajib" }, 400);
  const id = uid("adm");
  await c.env.DB.prepare(
    "INSERT INTO admins (id, email, password_hash, name, role, must_change_password, created_at) VALUES (?, ?, ?, ?, ?, 1, ?)",
  )
    .bind(
      id,
      String(b.email).toLowerCase(),
      await hashPassword(b.password),
      b.name || "",
      b.role || "admin",
      now(),
    )
    .run();
  return c.json({ ok: true, id });
});

adminRoutes.delete("/admins/:id", async (c) => {
  const s = c.get("admin")!;
  if (s.sub === c.req.param("id"))
    return c.json({ error: "tidak bisa hapus diri sendiri" }, 400);
  await c.env.DB.prepare("DELETE FROM admins WHERE id = ?")
    .bind(c.req.param("id"))
    .run();
  return c.json({ ok: true });
});

// ---------- SETTINGS (branding/security/system) ----------
adminRoutes.get("/settings", async (c) => {
  const group = c.req.query("group");
  if (group) return c.json({ settings: await getGroup(c.env, group) });
  return c.json({ settings: await getAllSettings(c.env) });
});

adminRoutes.put("/settings", async (c) => {
  const b = await c.req.json<Record<string, string>>().catch(() => ({}));
  for (const [k, v] of Object.entries(b)) {
    // lock password: simpan sebagai hash
    if (k === "site_lock_password" && v) {
      await setSetting(c.env, "site_lock_password_hash", await sha256hex(v));
      continue;
    }
    await setSetting(c.env, k, String(v));
  }
  await addLog(c.env, "info", "settings", "settings diperbarui");
  return c.json({ ok: true });
});

// ---------- UPLOAD ASET BRANDING (logo/favicon) ----------
adminRoutes.post("/upload", async (c) => {
  const form = await c.req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File))
    return c.json({ error: "file tidak ditemukan" }, 400);
  if (file.size > 2 * 1024 * 1024)
    return c.json({ error: "file terlalu besar (maks 2MB)" }, 400);
  const id = uid("brand");
  const buf = new Uint8Array(await file.arrayBuffer());
  await c.env.R2.put("brand/" + id, buf, {
    httpMetadata: { contentType: file.type || "application/octet-stream" },
  });
  const origin = new URL(c.req.url).origin;
  await addLog(c.env, "info", "settings", "aset branding diupload");
  return c.json({ url: origin + "/api/asset/" + id });
});

// ---------- API KEYS ----------
adminRoutes.get("/api-keys", async (c) => {
  const { results } = await c.env.DB.prepare(
    "SELECT id, name, key_prefix, scopes, rate_limit, enabled, last_used_at, expires_at, created_at FROM api_keys ORDER BY created_at DESC",
  ).all<any>();
  return c.json({ keys: results ?? [] });
});

adminRoutes.post("/api-keys", async (c) => {
  const b = await c.req.json<any>().catch(() => ({}));
  const created = await createApiKey(c.env, {
    name: b.name || "key",
    scopes: b.scopes || ["address:create", "inbox:read"],
    rate_limit: b.rate_limit || 60,
    expires_at: b.expires_at || null,
  });
  // plaintext hanya dikirim sekali
  return c.json(created);
});

adminRoutes.patch("/api-keys/:id", async (c) => {
  const b = await c.req.json<any>().catch(() => ({}));
  if (b.enabled !== undefined)
    await c.env.DB.prepare("UPDATE api_keys SET enabled = ? WHERE id = ?")
      .bind(b.enabled ? 1 : 0, c.req.param("id"))
      .run();
  if (b.rate_limit !== undefined)
    await c.env.DB.prepare("UPDATE api_keys SET rate_limit = ? WHERE id = ?")
      .bind(b.rate_limit, c.req.param("id"))
      .run();
  if (b.scopes !== undefined)
    await c.env.DB.prepare("UPDATE api_keys SET scopes = ? WHERE id = ?")
      .bind(JSON.stringify(b.scopes), c.req.param("id"))
      .run();
  return c.json({ ok: true });
});

adminRoutes.delete("/api-keys/:id", async (c) => {
  await c.env.DB.prepare("DELETE FROM api_keys WHERE id = ?")
    .bind(c.req.param("id"))
    .run();
  return c.json({ ok: true });
});

// ---------- INTEGRATIONS ----------
adminRoutes.get("/integrations", async (c) => {
  return c.json({ settings: await getGroup(c.env, "integrations") });
});

adminRoutes.put("/integrations", async (c) => {
  const b = await c.req.json<Record<string, string>>().catch(() => ({}));
  for (const [k, v] of Object.entries(b)) await setSetting(c.env, k, String(v));
  return c.json({ ok: true });
});

adminRoutes.post("/integrations/test", async (c) => {
  return c.json(await sendTestNotification(c.env));
});