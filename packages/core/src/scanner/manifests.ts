import path from 'node:path';
import type { ManifestSummary } from '../types.js';
import { readTextSafe } from './walk.js';

/**
 * Parse dependency manifests across ecosystems. We keep parsing intentionally
 * shallow and dependency-free: enough to describe a project, never executing it.
 */
export async function parseManifests(root: string, files: string[]): Promise<ManifestSummary[]> {
  const summaries: ManifestSummary[] = [];
  const byName = new Map(files.map((f) => [path.basename(f).toLowerCase(), f]));

  const pkg = byName.get('package.json');
  if (pkg) {
    const summary = await parsePackageJson(path.join(root, pkg), pkg);
    if (summary) summaries.push(summary);
  }

  const pyproject = byName.get('pyproject.toml');
  if (pyproject) {
    const summary = await parseToml(path.join(root, pyproject), pyproject, 'python');
    if (summary) summaries.push(summary);
  }

  const setup = byName.get('setup.py');
  if (setup && !pyproject) {
    summaries.push({ file: setup, ecosystem: 'python' });
  }

  const requirements = byName.get('requirements.txt');
  if (requirements) {
    const text = await readTextSafe(path.join(root, requirements));
    summaries.push({
      file: requirements,
      ecosystem: 'python',
      dependencies: text
        ? text
            .split('\n')
            .map((l) => l.trim())
            .filter((l) => l && !l.startsWith('#'))
            .slice(0, 40)
        : undefined,
    });
  }

  const cargo = byName.get('cargo.toml');
  if (cargo) {
    const summary = await parseToml(path.join(root, cargo), cargo, 'rust');
    if (summary) summaries.push(summary);
  }

  const goMod = byName.get('go.mod');
  if (goMod) {
    const text = await readTextSafe(path.join(root, goMod));
    const nameMatch = text?.match(/^module\s+(\S+)/m);
    summaries.push({
      file: goMod,
      ecosystem: 'go',
      name: nameMatch?.[1],
      dependencies: text
        ? [...text.matchAll(/^\s+([\w./-]+)\s+v[\w.-]+/gm)].map((m) => m[1]!).slice(0, 40)
        : undefined,
    });
  }

  const swift = byName.get('package.swift');
  if (swift) {
    const text = await readTextSafe(path.join(root, swift));
    const nameMatch = text?.match(/name:\s*"([^"]+)"/);
    const deps = text
      ? [...text.matchAll(/\.package\([^)]*url:\s*"([^"]+)"/g)].map((m) => {
          const url = m[1]!;
          return (
            url
              .replace(/\.git$/, '')
              .split('/')
              .pop() ?? url
          );
        })
      : [];
    summaries.push({
      file: swift,
      ecosystem: 'swift',
      name: nameMatch?.[1],
      dependencies: deps.slice(0, 40),
    });
  }

  const gemfile = byName.get('gemfile');
  if (gemfile) {
    summaries.push({ file: gemfile, ecosystem: 'ruby' });
  }

  const pom = byName.get('pom.xml');
  if (pom) summaries.push({ file: pom, ecosystem: 'java' });

  const gradle = byName.get('build.gradle') ?? byName.get('build.gradle.kts');
  if (gradle) summaries.push({ file: gradle, ecosystem: 'java/kotlin' });

  return summaries;
}

async function parsePackageJson(abs: string, rel: string): Promise<ManifestSummary | null> {
  const text = await readTextSafe(abs);
  if (!text) return null;
  try {
    const json = JSON.parse(text) as Record<string, any>;
    const deps = {
      ...(json.dependencies ?? {}),
      ...(json.devDependencies ?? {}),
    };
    let bin: string[] | undefined;
    if (typeof json.bin === 'string') bin = [json.bin];
    else if (json.bin && typeof json.bin === 'object') bin = Object.values(json.bin) as string[];
    return {
      file: rel,
      ecosystem: 'node',
      name: json.name,
      version: json.version,
      description: json.description,
      scripts: json.scripts ? Object.keys(json.scripts) : undefined,
      dependencies: Object.keys(deps).slice(0, 60),
      main: typeof json.main === 'string' ? json.main : undefined,
      bin,
    };
  } catch {
    return { file: rel, ecosystem: 'node', raw: text.slice(0, 2000) };
  }
}

/**
 * Minimal TOML reader for the two fields we care about ([project]/[package]
 * name + version, and a flattened dependency list). Not a full TOML parser.
 */
async function parseToml(
  abs: string,
  rel: string,
  ecosystem: string,
): Promise<ManifestSummary | null> {
  const text = await readTextSafe(abs);
  if (!text) return null;
  const nameMatch = text.match(/^\s*name\s*=\s*"([^"]+)"/m);
  const versionMatch = text.match(/^\s*version\s*=\s*"([^"]+)"/m);
  const descMatch = text.match(/^\s*description\s*=\s*"([^"]+)"/m);

  // Grab dependency table keys heuristically.
  const deps: string[] = [];
  const depSection = text.match(
    /\[(?:project\.dependencies|dependencies|tool\.poetry\.dependencies)\]([\s\S]*?)(?:\n\[|$)/,
  );
  if (depSection?.[1]) {
    for (const line of depSection[1].split('\n')) {
      const m = line.match(/^\s*([A-Za-z0-9_.-]+)\s*=/);
      if (m?.[1] && m[1] !== 'python') deps.push(m[1]);
    }
  }
  // PEP 621 array form: dependencies = ["foo>=1", ...]
  const arrayForm = text.match(/dependencies\s*=\s*\[([\s\S]*?)\]/);
  if (arrayForm?.[1]) {
    for (const m of arrayForm[1].matchAll(/"([A-Za-z0-9_.-]+)/g)) {
      if (m[1]) deps.push(m[1]);
    }
  }

  return {
    file: rel,
    ecosystem,
    name: nameMatch?.[1],
    version: versionMatch?.[1],
    description: descMatch?.[1],
    dependencies: deps.length ? [...new Set(deps)].slice(0, 60) : undefined,
  };
}
