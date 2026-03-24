# Task Specification: Markdown File Resolver (CU-86ex0n0y4)

## Source

- Ticket: CU-86ex0n0y4
- System: ClickUp
- URL: https://app.clickup.com/t/86ex0n0y4

## Summary

Build a CyanPrint resolver (`atomi/md`) that merges Markdown files when multiple templates contribute files to the same path. The resolver parses files by H1 headers, treats everything under each header as a single opaque content block, and produces a deterministic merged output using configurable ordering and conflict strategies.

## Acceptance Criteria

- [ ] Resolver parses Markdown files by splitting on H1 (`# `) boundaries only — H2+ headers within a section are treated as content, not boundaries
- [ ] Each section is a `{header: string, content: string}` pair where header is the H1 text and content is everything after it until the next H1 or end of file
- [ ] Single input file → passthrough (return as-is)
- [ ] Multiple inputs with no H1 conflicts → all sections collected, ordered per `sectionOrder` config, output reconstructed with blank lines between sections
- [ ] Multiple inputs with H1 conflicts → all paragraphs from all versions are concatenated, sorted per `contentOrder` config (content is never dropped)
- [ ] Commutativity: swapping any two input files produces identical output (deterministic sorting based on metadata, not input order)
- [ ] Associativity: the resolver processes all inputs in a single pass (no pairwise merging)
- [ ] Resolver works for any Markdown file, not just CLAUDE.md

## Out of Scope

- Content-aware merging (paragraph-level diffing, semantic deduplication)
- H2+ header merging or nesting
- Frontmatter / YAML header handling
- Multi-file output (always produces a single resolved file)

## Config Schema

Two config knobs, both using the same set of strategies:

```yaml
config:
  sectionOrder: alphabetical       # default: how to order sections in output
  contentOrder: lowest-layer-first # default: how to sort concatenated paragraphs on header conflict
```

### Strategy Options

| Strategy              | `sectionOrder` sorts by   | `contentOrder` sorts paragraphs by       |
| --------------------- | ------------------------- | --------------------------------------- |
| `alphabetical`        | Header name, A→Z          | Paragraph text, A→Z                    |
| `reverse-alphabetical`| Header name, Z→A          | Paragraph text, Z→A                    |
| `lowest-layer-first`  | Layer ascending (0, 1..)  | Origin layer ascending (lowest first)  |
| `highest-layer-first` | Layer descending          | Origin layer descending (highest first)|

**Defaults:**
- `sectionOrder`: `alphabetical`
- `contentOrder`: `lowest-layer-first`

### Behavior Details

**`sectionOrder`** — determines the final order of sections in the output:
- `alphabetical` → sort by header name A→Z
- `reverse-alphabetical` → sort by header name Z→A
- `lowest-layer-first` → sort by the `origin.layer` of the contributing file, ascending
- `highest-layer-first` → sort by the `origin.layer` of the contributing file, descending

**`contentOrder`** — when the same H1 header appears in multiple inputs, all paragraphs from all versions are concatenated. `contentOrder` determines the sort order of concatenated paragraphs:
- `alphabetical` → sort paragraphs by text, A→Z
- `reverse-alphabetical` → sort paragraphs by text, Z→A
- `lowest-layer-first` → sort paragraphs by origin layer ascending (paragraphs from lower layers first)
- `highest-layer-first` → sort paragraphs by origin layer descending (paragraphs from higher layers first)

Content is never dropped — every paragraph from every template is included, just sorted according to `contentOrder`.

For tie-breaking in any strategy, sort by `origin.layer` ascending, then `origin.template` alphabetically ascending.

## Constraints

- Must use `@atomicloud/cyan-sdk` v2.1.0 with `StartResolverWithLambda`
- Output must be deterministic (same inputs in any order → same output)
- External dependencies are allowed (e.g., markdown parsing libraries if needed)
- Built for Bun runtime (per existing `package.json`)

## Context

- This resolver lives in the `ketone.md-resolver` repo (artifact `atomi/md`)
- The existing `index.ts` has a placeholder passthrough — it needs to be replaced with the full implementation
- Follow patterns from the `json-yaml` resolver: sort by layer then template for deterministic tie-breaking
- Template usage: `files: ['**/*.md']` or specific filenames like `['CLAUDE.MD']`

## Edge Cases

- **Content before first H1**: Any text before the first `# ` heading is preserved as a "preamble" section (header = empty string or a sentinel). Included in output with the same ordering rules.
- **Empty content section**: A section with a header but no content (or only whitespace) is still included in the output
- **Trailing whitespace**: Strip trailing spaces from each line; preserve blank line structure between paragraphs within content
- **Identical content across templates**: No deduplication — if a non-conflicting section appears with the same content in multiple inputs, only one copy is kept (sections are keyed by header name)
- **All files empty**: Return empty string
- **No H1 headers at all**: Treat entire file content as a preamble (same as "content before first H1")

---

## Implementation Checklist

### Documentation

- [ ] Update `README.MD` with resolver description and config options
- [ ] Update `cyan.yaml` description if needed

### Testing

- [ ] Single file passthrough
- [ ] Two files, no shared sections (both included, ordered per config)
- [ ] Two files, same section name (conflict resolved per config)
- [ ] Three files, all same section (triple conflict resolved per config)
- [ ] Mixed: some shared sections, some unique
- [ ] H2+ headers preserved in content (not treated as section boundaries)
- [ ] Content before first H1 (preamble)
- [ ] Empty content section still included
- [ ] Trailing whitespace normalization
- [ ] Commutativity: same output regardless of input file order
- [ ] All config strategy combinations for both `sectionOrder` and `contentOrder`

**Test location:** `test.cyan.yaml` with snapshot testing per CyanPrint conventions

### Notes

- Existing test (`single_file_resolve`) should be kept/updated
- No observability requirements (resolver is a pure function)
