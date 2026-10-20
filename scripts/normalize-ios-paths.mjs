import { existsSync, readFileSync, writeFileSync } from 'node:fs';

// Capacitor can emit Windows separators in Swift package paths after sync.
// Keep the checked-in project usable by Xcode on macOS as well.
const manifest = new URL('../ios/App/CapApp-SPM/Package.swift', import.meta.url);
if (existsSync(manifest)) {
  const source = readFileSync(manifest, 'utf8');
  const normalized = source.replace(/path: "([^"]*)"/g, (_, value) =>
    `path: "${value.replaceAll('\\', '/')}"`);
  if (normalized !== source) writeFileSync(manifest, normalized);
}
