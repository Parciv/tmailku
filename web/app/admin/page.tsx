"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Mail,
  Palette,
  ShieldCheck,
  KeyRound,
  Settings,
  Plug,
  LogOut,
  User,
  Plus,
  Trash2,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Eye,
  EyeOff,
  Send,
  Globe,
} from "lucide-react";
import { api } from "@/lib/api";

type Tab =
  | "overview"
  | "sources"
  | "appearance"
  | "security"
  | "api"
  | "system"
  | "integrations";

const NAV: { id: Tab; label: string; icon: any }[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "sources", label: "Mail Sources", icon: Mail },
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "security", label: "Access & Security", icon: ShieldCheck },
  { id: "api", label: "API", icon: KeyRound },
  { id: "integrations", label: "Integrations", icon: Plug },
  { id: "system", label: "System", icon: Settings },
];

export default function AdminPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("overview");
  const [me, setMe] = useState<any>(null);
  const [showProfile, setShowProfile] = useState(false);

  useEffect(() => {
    api
      .me()
      .then(setMe)
      .catch(() => router.replace("/admin/login"));
  }, [router]);

  async function logout() {
    await api.logout().catch(() => {});
    localStorage.removeItem("tmailku.token");
    router.replace("/admin/login");
  }

  return (
    <div className="flex min-h-screen">
      <aside className="w-56 p-4 border-r border-white/10 hidden md:block">
        <div className="font-bold text-lg mb-6 px-2">TMailku Admin</div>
        <nav className="space-y-1">
          {NAV.map((n) => (
            <button
              key={n.id}
              onClick={() => setTab(n.id)}
              className={
                "btn w-full justify-start " +
                (tab === n.id ? "btn-primary" : "btn-ghost")
              }
            >
              <n.icon size={16} /> {n.label}
            </button>
          ))}
        </nav>
      </aside>
      <main className="flex-1 p-5 max-w-4xl">
        <header className="flex items-center justify-between mb-6">
          <select
            className="md:hidden w-auto"
            value={tab}
            onChange={(e) => setTab(e.target.value as Tab)}
          >
            {NAV.map((n) => (
              <option key={n.id} value={n.id}>
                {n.label}
              </option>
            ))}
          </select>
          <div className="font-semibold hidden md:block">
            {NAV.find((n) => n.id === tab)?.label}
          </div>
          <div className="relative">
            <button
              className="btn btn-ghost"
              onClick={() => setShowProfile((s) => !s)}
            >
              <User size={16} /> {me?.name || me?.email || "Admin"}
            </button>
            {showProfile && (
              <div className="glass absolute right-0 mt-1 p-3 min-w-[240px] z-10">
                <ProfileMenu me={me} onSaved={() => api.me().then(setMe)} />
                <button className="btn btn-ghost w-full mt-2" onClick={logout}>
                  <LogOut size={14} /> Keluar
                </button>
              </div>
            )}
          </div>
        </header>
        {tab === "overview" && <Overview />}
        {tab === "sources" && <MailSources />}
        {tab === "appearance" && <Appearance />}
        {tab === "security" && <Security />}
        {tab === "api" && <ApiKeys />}
        {tab === "integrations" && <Integrations />}
        {tab === "system" && <SystemTab />}
      </main>
    </div>
  );
}

