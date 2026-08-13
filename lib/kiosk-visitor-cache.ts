const KEY = "icccc.kiosk.visitor.v1";
const WAIT_MAX_MS = 8 * 60 * 60 * 1000;
const OUTCOME_MAX_MS = 30 * 60 * 1000;

export type VisitorWaitStatus = "pending" | "approved" | "denied";

export type VisitorCache = {
  onForm: boolean;
  name: string;
  reason: string;
  extras: boolean;
  requestId: string | null;
  requestStatus: VisitorWaitStatus | null;
  updatedAt: number;
};

const empty: VisitorCache = {
  onForm: false,
  name: "",
  reason: "",
  extras: false,
  requestId: null,
  requestStatus: null,
  updatedAt: 0,
};

function canUse() {
  return typeof window !== "undefined";
}

function rawRead(): VisitorCache | null {
  if (!canUse()) return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<VisitorCache>;
    return {
      onForm: Boolean(parsed.onForm),
      name: typeof parsed.name === "string" ? parsed.name : "",
      reason: typeof parsed.reason === "string" ? parsed.reason : "",
      extras: Boolean(parsed.extras),
      requestId:
        typeof parsed.requestId === "string" ? parsed.requestId : null,
      requestStatus:
        parsed.requestStatus === "pending" ||
        parsed.requestStatus === "approved" ||
        parsed.requestStatus === "denied"
          ? parsed.requestStatus
          : null,
      updatedAt: typeof parsed.updatedAt === "number" ? parsed.updatedAt : 0,
    };
  } catch {
    return null;
  }
}

export function readVisitorCache(): VisitorCache | null {
  const cache = rawRead();
  if (!cache) return null;
  if (!stillFresh(cache)) {
    clearVisitorCache();
    return null;
  }
  return cache;
}

function stillFresh(cache: VisitorCache) {
  const age = Date.now() - cache.updatedAt;
  if (cache.requestStatus === "pending") return age < WAIT_MAX_MS;
  if (cache.requestStatus === "approved" || cache.requestStatus === "denied") {
    return age < OUTCOME_MAX_MS;
  }
  return true;
}

export function writeVisitorCache(patch: Partial<VisitorCache>) {
  if (!canUse()) return;
  const next: VisitorCache = {
    ...(rawRead() ?? empty),
    ...patch,
    updatedAt: Date.now(),
  };
  const idle =
    !next.onForm &&
    !next.name.trim() &&
    !next.reason.trim() &&
    !next.extras &&
    !next.requestId;
  if (idle) {
    window.localStorage.removeItem(KEY);
    return;
  }
  window.localStorage.setItem(KEY, JSON.stringify(next));
}

export function clearVisitorCache() {
  if (!canUse()) return;
  window.localStorage.removeItem(KEY);
}
