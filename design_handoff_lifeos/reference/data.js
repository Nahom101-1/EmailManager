/* LifeOS mock data — window.DATA */
(function () {
  const DATA = {};

  DATA.inboxes = [
    {
      id: "ib_gmail",
      email: "alex.rivera@gmail.com",
      provider: "google",
      connType: "Google OAuth · Gmail API",
      status: "active",
      lastSync: "2 min ago",
      lastSyncTs: "2026-06-12 09:41",
      messages: 18432,
      scanned: 18432,
      readonly: true,
    },
    {
      id: "ib_dome",
      email: "alex@rivera.no",
      provider: "imap",
      connType: "IMAP · Domeneshop",
      status: "active",
      lastSync: "1 hr ago",
      lastSyncTs: "2026-06-12 08:40",
      messages: 7218,
      scanned: 7218,
      server: "imap.domeneshop.no",
      port: 993,
      username: "rivera12",
    },
    {
      id: "ib_work",
      email: "a.rivera@northwind.io",
      provider: "imap",
      connType: "IMAP · Custom",
      status: "error",
      lastSync: "Failed 3 hr ago",
      lastSyncTs: "2026-06-12 06:38",
      messages: 4096,
      scanned: 3870,
      server: "mail.northwind.io",
      port: 993,
      username: "a.rivera@northwind.io",
      error: { code: "IMAP_LOGIN_FAILED", msg: "Authentication failed. The app password may have been revoked." },
    },
  ];

  DATA.summary = {
    accounts: 3,
    scanned: 29746,
    subsFound: 17,
    monthly: 184.32,
    annual: 2211.84,
    lastSync: "2 min ago",
    trialsSoon: 2,
    accountsFound: 64,
    needsReview: 6,
  };

  const sub = (o) => Object.assign({ cycle: "monthly", confidence: 90, status: "active", currency: "$" }, o);
  DATA.subs = [
    sub({ id: "s1", company: "Netflix", mono: "N", color: "#b91c1c", amount: 22.99, email: "alex.rivera@gmail.com", lastSeen: "3 days ago", source: "receipt", category: "Streaming", confidence: 98 }),
    sub({ id: "s2", company: "Spotify", mono: "S", color: "#16a34a", amount: 11.99, email: "alex.rivera@gmail.com", lastSeen: "12 days ago", source: "receipt", category: "Music", confidence: 96 }),
    sub({ id: "s3", company: "Adobe Creative Cloud", mono: "Ai", color: "#dc2626", amount: 59.99, email: "a.rivera@northwind.io", lastSeen: "8 days ago", source: "invoice", category: "Software", confidence: 94 }),
    sub({ id: "s4", company: "GitHub", mono: "GH", color: "#334155", amount: 4.0, email: "alex.rivera@gmail.com", lastSeen: "21 days ago", source: "receipt", category: "Developer", confidence: 92 }),
    sub({ id: "s5", company: "Notion", mono: "No", color: "#334155", amount: 10.0, email: "alex.rivera@gmail.com", lastSeen: "5 days ago", source: "receipt", category: "Productivity", confidence: 88 }),
    sub({ id: "s6", company: "iCloud+", mono: "iC", color: "#0ea5e9", amount: 2.99, email: "alex.rivera@gmail.com", lastSeen: "2 days ago", source: "receipt", category: "Storage", confidence: 90 }),
    sub({ id: "s7", company: "Figma", mono: "Fi", color: "#7c3aed", amount: 15.0, email: "a.rivera@northwind.io", lastSeen: "9 days ago", source: "invoice", category: "Design", confidence: 91 }),
    sub({ id: "s8", company: "ChatGPT Plus", mono: "AI", color: "#0f766e", amount: 20.0, email: "alex.rivera@gmail.com", lastSeen: "1 day ago", source: "receipt", category: "AI", confidence: 95 }),
    sub({ id: "s9", company: "Dropbox", mono: "Db", color: "#2563eb", amount: 11.99, email: "alex@rivera.no", lastSeen: "27 days ago", source: "receipt", category: "Storage", confidence: 72, status: "needs-review" }),
    sub({ id: "s10", company: "The New York Times", mono: "T", color: "#1c1c1c", amount: 17.0, email: "alex.rivera@gmail.com", lastSeen: "4 days ago", source: "receipt", category: "News", confidence: 86 }),
    sub({ id: "s11", company: "Audible", mono: "Au", color: "#ea580c", amount: 14.95, email: "alex.rivera@gmail.com", lastSeen: "tomorrow", source: "trial", category: "Audio", confidence: 64, status: "needs-review", trial: true, trialEnds: "in 2 days" }),
    sub({ id: "s12", company: "Domeneshop Hosting", mono: "Dh", color: "#0d9488", amount: 119.0, cycle: "yearly", email: "alex@rivera.no", lastSeen: "2 months ago", source: "invoice", category: "Hosting", confidence: 89 }),
    sub({ id: "s13", company: "Vercel Pro", mono: "▲", color: "#1c1c1c", amount: 20.0, email: "a.rivera@northwind.io", lastSeen: "11 days ago", source: "invoice", category: "Developer", confidence: 80 }),
    sub({ id: "s14", company: "1Password", mono: "1P", color: "#2563eb", amount: 35.88, cycle: "yearly", email: "alex.rivera@gmail.com", lastSeen: "5 months ago", source: "receipt", category: "Security", confidence: 83 }),
    sub({ id: "s15", company: "Headspace", mono: "Hs", color: "#f97316", amount: 12.99, email: "alex.rivera@gmail.com", lastSeen: "6 weeks ago", source: "receipt", category: "Health", confidence: 55, status: "unknown" }),
    sub({ id: "s16", company: "Disney+", mono: "D", color: "#1d4ed8", amount: 13.99, email: "alex.rivera@gmail.com", lastSeen: "4 months ago", source: "receipt", category: "Streaming", confidence: 78, status: "cancelled" }),
    sub({ id: "s17", company: "Substack — Lenny's", mono: "Sn", color: "#ea580c", amount: 8.0, email: "alex.rivera@gmail.com", lastSeen: "2 weeks ago", source: "receipt", category: "News", confidence: 70, status: "unknown" }),
  ];

  const ac = (o) => Object.assign({ status: "active", risk: 1 }, o);
  DATA.accounts = [
    ac({ id: "a1", service: "Amazon", mono: "a", color: "#f59e0b", email: "alex.rivera@gmail.com", first: "Mar 2017", last: "Yesterday", inbox: "Gmail", risk: 1, signals: ["receipt", "login", "security"] }),
    ac({ id: "a2", service: "LinkedIn", mono: "in", color: "#0369a1", email: "alex.rivera@gmail.com", first: "Jan 2015", last: "3 days ago", inbox: "Gmail", risk: 2, signals: ["login", "newsletter", "security"] }),
    ac({ id: "a3", service: "PayPal", mono: "P", color: "#1e3a8a", email: "alex.rivera@gmail.com", first: "Aug 2016", last: "1 week ago", inbox: "Gmail", risk: 3, signals: ["receipt", "security", "password-reset"] }),
    ac({ id: "a4", service: "Strava", mono: "St", color: "#ea580c", email: "alex@rivera.no", first: "May 2021", last: "2 days ago", inbox: "Domeneshop", risk: 1, signals: ["login", "newsletter"] }),
    ac({ id: "a5", service: "Steam", mono: "Sm", color: "#1e293b", email: "alex.rivera@gmail.com", first: "Nov 2013", last: "1 month ago", inbox: "Gmail", risk: 2, signals: ["login", "receipt", "security"] }),
    ac({ id: "a6", service: "Airbnb", mono: "Ab", color: "#e11d48", email: "alex.rivera@gmail.com", first: "Jun 2018", last: "5 months ago", inbox: "Gmail", risk: 2, signals: ["receipt", "trial"] }),
    ac({ id: "a7", service: "Reddit", mono: "R", color: "#ea580c", email: "alex.rivera@gmail.com", first: "Feb 2014", last: "1 week ago", inbox: "Gmail", risk: 1, signals: ["login", "newsletter"] }),
    ac({ id: "a8", service: "Duolingo", mono: "Du", color: "#16a34a", email: "alex.rivera@gmail.com", first: "Sep 2020", last: "Yesterday", inbox: "Gmail", risk: 1, signals: ["login", "newsletter"] }),
    ac({ id: "a9", service: "Northwind SSO", mono: "Nw", color: "#0d9488", email: "a.rivera@northwind.io", first: "Apr 2022", last: "2 days ago", inbox: "Northwind", risk: 3, signals: ["login", "security", "password-reset"] }),
    ac({ id: "a10", service: "Booking.com", mono: "B", color: "#1e3a8a", email: "alex.rivera@gmail.com", first: "Jul 2019", last: "8 months ago", inbox: "Gmail", risk: 2, status: "inactive", signals: ["receipt"] }),
    ac({ id: "a11", service: "Coursera", mono: "C", color: "#2563eb", email: "alex@rivera.no", first: "Jan 2021", last: "1 year ago", inbox: "Domeneshop", risk: 2, status: "inactive", signals: ["signup", "newsletter"] }),
    ac({ id: "a12", service: "Patreon", mono: "Pn", color: "#dc2626", email: "alex.rivera@gmail.com", first: "Oct 2020", last: "3 weeks ago", inbox: "Gmail", risk: 1, status: "unknown", signals: ["receipt", "newsletter"] }),
    ac({ id: "a13", service: "Grammarly", mono: "G", color: "#16a34a", email: "alex.rivera@gmail.com", first: "Mar 2019", last: "4 months ago", inbox: "Gmail", risk: 2, status: "unknown", signals: ["trial", "newsletter"] }),
    ac({ id: "a14", service: "Old Bank Account", mono: "$", color: "#475569", email: "alex@rivera.no", first: "Feb 2016", last: "2 years ago", inbox: "Domeneshop", risk: 3, status: "inactive", signals: ["statement", "security"] }),
  ];

  DATA.activity = [
    { id: "ac1", time: "09:41", date: "Today", inbox: "alex.rivera@gmail.com", title: "Sync complete", desc: "142 new messages · 1 subscription · 2 accounts detected", kind: "ok", accent: true },
    { id: "ac2", time: "08:40", date: "Today", inbox: "alex@rivera.no", title: "Sync complete", desc: "38 new messages · 0 subscriptions · 1 account detected", kind: "ok" },
    { id: "ac3", time: "06:38", date: "Today", inbox: "a.rivera@northwind.io", title: "Sync failed", desc: "IMAP login failed — authentication rejected by server", kind: "err" },
    { id: "ac4", time: "21:12", date: "Yesterday", inbox: "alex.rivera@gmail.com", title: "Sync complete", desc: "210 new messages · 2 subscriptions · 4 accounts detected", kind: "ok" },
    { id: "ac5", time: "20:55", date: "Yesterday", inbox: "alex@rivera.no", title: "Token refreshed", desc: "IMAP credentials validated", kind: "info" },
    { id: "ac6", time: "14:02", date: "Jun 10", inbox: "alex.rivera@gmail.com", title: "Sync complete", desc: "96 new messages · 0 subscriptions · 1 account detected", kind: "ok" },
  ];

  DATA.queue = [
    { id: "q1", kind: "review", title: "Confirm 6 detected subscriptions", desc: "Low-confidence matches need your review", count: 6, to: "subscriptions" },
    { id: "q2", kind: "trial", title: "Audible trial ends in 2 days", desc: "$14.95/mo begins after — decide to keep or cancel", to: "subscriptions" },
    { id: "q3", kind: "error", title: "Fix connection: a.rivera@northwind.io", desc: "IMAP login failed — update app password", to: "connect" },
    { id: "q4", kind: "duplicate", title: "Possible duplicate accounts", desc: "Amazon appears under 2 email addresses", count: 2, to: "accounts" },
  ];

  DATA.evidence = [
    { time: "Jun 11, 2026", title: "Order receipt", desc: "Order #112-8847 · $48.20", kind: "receipt", inbox: "Gmail" },
    { time: "May 28, 2026", title: "Sign-in from new device", desc: "Security alert · Chrome on macOS", kind: "security", inbox: "Gmail" },
    { time: "Apr 02, 2026", title: "Password changed", desc: "Confirmation of password reset", kind: "password-reset", inbox: "Gmail" },
    { time: "Jan 14, 2026", title: "Order receipt", desc: "Order #112-4410 · $129.99", kind: "receipt", inbox: "Gmail" },
    { time: "Mar 22, 2017", title: "Welcome to Amazon", desc: "Account created confirmation", kind: "signup", inbox: "Gmail" },
  ];

  // ---- broader digital life ----
  DATA.people = [
    { id: "p1", name: "Dana Whitlock", rel: "work", role: "Your manager", email: "dana@northwind.io", last: "2 days ago", owed: true, snippet: "Re: Q3 roadmap — can you send the revised deck before Friday?", unread: 2 },
    { id: "p2", name: "Sam Rivera", rel: "personal", role: "Brother", email: "sam.r@gmail.com", last: "3 weeks ago", owed: true, snippet: "Still on for the trip in July? Let me know dates.", unread: 1 },
    { id: "p3", name: "Priya Anand", rel: "work", role: "Client · Acme", email: "priya@acme.com", last: "Yesterday", owed: true, snippet: "Invoice looks good. One question about the timeline…", unread: 1 },
    { id: "p4", name: "Mom", rel: "personal", role: "Family", email: "lucia.rivera@gmail.com", last: "5 days ago", owed: false, snippet: "Sent you photos from the weekend ❤", unread: 0 },
    { id: "p5", name: "Northwind HR", rel: "work", role: "Benefits", email: "hr@northwind.io", last: "1 week ago", owed: false, snippet: "Open enrollment closes June 30.", unread: 1 },
    { id: "p6", name: "Jordan Lee", rel: "personal", role: "Friend", email: "jlee@gmail.com", last: "2 months ago", owed: false, snippet: "We should catch up soon!", unread: 0 },
  ];

  DATA.bills = [
    { id: "b1", name: "Rent — Maple St", amount: 1850.0, due: "in 3 days", dueHard: "Jun 15", status: "due", category: "Housing", auto: false },
    { id: "b2", name: "Visa •••• 4821", amount: 642.18, due: "in 6 days", dueHard: "Jun 18", status: "upcoming", category: "Credit card", auto: false },
    { id: "b3", name: "Electric — Hafslund", amount: 88.4, due: "in 9 days", dueHard: "Jun 21", status: "upcoming", category: "Utilities", auto: true },
    { id: "b4", name: "Phone — Telenor", amount: 39.0, due: "paid", dueHard: "Jun 2", status: "paid", category: "Utilities", auto: true },
  ];

  DATA.commitments = [
    { id: "c1", title: "Send revised Q3 deck to Dana", due: "Fri, Jun 13", from: "Dana Whitlock", kind: "work", done: false },
    { id: "c2", title: "Reply to Sam about July trip dates", due: "Overdue · 3 weeks", from: "Sam Rivera", kind: "personal", done: false, overdue: true },
    { id: "c3", title: "Confirm dentist appointment", due: "Mon, Jun 16", from: "Bright Dental", kind: "personal", done: false },
    { id: "c4", title: "Open enrollment — choose benefits", due: "Jun 30", from: "Northwind HR", kind: "work", done: false },
    { id: "c5", title: "Renew passport", due: "No date", from: "self note", kind: "personal", done: false },
  ];

  DATA.logistics = [
    { id: "l1", title: "Package out for delivery", desc: "Amazon · arriving today", kind: "delivery", when: "Today" },
    { id: "l2", title: "Flight OSL → LHR", desc: "Confirmation · Jul 14, 09:25", kind: "travel", when: "Jul 14" },
    { id: "l3", title: "Hotel booking — London", desc: "3 nights · check-in Jul 14", kind: "travel", when: "Jul 14" },
  ];

  // AI-surfaced productivity insights (dashboard cards)
  DATA.insights = [
    { id: "i1", priority: "now", icon: "flag", title: "3 replies are overdue", body: "Dana (manager) and a client are waiting. Sam's message is 3 weeks old.", action: "Triage replies", to: "assistant", tone: "warn" },
    { id: "i2", priority: "now", icon: "receipt", title: "Rent is due in 3 days", body: "$1,850 to Maple St — not on autopay. Two more bills follow this week.", action: "View bills", to: "dashboard", tone: "warn" },
    { id: "i3", priority: "wait", icon: "bell", title: "12 newsletters you never open", body: "Senders you haven't clicked in 90+ days. Safe to mute and reclaim your inbox.", action: "Review & mute", to: "accounts", tone: "idle" },
    { id: "i4", priority: "ignore", icon: "clock", title: "You've cleared today's essentials", body: "Nothing else is time-sensitive. A good moment to step away from the inbox.", action: "Dismiss", to: null, tone: "active" },
  ];

  DATA.briefing = {
    greeting: "Good morning, Alex.",
    summary: "Three things genuinely need you today; the rest can wait. Your manager and a client are both waiting on replies, and rent is due Friday. Inbox volume is normal — 41 new since last night, mostly newsletters and receipts.",
    dealFirst: [
      { t: "Reply to Dana — revised Q3 deck (due Fri)", meta: "Work · waiting 2 days" },
      { t: "Reply to Priya (Acme) — timeline question", meta: "Client · since yesterday" },
      { t: "Pay rent — $1,850, due in 3 days", meta: "Not on autopay" },
    ],
    canWait: [
      { t: "Reply to Sam about July trip", meta: "Personal · 3 weeks old" },
      { t: "Choose benefits — open enrollment", meta: "Closes Jun 30" },
    ],
    ignore: [
      { t: "12 newsletters (unopened 90+ days)", meta: "Mute suggested" },
      { t: "34 promotional / receipt emails", meta: "Auto-filed" },
    ],
  };

  DATA.lifeStats = {
    newSinceLast: 41,
    needsReply: 3,
    workShare: 38,
    personalShare: 22,
    autoFiled: 40,
    inboxLoad: "Normal",
  };

  DATA.aiScopes = [
    { id: "work", label: "Work mail", desc: "northwind.io · client threads", on: true },
    { id: "personal", label: "Personal mail", desc: "family & friends", on: true },
    { id: "money", label: "Receipts & bills", desc: "spending, invoices, statements", on: true },
    { id: "calendar", label: "Calendar & travel", desc: "bookings, deliveries, events", on: true },
    { id: "content", label: "Message contents", desc: "full text, not just metadata", on: false },
  ];

  DATA.suggestedPrompts = [
    "What should I deal with first?",
    "What can I safely ignore today?",
    "Anything urgent from work?",
    "Who am I forgetting to reply to?",
    "Summarize my unread in one line",
  ];

  DATA.providers = [
    { id: "dome", name: "Domeneshop", server: "imap.domeneshop.no", port: 993, ssl: true, note: "Username may be your mailbox username (e.g. rivera12), not your email address." },
    { id: "gmail", name: "Gmail (IMAP fallback)", server: "imap.gmail.com", port: 993, ssl: true, note: "OAuth is strongly preferred for Gmail. IMAP requires an app password and 2FA." },
    { id: "custom", name: "Custom", server: "", port: 993, ssl: true, note: "Enter your provider's IMAP host and port manually." },
  ];

  window.DATA = DATA;
})();
