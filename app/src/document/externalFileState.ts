import type { FileRevision } from "../desktop/desktop";

export type ExternalFileState =
  | { kind: "none" }
  | { kind: "changed"; observedRevision: FileRevision }
  | { kind: "missing" };

export const noExternalFileState = (): ExternalFileState => ({ kind: "none" });
