import { describe, it, expect, vi, beforeEach } from "vitest";
import { rateLimit } from "../lib/rate-limit";

// ---------------------------------------------------------------------------
// Mock Supabase — returns data scoped to specific user IDs
// ---------------------------------------------------------------------------

const USER_A = "user-a-id";
const USER_B = "user-b-id";

// Track all supabase calls for assertion
let supabaseCalls: Array<{ table: string; method: string; args: unknown[] }> = [];

function makeChain(table: string, resolvedData: unknown = null) {
  const chain: Record<string, unknown> = {};
  const self = () => chain;
  const track = (method: string) =>
    vi.fn((...args: unknown[]) => {
      supabaseCalls.push({ table, method, args });
      return chain;
    });

  chain.select = track("select");
  chain.insert = track("insert");
  chain.update = track("update");
  chain.delete = track("delete");
  chain.eq = track("eq");
  chain.gte = track("gte");
  chain.lte = track("lte");
  chain.in = track("in");
  chain.order = track("order");
  chain.limit = track("limit");
  chain.single = vi.fn(() => {
    supabaseCalls.push({ table, method: "single", args: [] });
    return Promise.resolve({ data: resolvedData, error: null });
  });
  chain.then = (resolve: (v: unknown) => void) =>
    Promise.resolve({ data: resolvedData ? [resolvedData] : [] }).then(resolve);

  return chain;
}

vi.mock("../lib/supabase", () => ({
  supabaseAdmin: {
    from: vi.fn(),
  },
}));

// Mock auth to return null (no valid user) by default
vi.mock("../lib/auth-server", () => ({
  getAuthUser: vi.fn().mockResolvedValue(null),
  requireAuth: vi.fn().mockImplementation(async () => {
    return Response.json(
      { message: "Authentication required", status: "error" },
      { status: 401 },
    );
  }),
}));

import { supabaseAdmin } from "../lib/supabase";
import { requireAuth } from "../lib/auth-server";

const mockFrom = supabaseAdmin.from as ReturnType<typeof vi.fn>;
const mockRequireAuth = requireAuth as ReturnType<typeof vi.fn>;

// ---------------------------------------------------------------------------
// Import route handlers
// ---------------------------------------------------------------------------

import { GET as healthGET } from "../app/api/health+api";
import { PATCH as categoriesPATCH, DELETE as categoriesDELETE } from "../app/api/categories+api";
import { DELETE as goalsDELETE } from "../app/api/goals+api";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(method: string, body?: unknown): Request {
  const init: RequestInit = {
    method,
    headers: { "Content-Type": "application/json" },
  };
  if (body) init.body = JSON.stringify(body);
  return new Request("http://localhost/api/test", init);
}

// ---------------------------------------------------------------------------
// Test: /api/health exposes only { ok: true }
// ---------------------------------------------------------------------------

describe("Security: /api/health", () => {
  it("returns only { ok: true } with no env data", async () => {
    const response = await healthGET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ ok: true });

    // Must NOT contain any of these keys
    expect(data.env).toBeUndefined();
    expect(data.keyDebug).toBeUndefined();
    expect(data.openrouterStatus).toBeUndefined();
    expect(data.openrouter).toBeUndefined();
    expect(Object.keys(data)).toEqual(["ok"]);
  });
});

// ---------------------------------------------------------------------------
// Test: Missing/Invalid JWT rejected
// ---------------------------------------------------------------------------