function ProfileMenu({ me, onSaved }: { me: any; onSaved: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  useEffect(() => setEmail(me?.email || ""), [me]);
  async function save() {
    await api.updateProfile({ email, ...(password ? { password } : {}) });
    setPassword("");
    onSaved();
    alert("Profil disimpan");
  }
  return (
    <div className="space-y-2">
      <div className="text-xs opacity-70">Ubah Profil</div>
      <input
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
      />
      <div className="relative">
        <input
          type={show ? "text" : "password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password baru"
        />
        <button
          type="button"
          className="absolute right-2 top-2.5"
          onClick={() => setShow((s) => !s)}
        >
          {show ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
      </div>
      <button className="btn btn-primary w-full" onClick={save}>
        Simpan
      </button>
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="glass p-4">{children}</div>;
}

function Overview() {
  const [stats, setStats] = useState<any>(null);
  const [events, setEvents] = useState<any[]>([]);
  useEffect(() => {
    const load = () => {
      api
        .stats()
        .then(setStats)
        .catch(() => {});
      api
        .activity()
        .then((a) => setEvents(a.events))
        .catch(() => {});
    };
    load();
    const iv = setInterval(load, 10000);
    return () => clearInterval(iv);
  }, []);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Email" value={stats?.totals?.emails} />
        <Stat label="Alamat" value={stats?.totals?.addresses} />
        <Stat label="Domain" value={stats?.totals?.domains} />
        <Stat label="Email 24 jam" value={stats?.totals?.emails24h} />
      </div>
      <Card>
        <div className="text-sm font-semibold mb-2">Status Mail Sources</div>
        {(stats?.imapStatus || []).length === 0 ? (
          <div className="opacity-60 text-sm">Belum ada sumber IMAP.</div>
        ) : (
          (stats?.imapStatus || []).map((s: any, i: number) => (
            <div
              key={i}
              className="flex items-center justify-between text-sm py-1"
            >
              <span>{s.label || s.username}</span>
              <span className="pill">
                {s.last_error ? (
                  <XCircle size={12} className="text-red-400" />
                ) : (
                  <CheckCircle2 size={12} className="text-secondary" />
                )}{" "}
                {s.last_error ? "error" : "ok"}
              </span>
            </div>
          ))
        )}
      </Card>
      <Card>
        <div className="text-sm font-semibold mb-2">Aktivitas / Log</div>
        <div className="mono text-xs bg-black/40 rounded-lg p-3 h-64 overflow-auto space-y-1">
          {events.length === 0 ? (
            <div className="opacity-50">$ menunggu aktivitas...</div>
          ) : (
            events.map((e, i) => (
              <div key={i}>
                <span className="opacity-40">
                  {new Date(e.created_at).toLocaleTimeString()}
                </span>{" "}
                <span
                  className={
                    e.level === "error"
                      ? "text-red-400"
                      : e.level === "warn"
                        ? "text-tertiary"
                        : "text-secondary"
                  }
                >
                  [{e.level}]
                </span>{" "}
                <span className="opacity-60">{e.scope}</span> {e.message}
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value?: number }) {
  return (
    <Card>
      <div className="text-2xl font-bold">{value ?? "-"}</div>
      <div className="text-sm opacity-60">{label}</div>
    </Card>
  );
}

function MailSources() {
  const emptyImap = {
    host: "",
    port: 993,
    encryption: "ssl",
    username: "",
    password: "",
    folder: "INBOX",
    polling_interval_minutes: 2,
  };
  const [domains, setDomains] = useState<any[]>([]);
  const [routingEndpoint, setRoutingEndpoint] = useState("");
  const [adding, setAdding] = useState(false);
  const [selected, setSelected] = useState<any | null>(null);
  const [newDomain, setNewDomain] = useState("");
  const [newImapEnabled, setNewImapEnabled] = useState(false);
  const [newRoutingEnabled, setNewRoutingEnabled] = useState(false);
  const [newImap, setNewImap] = useState<any>(emptyImap);
  const [newTest, setNewTest] = useState<any>(null);
  const [showNewPass, setShowNewPass] = useState(false);
  const [busy, setBusy] = useState("");

  const load = () => {
    api
      .adminDomains()
      .then((d: any) => {
        setDomains(d.domains);
        setRoutingEndpoint(d.routingEndpoint || "");
        setSelected((cur: any) =>
          cur
            ? (d.domains || []).find((x: any) => x.id === cur.id) || null
            : null,
        );
      })
      .catch(() => {});
  };
  useEffect(load, []);

  async function testNewImap() {
    setBusy("test-new");
    try {
      const r = await api.testNewDomainImap(newImap);
      setNewTest(r);
    } catch (e: any) {
      setNewTest({ ok: false, error: e.message });
    } finally {
      setBusy("");
    }
  }

  async function addDomain() {
    if (!newDomain.trim()) return alert("Domain wajib diisi");
    if (newImapEnabled && !newTest?.ok)
      return alert(
        "Test Connection IMAP dulu sampai berhasil sebelum Add Domain",
      );
    setBusy("add");
    try {
      await api.addDomain({
        domain: newDomain,
        receive_imap_enabled: newImapEnabled,
        receive_routing_enabled: newRoutingEnabled,
        imap: newImap,
      });
      setNewDomain("");
      setNewImapEnabled(false);
      setNewRoutingEnabled(false);
      setNewImap(emptyImap);
      setNewTest(null);
      setAdding(false);
      load();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setBusy("");
    }
  }

  if (selected)
    return (
      <DomainEditor
        domain={selected}
        routingEndpoint={routingEndpoint}
        onBack={() => setSelected(null)}
        onReload={load}
      />
    );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2 font-semibold text-lg">
            <Globe size={18} /> Domains
          </div>
          <p className="text-sm opacity-60">
            Kelola sumber email per domain: IMAP, Direct Routing, atau Configure
            Later.
          </p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => setAdding((s) => !s)}
        >
          <Plus size={16} /> Add Domain
        </button>
      </div>

      {adding && (
        <Card>
          <div className="font-semibold mb-3">Add Domain</div>
          <div className="space-y-3">
            <Field label="Domain Name">
              <input
                placeholder="cii.my.id"
                value={newDomain}
                onChange={(e) =>
                  setNewDomain(e.target.value.toLowerCase().trim())
                }
              />
            </Field>
            <div>
              <div className="text-sm opacity-70 mb-2">Receive Mail Via</div>
              <label className="flex items-center gap-2 mb-2">
                <input
                  className="!w-auto"
                  type="checkbox"
                  checked={newImapEnabled}
                  onChange={(e) => {
                    setNewImapEnabled(e.target.checked);
                    setNewTest(null);
                  }}
                />{" "}
                IMAP Mailbox
              </label>
              <label className="flex items-center gap-2">
                <input
                  className="!w-auto"
                  type="checkbox"
                  checked={newRoutingEnabled}
                  onChange={(e) => setNewRoutingEnabled(e.target.checked)}
                />{" "}
                Direct Routing
              </label>
            </div>

            {newImapEnabled && (
              <div className="glass p-3 space-y-3">
                <div className="font-semibold">IMAP Configuration</div>
                <ImapForm
                  value={newImap}
                  onChange={(v) => {
                    setNewImap(v);
                    setNewTest(null);
                  }}
                  showPass={showNewPass}
                  setShowPass={setShowNewPass}
                />
                <div className="flex gap-2 items-center flex-wrap">
                  <button
                    className="btn btn-ghost"
                    onClick={testNewImap}
                    disabled={busy === "test-new"}
                  >
                    {busy === "test-new" ? "Testing..." : "Test Connection"}
                  </button>
                  <ImapTestResult result={newTest} />
                </div>
              </div>
            )}

            {newRoutingEnabled && (
              <div className="glass p-3">
                <div className="font-semibold mb-2">Direct Routing</div>
                <p className="text-sm opacity-60">Routing Endpoint</p>
                <div className="mono text-sm opacity-70">
                  Endpoint will be available after domain creation.
                </div>
              </div>
            )}

            {!newImapEnabled && !newRoutingEnabled && (
              <div className="pill w-fit">Configure Later</div>
            )}
            <div className="flex gap-2">
              <button
                className="btn btn-primary"
                onClick={addDomain}
                disabled={busy === "add"}
              >
                {busy === "add" ? "Adding..." : "Add Domain"}
              </button>
              <button
                className="btn btn-ghost"
                onClick={() => setAdding(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </Card>
      )}

      <div className="grid md:grid-cols-2 gap-3">
        {domains.map((d) => (
          <button
            key={d.id}
            className="glass p-4 text-left hover:scale-[1.01] transition"
            onClick={() => setSelected(d)}
          >
            <div className="flex items-center justify-between gap-3 mb-2">
              <div className="mono font-semibold truncate">{d.domain}</div>
              <span className="opacity-60">›</span>
            </div>
            <div className="space-y-1 text-sm">
              <DomainStatus domain={d} />
              <ReceiveMode domain={d} />
              {!d.receive_imap_enabled && !d.receive_routing_enabled && (
                <div className="opacity-70">Configure Later</div>
              )}
              <div className="opacity-70">Aliases: {d.alias_count ?? 0}</div>
              <div className="opacity-70">
                Last Email: {timeAgo(d.last_email_at)}
              </div>
            </div>
          </button>
        ))}
        {domains.length === 0 && (
          <Card>
            <div className="opacity-60 text-sm">
              Belum ada domain. Klik Add Domain untuk mulai.
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

function DomainEditor({
  domain,
  routingEndpoint,
  onBack,
  onReload,
}: {
  domain: any;
  routingEndpoint: string;
  onBack: () => void;
  onReload: () => void;
}) {
  const [name, setName] = useState(domain.domain);
  const [enabled, setEnabled] = useState(!!domain.is_enabled);
  const [imapEnabled, setImapEnabled] = useState(!!domain.receive_imap_enabled);
  const [routingEnabled, setRoutingEnabled] = useState(
    !!domain.receive_routing_enabled,
  );
  const [imap, setImap] = useState<any>({
    host: domain.imap?.host || "",
    port: domain.imap?.port || 993,
    encryption: domain.imap?.encryption || "ssl",
    username: domain.imap?.username || "",
    password: "",
    folder: domain.imap?.folder || "INBOX",
    polling_interval_minutes: domain.imap?.polling_interval_minutes || 2,
  });
  const [showPass, setShowPass] = useState(false);
  const [test, setTest] = useState<any>(
    domain.imap?.last_test_status
      ? {
          ok: domain.imap.last_test_status === "success",
          error: domain.imap.last_error,
        }
      : null,
  );
  const [busy, setBusy] = useState("");
  const liveDomain = { ...domain, is_enabled: enabled };

  async function save() {
    if (
      !enabled &&
      domain.is_enabled &&
      !confirm(
        "Disable Domain?\n\nThis domain will stop receiving new emails.\n\nExisting emails and aliases will remain untouched.",
      )
    )
      return;
    if (
      !imapEnabled &&
      domain.receive_imap_enabled &&
      !confirm(
        "Disable IMAP for this domain?\n\nEmail will no longer be fetched from the configured mailbox.",
      )
    )
      return;
    if (
      !routingEnabled &&
      domain.receive_routing_enabled &&
      !confirm(
        "Disable Direct Routing for this domain?\n\nEmails forwarded directly to the Worker will no longer be accepted for this domain.",
      )
    )
      return;
    setBusy("save");
    try {
      await api.patchDomain(domain.id, {
        domain: name,
        is_enabled: enabled,
        receive_imap_enabled: imapEnabled,
        receive_routing_enabled: routingEnabled,
        imap,
      });
      await onReload();
      alert("Tersimpan");
    } catch (e: any) {
      alert(e.message);
    } finally {
      setBusy("");
    }
  }

  async function testImap() {
    setBusy("test");
    try {
      const r = await api.testDomainImap(domain.id, imap);
      setTest(r);
    } catch (e: any) {
      setTest({ ok: false, error: e.message });
    } finally {
      setBusy("");
    }
  }

  async function syncNow() {
    setBusy("sync");
    try {
      const r = await api.syncDomainImap(domain.id);
      alert("Sync: " + (r.fetched ?? 0) + " email");
      onReload();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setBusy("");
    }
  }

  async function deleteDomain() {
    const typed = prompt(
      "Delete " +
        domain.domain +
        "?\n\nThis action cannot be undone.\n\nType the domain name to confirm.",
    );
    if (typed !== domain.domain) return;
    await api.delDomain(domain.id);
    onBack();
    onReload();
  }

  return (
    <div className="space-y-4">
      <button className="btn btn-ghost" onClick={onBack}>
        ← Back to Domains
      </button>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold mono">{domain.domain}</h2>
          <div className="mt-1">
            <DomainStatus domain={liveDomain} />
          </div>
        </div>
        <button
          className="btn btn-ghost"
          onClick={async () => {
            const r = await api.verifyDomain(domain.id);
            alert(
              r.verified
                ? "MX terverifikasi"
                : "MX belum mengarah ke Cloudflare",
            );
            onReload();
          }}
        >
          Verify
        </button>
      </div>

      <Card>
        <div className="font-semibold mb-3">General</div>
        <Field label="Domain Name">
          <input
            value={name}
            onChange={(e) => setName(e.target.value.toLowerCase().trim())}
          />
        </Field>
        <div className="text-sm opacity-70 mt-3">Status</div>
        <DomainStatus domain={liveDomain} />
      </Card>

      <Card>
        <div className="font-semibold mb-3">Domain Status</div>
        <label className="flex items-center gap-2">
          <input
            className="!w-auto"
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
          />{" "}
          Enabled
        </label>
      </Card>

      <Card>
        <div className="font-semibold mb-3">Receive Mail Via</div>
        <label className="flex items-center gap-2 mb-2">
          <input
            className="!w-auto"
            type="checkbox"
            checked={imapEnabled}
            onChange={(e) => setImapEnabled(e.target.checked)}
          />{" "}
          IMAP Mailbox
        </label>
        <label className="flex items-center gap-2">
          <input
            className="!w-auto"
            type="checkbox"
            checked={routingEnabled}
            onChange={(e) => setRoutingEnabled(e.target.checked)}
          />{" "}
          Direct Routing
        </label>
        {!imapEnabled && !routingEnabled && (
          <div className="pill w-fit mt-3">Configure Later</div>
        )}
      </Card>

      {imapEnabled && (
        <Card>
          <div className="font-semibold mb-3">IMAP Configuration</div>
          <ImapForm
            value={imap}
            onChange={setImap}
            showPass={showPass}
            setShowPass={setShowPass}
          />
          <div className="flex gap-2 items-center flex-wrap mt-3">
            <button
              className="btn btn-ghost"
              onClick={testImap}
              disabled={busy === "test"}
            >
              {busy === "test" ? "Testing..." : "Test Connection"}
            </button>
            <button
              className="btn btn-ghost"
              onClick={syncNow}
              disabled={busy === "sync"}
            >
              <RefreshCw size={14} />{" "}
              {busy === "sync" ? "Syncing..." : "Sync Now"}
            </button>
            <ImapTestResult result={test} />
          </div>
        </Card>
      )}

      {routingEnabled && (
        <Card>
          <div className="font-semibold mb-3">Direct Routing</div>
          <div className="text-sm opacity-70">Routing Endpoint</div>
          <div className="mono text-sm break-all glass p-2 mt-1">
            {routingEndpoint ||
              domain.routingEndpoint ||
              "https://xxxxx.workers.dev/inbound"}
          </div>
          <div className="text-sm opacity-70 mt-3">Status</div>
          <div>
            {domain.routing_status === "active"
              ? "🟢 Active"
              : "⚠ Waiting for first email"}
          </div>
          <div className="text-sm opacity-70 mt-3">Last Email</div>
          <div>
            {timeAgo(domain.routing_last_email_at || domain.last_email_at)}
          </div>
          <ol className="list-decimal ml-5 mt-3 text-sm opacity-70 space-y-1">
            <li>Configure Email Routing</li>
            <li>Forward email to Worker endpoint</li>
            <li>Send a test email</li>
          </ol>
        </Card>
      )}

      <div className="flex gap-2">
        <button
          className="btn btn-primary"
          onClick={save}
          disabled={busy === "save"}
        >
          {busy === "save" ? "Saving..." : "Save Changes"}
        </button>
      </div>

      <Card>
        <div className="font-semibold text-red-400 mb-2">Danger Zone</div>
        <p className="text-sm opacity-70 mb-3">
          This will remove domain configuration, IMAP settings, and routing
          settings. Aliases and received emails will remain untouched.
        </p>
        <button className="btn btn-ghost text-red-400" onClick={deleteDomain}>
          <Trash2 size={14} /> Delete Domain
        </button>
      </Card>
    </div>
  );
}

function ImapForm({
  value,
  onChange,
  showPass,
  setShowPass,
}: {
  value: any;
  onChange: (v: any) => void;
  showPass: boolean;
  setShowPass: (v: boolean) => void;
}) {
  const set = (k: string, v: any) => onChange({ ...value, [k]: v });
  return (
    <div className="grid md:grid-cols-2 gap-3">
      <Field label="Server">
        <input
          placeholder="imap.example.com"
          value={value.host || ""}
          onChange={(e) => set("host", e.target.value)}
        />
      </Field>
      <Field label="Port">
        <input
          type="number"
          value={value.port || 993}
          onChange={(e) => set("port", Number(e.target.value))}
        />
      </Field>
      <Field label="Security">
        <select
          value={value.encryption || "ssl"}
          onChange={(e) => set("encryption", e.target.value)}
        >
          <option value="ssl">SSL/TLS</option>
          <option value="starttls">STARTTLS</option>
          <option value="none">None</option>
        </select>
      </Field>
      <Field label="Username">
        <input
          value={value.username || ""}
          onChange={(e) => set("username", e.target.value)}
        />
      </Field>
      <Field label="Password">
        <div className="relative">
          <input
            type={showPass ? "text" : "password"}
            value={value.password || ""}
            placeholder="********"
            onChange={(e) => set("password", e.target.value)}
          />
          <button
            type="button"
            className="absolute right-2 top-2.5"
            onClick={() => setShowPass(!showPass)}
          >
            {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        </div>
      </Field>
      <Field label="Folder">
        <input
          value={value.folder || "INBOX"}
          onChange={(e) => set("folder", e.target.value)}
        />
      </Field>
      <div className="md:col-span-2">
        <div className="text-sm opacity-70 mb-2">Polling Interval</div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {[2, 5, 10, 15].map((m) => (
            <label key={m} className="flex items-center gap-2">
              <input
                className="!w-auto"
                type="radio"
                name={"poll-" + (value.host || "new")}
                checked={Number(value.polling_interval_minutes || 2) === m}
                onChange={() => set("polling_interval_minutes", m)}
              />{" "}
              Every {m} Minutes
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}

function ImapTestResult({ result }: { result: any }) {
  if (!result) return null;
  if (result.ok)
    return (
      <div className="text-sm text-secondary">
        🟢 Connection successful
        <br />
        <span className="opacity-70">
          Server reachable · Authentication successful · Folder accessible
        </span>
      </div>
    );
  return (
    <div className="text-sm text-red-400">
      🔴 Connection failed
      <br />
      <span className="opacity-70">
        {result.error || "Check username or password"}
      </span>
    </div>
  );
}

function DomainStatus({ domain }: { domain: any }) {
  if (!domain.is_enabled)
    return <div className="text-tertiary">🟡 Disabled</div>;
  if (domain.is_verified || domain.verified)
    return <div className="text-secondary">✓ Verified</div>;
  return <div className="text-tertiary">⚠ Setup Required</div>;
}

function ReceiveMode({ domain }: { domain: any }) {
  return (
    <div className="space-y-1">
      {domain.receive_imap_enabled ? <div>📥 IMAP</div> : null}
      {domain.receive_routing_enabled ? <div>🔀 Routing</div> : null}
    </div>
  );
}

function timeAgo(ts?: number | null) {
  if (!ts) return "Never";
  const diff = Math.max(0, Date.now() - Number(ts));
  const min = Math.floor(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return min + " min ago";
  const hr = Math.floor(min / 60);
  if (hr < 24) return hr + " hours ago";
  const day = Math.floor(hr / 24);
  return day + " days ago";
}

function Appearance() {
  const [s, setS] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState("");
  useEffect(() => {
    api
      .settings("branding")
      .then((r) => setS(flat(r.settings)))
      .catch(() => {});
  }, []);
  const set = (k: string, v: string) => setS((p) => ({ ...p, [k]: v }));
  async function upload(key: string, file?: File | null) {
    if (!file) return;
    setBusy(key);
    try {
      const { url } = await api.upload(file);
      set(key, url);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setBusy("");
    }
  }
  return (
    <Card>
      <div className="space-y-3">
        <Field label="Nama Aplikasi">
          <input
            value={s.app_name || ""}
            onChange={(e) => set("app_name", e.target.value)}
          />
        </Field>
        <Field label="Judul Hero">
          <input
            value={s.hero_title || ""}
            placeholder="Email Sementara, Instan & Privat"
            onChange={(e) => set("hero_title", e.target.value)}
          />
        </Field>
        <Field label="Subjudul Hero">
          <textarea
            rows={2}
            value={s.hero_subtitle || ""}
            placeholder="Terima email tanpa registrasi. Auto-hapus otomatis."
            onChange={(e) => set("hero_subtitle", e.target.value)}
          />
        </Field>
        <Field label="Logo (upload gambar)">
          <div className="flex items-center gap-3">
            {s.logo_url && (
              <img
                src={s.logo_url}
                alt="logo"
                className="h-10 w-10 object-contain rounded glass p-1"
              />
            )}
            <input
              type="file"
              accept="image/*"
              className="!w-auto"
              onChange={(e) => upload("logo_url", e.target.files?.[0])}
            />
            {busy === "logo_url" && (
              <span className="text-sm opacity-60">Mengupload...</span>
            )}
            {s.logo_url && (
              <button
                className="btn btn-ghost"
                onClick={() => set("logo_url", "")}
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        </Field>
        <Field label="Favicon (upload gambar)">
          <div className="flex items-center gap-3">
            {s.favicon_url && (
              <img
                src={s.favicon_url}
                alt="favicon"
                className="h-8 w-8 object-contain rounded glass p-1"
              />
            )}
            <input
              type="file"
              accept="image/*"
              className="!w-auto"
              onChange={(e) => upload("favicon_url", e.target.files?.[0])}
            />
            {busy === "favicon_url" && (
              <span className="text-sm opacity-60">Mengupload...</span>
            )}
            {s.favicon_url && (
              <button
                className="btn btn-ghost"
                onClick={() => set("favicon_url", "")}
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Tema Default">
            <select
              value={s.default_theme || "dark"}
              onChange={(e) => set("default_theme", e.target.value)}
            >
              <option value="dark">Gelap</option>
              <option value="light">Terang</option>
            </select>
          </Field>
          <Field label="Bahasa Default">
            <select
              value={s.default_lang || "id"}
              onChange={(e) => set("default_lang", e.target.value)}
            >
              <option value="id">Indonesia</option>
              <option value="en">English</option>
            </select>
          </Field>
        </div>
        <button
          className="btn btn-primary"
          onClick={async () => {
            await api.saveSettings(s);
            alert("Tersimpan");
          }}
        >
          Simpan
        </button>
      </div>
    </Card>
  );
}

function Security() {
  const [s, setS] = useState<Record<string, string>>({});
  const [admins, setAdmins] = useState<any[]>([]);
  const [na, setNa] = useState<any>({ email: "", password: "", name: "" });
  const load = () => {
    api
      .settings("security")
      .then((r) => setS(flat(r.settings)))
      .catch(() => {});
    api
      .admins()
      .then((r) => setAdmins(r.admins))
      .catch(() => {});
  };
  useEffect(load, []);
  const set = (k: string, v: string) => setS({ ...s, [k]: v });
  return (
    <div className="space-y-4">
      <Card>
        <div className="font-semibold mb-2">Lock Website</div>
        <Field label="Kunci akses publik">
          <select
            value={s.site_locked || "false"}
            onChange={(e) => set("site_locked", e.target.value)}
          >
            <option value="false">Tidak</option>
            <option value="true">Ya (perlu password)</option>
          </select>
        </Field>
        <Field label="Password Lock">
          <input
            placeholder="(kosongkan jika tak diubah)"
            onChange={(e) => set("site_lock_password", e.target.value)}
          />
        </Field>
        <button
          className="btn btn-primary mt-2"
          onClick={async () => {
            await api.saveSettings(s);
            alert("Tersimpan");
          }}
        >
          Simpan
        </button>
      </Card>
      <Card>
        <div className="font-semibold mb-2">Admin</div>
        <div className="grid grid-cols-3 gap-2 mb-2">
          <input
            placeholder="Nama"
            onChange={(e) => setNa({ ...na, name: e.target.value })}
          />
          <input
            placeholder="Email"
            onChange={(e) => setNa({ ...na, email: e.target.value })}
          />
          <input
            placeholder="Password"
            type="password"
            onChange={(e) => setNa({ ...na, password: e.target.value })}
          />
        </div>
        <button
          className="btn btn-primary"
          onClick={async () => {
            await api.addAdmin(na);
            load();
          }}
        >
          <Plus size={14} /> Tambah Admin
        </button>
        <div className="mt-3">
          {admins.map((a) => (
            <div
              key={a.id}
              className="flex items-center justify-between py-2 border-t border-white/5"
            >
              <span>
                {a.name || a.email} <span className="pill ml-2">{a.role}</span>
              </span>
              <button
                className="btn btn-ghost"
                onClick={async () => {
                  await api.delAdmin(a.id);
                  load();
                }}
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function ApiKeys() {
  const [s, setS] = useState<Record<string, string>>({});
  const [keys, setKeys] = useState<any[]>([]);
  const [name, setName] = useState("");
  const [created, setCreated] = useState<string>("");
  const load = () => {
    api
      .settings("api")
      .then((r) => setS(flat(r.settings)))
      .catch(() => {});
    api
      .apiKeys()
      .then((r) => setKeys(r.keys))
      .catch(() => {});
  };
  useEffect(load, []);
  return (
    <div className="space-y-4">
      <Card>
        <Field label="Aktifkan API publik">
          <select
            value={s.api_enabled || "false"}
            onChange={(e) => {
              const v = e.target.value;
              setS({ ...s, api_enabled: v });
              api.saveSettings({ api_enabled: v });
            }}
          >
            <option value="true">Aktif</option>
            <option value="false">Nonaktif</option>
          </select>
        </Field>
      </Card>
      <Card>
        <div className="font-semibold mb-2">API Keys</div>
        <div className="flex gap-2 mb-2">
          <input
            placeholder="Nama key"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <button
            className="btn btn-primary"
            onClick={async () => {
              const r = await api.addApiKey({ name });
              setCreated(r.plaintext);
              setName("");
              load();
            }}
          >
            <Plus size={16} /> Buat
          </button>
        </div>
        {created && (
          <div className="glass p-2 text-sm mono break-all mb-2">
            Simpan sekarang (hanya tampil sekali):
            <br />
            {created}
          </div>
        )}
        {keys.map((k) => (
          <div
            key={k.id}
            className="flex items-center justify-between py-2 border-t border-white/5"
          >
            <span>
              {k.name} <span className="pill mono ml-2">{k.key_prefix}…</span>{" "}
              {k.enabled ? "" : <span className="pill text-red-400">off</span>}
            </span>
            <div className="flex gap-2">
              <button
                className="btn btn-ghost"
                onClick={async () => {
                  await api.patchApiKey(k.id, { enabled: !k.enabled });
                  load();
                }}
              >
                {k.enabled ? "Disable" : "Enable"}
              </button>
              <button
                className="btn btn-ghost"
                onClick={async () => {
                  await api.delApiKey(k.id);
                  load();
                }}
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
        <a
          className="btn btn-ghost mt-3"
          href={(process.env.NEXT_PUBLIC_API_BASE || "") + "/docs"}
          target="_blank"
          rel="noreferrer"
        >
          Lihat Dokumentasi API
        </a>
      </Card>
    </div>
  );
}

function Integrations() {
  const [s, setS] = useState<Record<string, string>>({});
  useEffect(() => {
    api
      .integrations()
      .then((r) => setS(flat(r.settings)))
      .catch(() => {});
  }, []);
  const set = (k: string, v: string) => setS({ ...s, [k]: v });
  return (
    <Card>
      <div className="space-y-3">
        <div className="font-semibold">Telegram Bot</div>
        <Field label="Bot Token">
          <input
            value={s.telegram_bot_token || ""}
            onChange={(e) => set("telegram_bot_token", e.target.value)}
          />
        </Field>
        <Field label="Chat ID">
          <input
            value={s.telegram_chat_id || ""}
            onChange={(e) => set("telegram_chat_id", e.target.value)}
          />
        </Field>
        <div className="font-semibold pt-2">Webhook</div>
        <Field label="Aktifkan Webhook">
          <select
            value={s.webhook_enabled || "false"}
            onChange={(e) => set("webhook_enabled", e.target.value)}
          >
            <option value="true">Aktif</option>
            <option value="false">Nonaktif</option>
          </select>
        </Field>
        <Field label="Webhook URL">
          <input
            value={s.webhook_url || ""}
            onChange={(e) => set("webhook_url", e.target.value)}
          />
        </Field>
        <div className="flex gap-2">
          <button
            className="btn btn-primary"
            onClick={async () => {
              await api.saveIntegrations(s);
              alert("Tersimpan");
            }}
          >
            Simpan
          </button>
          <button
            className="btn btn-ghost"
            onClick={async () => {
              const r = await api.testIntegration();
              alert(
                "Telegram: " +
                  (r.telegram ? "OK" : "-") +
                  " | Webhook: " +
                  (r.webhook ? "OK" : "-"),
              );
            }}
          >
            <Send size={14} /> Tes Notifikasi
          </button>
        </div>
      </div>
    </Card>
  );
}

function SystemTab() {
  const [s, setS] = useState<Record<string, string>>({});
  useEffect(() => {
    api
      .settings("system")
      .then((r) => setS(flat(r.settings)))
      .catch(() => {});
  }, []);
  const set = (k: string, v: string) => setS({ ...s, [k]: v });
  return (
    <Card>
      <p className="text-xs opacity-60 mb-3">
        Pengaturan teknis: masa berlaku alamat, batas ukuran lampiran, rate
        limit, dan format alamat.
      </p>
      <div className="space-y-3">
        <Field label="TTL alamat (menit)">
          <input
            type="number"
            value={s.ttl_minutes || "60"}
            onChange={(e) => set("ttl_minutes", e.target.value)}
          />
        </Field>
        <Field label="Maks lampiran (MB)">
          <input
            type="number"
            value={s.max_attachment_mb || "10"}
            onChange={(e) => set("max_attachment_mb", e.target.value)}
          />
        </Field>
        <Field label="Rate limit global (/menit)">
          <input
            type="number"
            value={s.global_rate_limit || "120"}
            onChange={(e) => set("global_rate_limit", e.target.value)}
          />
        </Field>
        <Field label="Format alamat">
          <select
            value={s.address_format || "word+num"}
            onChange={(e) => set("address_format", e.target.value)}
          >
            <option value="word+num">kata+angka</option>
            <option value="random">acak</option>
          </select>
        </Field>
        <Field label="Blocklist pengirim (pisahkan koma)">
          <input
            value={s.blocklist_senders || ""}
            onChange={(e) => set("blocklist_senders", e.target.value)}
          />
        </Field>
        <button
          className="btn btn-primary"
          onClick={async () => {
            await api.saveSettings(s);
            alert("Tersimpan");
          }}
        >
          Simpan
        </button>
      </div>
    </Card>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="text-sm opacity-70">{label}</label>
      {children}
    </div>
  );
}

function flat(settings: any): Record<string, string> {
  if (Array.isArray(settings)) {
    const o: Record<string, string> = {};
    for (const r of settings) o[r.key] = r.value ?? "";
    return o;
  }
  return settings || {};
}
