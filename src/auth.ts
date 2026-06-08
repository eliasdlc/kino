// Single source of truth: re-export the root Better Auth instance (which is the
// one mounted by /api/auth/[...all]). Keeping this alias avoids touching the
// many `@/auth` importers while ensuring every consumer — getSession, the OAuth
// resource client, and the .well-known routes — uses the same plugin-enabled
// instance.
export { auth } from "../auth";
