// Standalone test runner for the MD resolver (no Docker required)
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'fs';
import { join, resolve } from 'path';
import { parse } from 'yaml';
import { resolveMarkdown } from './index.ts';

const BASE = import.meta.dir;

interface Origin {
  template: string;
  layer: number;
}

interface TestInput {
  path: string;
  origin: Origin;
}

interface TestCase {
  name: string;
  expected: { type: string; value: { path: string } };
  config: Record<string, unknown>;
  resolver_inputs: TestInput[];
}

interface ResolverFile {
  path: string;
  content: string;
  origin: Origin;
}

async function main() {
  const testYaml = readFileSync(join(BASE, 'test.cyan.yaml'), 'utf-8');
  const testConfig = parse(testYaml);
  const tests: TestCase[] = testConfig.tests;

  let passed = 0;
  let failed = 0;
  const failures: string[] = [];

  const updateSnapshots = process.argv.includes('--update-snapshots');

  for (const test of tests) {
    try {
      const files: ResolverFile[] = test.resolver_inputs.map((input) => {
        const dir = resolve(BASE, input.path);
        const entries = readdirSync(dir);
        const filePath = join(dir, entries[0]);
        const content = readFileSync(filePath, 'utf-8');
        return {
          path: entries[0],
          content,
          origin: input.origin,
        };
      });

      const result = await resolveMarkdown({ config: test.config, files });
      const snapshotDir = resolve(BASE, test.expected.value.path);
      const snapshotFile = join(snapshotDir, result.path);

      if (updateSnapshots) {
        mkdirSync(snapshotDir, { recursive: true });
        writeFileSync(snapshotFile, result.content);
        console.log(`  SNAPSHOT: ${test.name}`);
        passed++;
      } else if (!existsSync(snapshotFile)) {
        console.log(`  FAIL: ${test.name} — missing snapshot file: ${snapshotFile}`);
        failed++;
        failures.push(test.name);
      } else {
        const expected = readFileSync(snapshotFile, 'utf-8');
        const actual = result.content.replace(/\r\n/g, '\n');
        const expectedNorm = expected.replace(/\r\n/g, '\n');

        if (actual === expectedNorm) {
          console.log(`  PASS: ${test.name}`);
          passed++;
        } else {
          console.log(`  FAIL: ${test.name} — snapshot mismatch`);
          const actualLines = actual.split('\n');
          const expectedLines = expectedNorm.split('\n');
          const maxLines = Math.min(
            Math.max(actualLines.length, expectedLines.length),
            20,
          );
          for (let i = 0; i < maxLines; i++) {
            if ((actualLines[i] ?? '') !== (expectedLines[i] ?? '')) {
              console.log(`    Line ${i + 1}:`);
              console.log(`      expected: ${JSON.stringify(expectedLines[i])}`);
              console.log(`      actual:   ${JSON.stringify(actualLines[i])}`);
            }
          }
          if (actualLines.length !== expectedLines.length) {
            console.log(
              `    Line count: expected=${expectedLines.length}, actual=${actualLines.length}`,
            );
          }
          failed++;
          failures.push(test.name);
        }
      }
    } catch (err) {
      console.log(`  ERROR: ${test.name} — ${err}`);
      failed++;
      failures.push(test.name);
    }
  }

  console.log(`\nResults: ${passed} passed, ${failed} failed, ${tests.length} total`);
  if (failures.length > 0) {
    console.log(`Failed tests: ${failures.join(', ')}`);
    process.exit(1);
  }
}

main();
