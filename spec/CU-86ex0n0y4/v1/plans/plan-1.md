# Plan 1: Implement Markdown Resolver

> Provide direction and suggestions, not exact code. Plans describe HOW to build, not the exact implementation.

## Goal

Implement the `atomi/md` CyanPrint resolver that merges Markdown files by H1 sections with configurable `sectionOrder` and `contentOrder` strategies.

## Scope

### In Scope

- H1-based section parsing (split on `# ` boundaries)
- Section ordering with 4 strategies: `alphabetical`, `reverse-alphabetical`, `lowest-layer-first`, `highest-layer-first`
- Content conflict resolution with the same 4 strategies
- Single file passthrough
- Preamble handling (content before first H1)
- Trailing whitespace normalization
- Edge cases: empty files, no H1s, empty sections

### Out of Scope

- H2+ merging, frontmatter, multi-file output

## Files to Modify

| File              | Change Type | Notes                                    |
| ----------------- | ----------- | ---------------------------------------- |
| `index.ts`        | modify      | Replace passthrough with full resolver    |
| `package.json`    | modify      | Add dependencies if needed (e.g. no external dep needed — pure string manipulation suffices for H1 splitting) |
| `test.cyan.yaml`  | modify      | Add comprehensive test cases             |

## Technical Approach

Follow the project's skill workflow in order: writing → testing → documenting.

### Step 1: Write resolver logic (`/writing-resolver-typescript`)

Use the `writing-resolver-typescript` skill. It covers entry point (`StartResolverWithLambda`), SDK types (`ResolverInput`, `ResolvedFile`, `ResolverOutput`, `FileOrigin`), and commutativity/associativity requirements.

1. **Parse sections** — Split each input file's content on H1 lines (`/^# /m`). Each section is `{header: string, content: string}`. Text before the first H1 becomes a preamble section with header `""`.

2. **Collect and deduplicate sections** — For each unique header, collect all versions with their `origin` metadata. Non-conflicting headers keep their single version.

3. **Resolve conflicts via `contentOrder`** — When a header has multiple versions, concatenate all paragraphs from all versions and sort them based on strategy. Content is never dropped:
   - `alphabetical` / `reverse-alphabetical` → sort paragraphs by text
   - `lowest-layer-first` / `highest-layer-first` → sort paragraphs by `origin.layer`
   - Tie-break: `origin.layer` asc, then `origin.template` asc

4. **Order sections via `sectionOrder`** — Sort all resolved sections:
   - `alphabetical` / `reverse-alphabetical` → sort by header name
   - `lowest-layer-first` / `highest-layer-first` → sort by `origin.layer` of the contributing file

5. **Reconstruct output** — Concatenate `# {header}\n\n{content}` with blank lines between sections. Normalize trailing whitespace per line.

6. **Single file shortcut** — If only 1 input, return as-is (no parsing needed).

### Step 2: Write tests (`/testing-resolver`)

Use the `testing-resolver` skill. It covers `test.cyan.yaml` format with `resolver_inputs` (directory paths with origin), config, and expected snapshot output.

### Step 3: Document (`/documenting-resolver`)

Use the `documenting-resolver` skill. It reads `cyan.yaml` and entry point code to extract config schema and resolution logic for `README.MD`.

## Edge Cases to Handle

- **Content before first H1**: Stored as preamble section with `header: ""`, participates in ordering
- **Empty content section**: Still included (header only)
- **No H1 at all**: Entire file is preamble
- **All files empty**: Return empty string
- **Trailing whitespace**: Strip trailing spaces per line, preserve blank line structure

## How to Test

Use `test.cyan.yaml` with snapshot testing. Test cases:

1. Single file passthrough
2. Two files, no shared sections — both included, ordered per config
3. Two files, same section name — conflict resolved per `contentOrder`
4. Three files, all same section — triple conflict
5. Mixed: some shared, some unique
6. H2+ preserved in content
7. Preamble (content before first H1)
8. Empty content section
9. Trailing whitespace normalization
10. Commutativity (swap input order → same output)
11. Each `sectionOrder` strategy
12. Each `contentOrder` strategy

## Integration Points

- **Depends on**: nothing (standalone resolver)
- **Blocks**: nothing
- **Shared state**: none

## Implementation Checklist

- [ ] `/writing-resolver-typescript` — implement resolver logic in `index.ts`
- [ ] `/testing-resolver` — write test cases in `test.cyan.yaml`, run `cyanprint test resolver .`
- [ ] `/documenting-resolver` — update `README.MD` with config schema and merge behavior

## Success Criteria

- [ ] All test cases pass with `cyanprint test resolver .`
- [ ] Commutativity verified: swapping inputs produces identical output
- [ ] All 4 `sectionOrder` strategies produce correct ordering
- [ ] All 4 `contentOrder` strategies resolve conflicts correctly
