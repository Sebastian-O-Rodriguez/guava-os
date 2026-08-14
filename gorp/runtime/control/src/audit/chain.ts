/**
 * Tamper-evident audit chain (Wave D).
 *
 * Every persisted run record (worker result, gate record, run record, review
 * decision, promotion record) gets one APPEND-ONLY entry in
 * `<runDir>/audit-chain.jsonl` at the moment it is written:
 *
 *   { seq, event, ref, sha256, prev, at, entryHash }
 *
 *   sha256    = SHA-256 of the referenced file's bytes at write time
 *   prev      = entryHash of the previous entry (64 zeros for the genesis)
 *   entryHash = SHA-256 of the canonical JSON of {seq,event,ref,sha256,prev,at}
 *
 * Verification recomputes every entryHash, checks the prev links, and checks
 * each referenced file's CURRENT bytes against its recorded sha256.
 *
 * EXACT GUARANTEES — no more, no less:
 *  - DETECTED: any edit or deletion of a chained record that is not
 *    accompanied by a consistent rewrite of the chain; any edit to an
 *    individual chain line (hash/link break); truncation that breaks links.
 *  - NOT DETECTED: an actor with write access to the state root who edits
 *    records and REGENERATES THE ENTIRE CHAIN consistently. There is NO
 *    EXTERNAL ANCHOR — no signing key, no remote or append-only external
 *    timestamp, nothing outside the run directory. Until such an anchor
 *    exists, this chain is integrity evidence against accidental corruption
 *    and naive edits, NOT a security boundary against a local adversary.
 *
 * The runtime itself never rewrites the chain — appendFileSync + fsync only.
 */

import { createHash } from "node:crypto";
import { appendFileSync, closeSync, existsSync, fsyncSync, openSync, readFileSync } from "node:fs";
import { GorpError } from "../errors/index.js";
import { serializeDeterministic } from "../storage/serialize.js";
import type { Clock } from "../graph/graph.js";

export const GENESIS = "0".repeat(64);

export type ChainEvent =
  | "worker-result"
  | "gate-record"
  | "run-record"
  | "review-decision"
  | "promotion-record"
  | "graph-reconcile";

export interface ChainEntry {
  readonly seq: number;
  readonly event: ChainEvent;
  readonly ref: string; // file name within the run directory
  readonly sha256: string; // hash of the referenced file's bytes at write time
  readonly prev: string; // previous entryHash (GENESIS for seq 0)
  readonly at: string; // injected clock timestamp
  readonly entryHash: string;
}

export function sha256Hex(data: string | Buffer): string {
  return createHash("sha256").update(data).digest("hex");
}

export function fileSha256(path: string): string {
  return sha256Hex(readFileSync(path));
}

function computeEntryHash(entry: Omit<ChainEntry, "entryHash">): string {
  return sha256Hex(serializeDeterministic(entry));
}

export function loadChain(chainPath: string): ChainEntry[] {
  if (!existsSync(chainPath)) return [];
  const raw = readFileSync(chainPath, "utf8");
  return raw
    .split("\n")
    .filter((l) => l.trim().length > 0)
    .map((l, i) => {
      try {
        return JSON.parse(l) as ChainEntry;
      } catch (e) {
        throw new GorpError("AUDIT_TAMPERED", "audit chain contains an unparseable line", {
          chainPath,
          line: i,
          cause: String(e),
        });
      }
    });
}

/** Append one entry for a just-written record file. Append-only, fsynced. */
export function appendChainEntry(
  chainPath: string,
  runDirPath: string,
  event: ChainEvent,
  ref: string,
  refPath: string,
  clock: Clock,
): ChainEntry {
  const existing = loadChain(chainPath);
  const prev = existing.length === 0 ? GENESIS : existing[existing.length - 1]!.entryHash;
  const body: Omit<ChainEntry, "entryHash"> = {
    seq: existing.length,
    event,
    ref,
    sha256: fileSha256(refPath),
    prev,
    at: clock.now(),
  };
  const entry: ChainEntry = { ...body, entryHash: computeEntryHash(body) };
  const fd = openSync(chainPath, "a");
  try {
    appendFileSync(fd, JSON.stringify(entry) + "\n");
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
  return entry;
}

export interface ChainProblem {
  readonly seq: number | null;
  readonly kind: "entry-hash" | "prev-link" | "seq-order" | "file-missing" | "file-hash";
  readonly detail: string;
}

export interface ChainVerification {
  readonly valid: boolean;
  readonly entries: readonly ChainEntry[];
  readonly problems: readonly ChainProblem[];
}

/**
 * Verify the whole chain: entry hashes, prev links, sequence, and every
 * referenced file's current content hash. Pure read.
 */
export function verifyChain(chainPath: string, resolveRef: (ref: string) => string): ChainVerification {
  const entries = loadChain(chainPath);
  const problems: ChainProblem[] = [];
  let prev = GENESIS;
  entries.forEach((e, i) => {
    const { entryHash, ...body } = e;
    if (computeEntryHash(body) !== entryHash) {
      problems.push({ seq: e.seq, kind: "entry-hash", detail: `entry ${i} hash mismatch (chain line edited)` });
    }
    if (e.prev !== prev) {
      problems.push({ seq: e.seq, kind: "prev-link", detail: `entry ${i} prev link broken` });
    }
    if (e.seq !== i) {
      problems.push({ seq: e.seq, kind: "seq-order", detail: `entry ${i} has seq ${e.seq}` });
    }
    const refPath = resolveRef(e.ref);
    if (!existsSync(refPath)) {
      problems.push({ seq: e.seq, kind: "file-missing", detail: `${e.ref} referenced by entry ${i} is missing` });
    } else if (fileSha256(refPath) !== e.sha256) {
      problems.push({ seq: e.seq, kind: "file-hash", detail: `${e.ref} was edited after it was chained` });
    }
    prev = entryHash;
  });
  return { valid: problems.length === 0, entries, problems };
}

/** Fail closed unless the chain (and every chained file) verifies. */
export function assertChainIntact(chainPath: string, resolveRef: (ref: string) => string): ChainVerification {
  const v = verifyChain(chainPath, resolveRef);
  if (!v.valid) {
    throw new GorpError("AUDIT_TAMPERED", "audit chain verification failed; records were edited or are missing", {
      problems: v.problems,
      mutation: false,
    });
  }
  return v;
}
