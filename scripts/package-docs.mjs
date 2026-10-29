import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve, sep } from 'node:path';

export const packageDocs = [
  'README.md', 'PROJECT.md', 'PROGRESS.md', 'REFERENCES.md', 'CHANGELOG.md',
  'docs/API.md', 'docs/CLI.md', 'docs/COMPATIBILITY.md', 'docs/THIRD_PARTY.md',
  'docs/PERFORMANCE.md', 'docs/LARGE_WORKBENCH.md', 'docs/AI_EXPERIMENT.md',
  'docs/AI_RESULTS_2026-10-24.md', 'docs/SCENARIOS.md', 'notes/PROJECT_REUSE.md',
];

// Product entry points must remain usable in the extracted portable archive.
export function checkPackageLinks(directory) {
  const root = resolve(directory);
  const checked = [];
  for (const document of packageDocs) {
    const text = readFileSync(resolve(root, document), 'utf8');
    for (const match of text.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
      const href = match[1];
      if (/^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith('#')) continue;
      const target = resolve(dirname(resolve(root, document)), decodeURIComponent(href.split('#')[0]));
      if (!target.startsWith(root + sep) || !existsSync(target)) {
        throw new Error(`Broken packaged document link: ${document} -> ${href}`);
      }
      checked.push({ document, href });
    }
  }
  return checked;
}