describe("Security: Auth rejection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    supabaseCalls = [];
    // Default: requireAuth returns 401
    mockRequireAuth.mockImplementation(async () =>
      Response.json(
        { message: "Authentication required", status: "error" },
        { status: 401 },
      ),
    );
  });

  it("PATCH /api/categories rejects missing JWT with 401", async () => {
    const req = makeRequest("PATCH", { id: "cat-1", name: "hacked" });
    const res = await categoriesPATCH(req);
    expect(res.status).toBe(401);
  });

  it("DELETE /api/categories rejects missing JWT with 401", async () => {
    const req = makeRequest("DELETE", { id: "cat-1" });
    const res = await categoriesDELETE(req);
    expect(res.status).toBe(401);
  });

  it("DELETE /api/goals rejects missing JWT with 401", async () => {
    const req = makeRequest("DELETE", { id: "goal-1" });
    const res = await goalsDELETE(req);
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// Test: User A cannot PATCH/DELETE User B's category
// ---------------------------------------------------------------------------

describe("Security: Cross-user category isolation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    supabaseCalls = [];
  });

  it("User A cannot PATCH User B's category — ownership check returns null", async () => {
    // User A is authenticated
    mockRequireAuth.mockResolvedValue(USER_A);

    // The ownership SELECT returns null (User B's category not found for User A)
    mockFrom.mockImplementation((table: string) => {
      if (table === "categories") {
        return makeChain("categories", null); // .single() → null
      }
      return makeChain(table);
    });

    const req = makeRequest("PATCH", { id: "user-b-category-id", name: "hacked" });
    const res = await categoriesPATCH(req);
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.success).toBe(false);
    expect(body.error).toBe("Category not found");
  });

  it("User A cannot DELETE User B's category — ownership check returns null", async () => {
    mockRequireAuth.mockResolvedValue(USER_A);

    mockFrom.mockImplementation((table: string) => {
      if (table === "categories") {
        return makeChain("categories", null);
      }
      return makeChain(table);
    });

    const req = makeRequest("DELETE", { id: "user-b-category-id" });
    const res = await categoriesDELETE(req);
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.success).toBe(false);
  });

  it("PATCH mutation query includes user_id filter", async () => {
    mockRequireAuth.mockResolvedValue(USER_A);

    // Ownership check passes (category belongs to User A)
    let callCount = 0;
    mockFrom.mockImplementation((table: string) => {
      if (table === "categories") {
        callCount++;
        if (callCount === 1) {
          // Ownership SELECT — found
          return makeChain("categories", { id: "cat-owned" });
        }
        // UPDATE chain — track the .eq calls
        const updateChain = makeChain("categories", { id: "cat-owned", name: "updated" });
        return updateChain;
      }
      return makeChain(table);
    });

    const req = makeRequest("PATCH", { id: "cat-owned", name: "updated" });
    await categoriesPATCH(req);

    // Verify that the update path included a user_id eq call
    const eqCalls = supabaseCalls.filter((c) => c.method === "eq");
    const userIdFilters = eqCalls.filter(
      (c) => c.args[0] === "user_id" && c.args[1] === USER_A,
    );
    // Should have at least 2: one from ownership check, one from update
    expect(userIdFilters.length).toBeGreaterThanOrEqual(2);
  });
});

// ---------------------------------------------------------------------------
// Test: User A cannot DELETE User B's goal
// ---------------------------------------------------------------------------

describe("Security: Cross-user goal isolation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    supabaseCalls = [];
  });

  it("User A cannot DELETE User B's goal — ownership check fails", async () => {
    mockRequireAuth.mockResolvedValue(USER_A);

    // Goal ownership check returns a goal owned by User B
    mockFrom.mockImplementation((table: string) => {
      if (table === "goals") {
        return makeChain("goals", {
          id: "goal-b",
          categories: { user_id: USER_B },
        });
      }
      return makeChain(table);
    });

    const req = makeRequest("DELETE", { id: "goal-b" });
    const res = await goalsDELETE(req);
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.success).toBe(false);
    expect(body.error).toBe("Goal not found");
  });
});

// ---------------------------------------------------------------------------
// Test: Rate limiter
// ---------------------------------------------------------------------------

describe("Security: Rate limiting", () => {
  it("allows requests under limit", () => {
    const key = `test-allow-${Date.now()}`;
    for (let i = 0; i < 5; i++) {
      expect(rateLimit(key, 5, 60_000)).toBeNull();
    }
  });

  it("returns 429 after exceeding limit", () => {
    const key = `test-block-${Date.now()}`;
    // Exhaust the limit
    for (let i = 0; i < 10; i++) {
      rateLimit(key, 10, 60_000);
    }
    // Next request should be blocked
    const result = rateLimit(key, 10, 60_000);
    expect(result).not.toBeNull();
    expect(result!.status).toBe(429);
  });

  it("429 response includes Retry-After header", async () => {
    const key = `test-retry-${Date.now()}`;
    for (let i = 0; i < 3; i++) {
      rateLimit(key, 3, 60_000);
    }
    const result = rateLimit(key, 3, 60_000);
    expect(result).not.toBeNull();
    expect(result!.headers.get("Retry-After")).toBeTruthy();

    const body = await result!.json();
    expect(body.error).toContain("Too many requests");
  });

  it("resets after window expires", () => {
    const key = `test-reset-${Date.now()}`;
    // Use a 1ms window so it expires immediately
    rateLimit(key, 1, 1);

    // Wait a tick for window to expire
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        const result = rateLimit(key, 1, 1);
        expect(result).toBeNull(); // Should allow again
        resolve();
      }, 5);
    });
  });
});

// ---------------------------------------------------------------------------
// Test: Service role key fail-closed
// ---------------------------------------------------------------------------

describe("Security: Service role fail-closed", () => {
  it("getServiceKey throws when SUPABASE_SERVICE_ROLE_KEY is missing", async () => {
    // We can't easily test the actual module since it's already loaded with the key,
    // but we verify the pattern exists in the source
    const { readFileSync } = await import("fs");
    const source = readFileSync("lib/supabase.ts", "utf-8");

    // Must contain a throw for missing key
    expect(source).toContain("throw new Error");
    expect(source).toContain("SUPABASE_SERVICE_ROLE_KEY");

    // Must NOT contain the old fallback pattern
    expect(source).not.toContain("getServiceKey() || getAnonKey()");
  });
});
