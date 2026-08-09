/**
 * Shared atomic-write primitive: temp file in the same directory, fsync,
 * rename over the target. Prior state survives any failure.
 */

import { closeSync, fsyncSync, mkdirSync, openSync, renameSync, rmSync, writeSync } from "node:fs";
import { dirname } from "node:path";
import { GorpError } from "../errors/index.js";
import { serializeDeterministic } from "./serialize.js";

export function atomicWrite(target: string, contents: string): void {
  const tmp = `${target}.tmp.${process.pid}.${Date.now()}`;
  try {
    const fd = openSync(tmp, "w");
    writeSync(fd, contents);
    fsyncSync(fd);
    closeSync(fd);
    renameSync(tmp, target); // atomic on same filesystem
  } catch (e) {
    try {
      rmSync(tmp, { force: true });
    } catch {
      /* ignore */
    }
    throw new GorpError("STORAGE_FAILURE", "atomic write failed; prior state preserved", {
      target,
      cause: String(e),
    });
  }
}

/** Ensure the parent directory exists, then atomically write deterministic JSON. */
export function atomicWriteJson(target: string, value: unknown): void {
  try {
    mkdirSync(dirname(target), { recursive: true });
  } catch (e) {
    throw new GorpError("STORAGE_FAILURE", "cannot create state directory", {
      dir: dirname(target),
      cause: String(e),
    });
  }
  atomicWrite(target, serializeDeterministic(value));
}
