// Test-only stand-in for the "server-only" package. That package's
// default export unconditionally throws (it relies on Next.js
// resolving its "react-server" export condition at build time to swap
// in a no-op) -- fine for real app builds, but it means anything that
// does `import "server-only"` can't be imported directly under a plain
// Node test runner. Vitest is configured (see vitest.config.ts) to
// alias "server-only" to this empty file for tests only; production
// builds still resolve the real package via Next.js.
export {};
