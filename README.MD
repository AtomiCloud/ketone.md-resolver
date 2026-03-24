# CyanPrint Resolver atomi/md

AtomiCloud's markdown resolver

## Purpose

Merges multiple Markdown files that conflict on the same path by splitting each file on H1 (`# `) boundaries, resolving conflicts per section, then reassembling. Each H1 section is treated as an independent unit — sections unique to one file are always included, while sections shared across multiple files are resolved using a configurable strategy.

## Configuration Schema

| Key           | Type   | Default             | Description                                                                                       |
| ------------- | ------ | ------------------- | ------------------------------------------------------------------------------------------------- |
| `sectionOrder` | string | `alphabetical`      | Strategy for ordering sections in the final output. See [Strategies](#strategies) for options.    |
| `contentOrder` | string | `lowest-layer-first` | Strategy for resolving conflicts when multiple files define the same H1 section.                  |

### Strategies

Both `sectionOrder` and `contentOrder` accept one of four values:

| Value                   | Behavior                                                  |
| ----------------------- | --------------------------------------------------------- |
| `alphabetical`          | Sort by section header name (A–Z) or content text (A–Z)  |
| `reverse-alphabetical`  | Sort by section header name (Z–A) or content text (Z–A)  |
| `lowest-layer-first`    | Sort by origin layer ascending (layer 0 before layer 1)   |
| `highest-layer-first`   | Sort by origin layer descending (layer 1 before layer 0)  |

For `sectionOrder`, the sort key is the section header name (or layer for layer-based strategies). For `contentOrder`, the sort key is the section's content text (or layer for layer-based strategies).

## Resolution Strategy

1. **Parse** — Each input file is split on H1 lines (`# ...`). Text before the first H1 becomes a preamble section with an empty header.
2. **Deduplicate** — Sections with the same header are grouped. Unique sections are kept as-is.
3. **Resolve conflicts** — When a header appears in multiple files, all content blocks from all versions are concatenated (separated by blank lines) and sorted based on `contentOrder`. Content is never dropped. Ties are broken by layer ascending, then template name ascending.
4. **Order** — All resolved sections are sorted based on `sectionOrder`.
5. **Reconstruct** — Sections are concatenated with blank lines between them. Trailing whitespace is normalized per line.
6. **Single file passthrough** — If only one input file is provided, it is returned as-is with trailing whitespace normalized.

### Edge Cases

- **Content before first H1**: Stored as preamble section (empty header), participates in ordering and conflict resolution.
- **Empty content section**: Header-only sections are preserved.
- **No H1 at all**: Entire file is treated as preamble.
- **All files empty**: Returns empty string.

## Commutativity and Associativity

CyanPrint may invoke the resolver with files in any order. The resolver produces identical output regardless of input ordering by:

- **Sorting inputs** before processing (layer ascending, then template name ascending) to establish a deterministic processing order.
- **Deterministic conflict resolution**: When multiple files contribute the same section, all content blocks are concatenated and sorted per `contentOrder`; ties are broken by layer then template name.
- **Deterministic section ordering**: The `sectionOrder` strategy sorts all sections into a final order independent of input sequence.
- **Unique section deduplication**: Each header appears exactly once in the output.

## Merge Examples

### Example 1: No Conflict — Two Files, Different Sections

**Input files** (all sharing the same path):

| Origin Template | Origin Layer | Content                |
| --------------- | ------------ | ---------------------- |
| template-a      | 0            | `# Alpha\n\nFrom A.`   |
| template-b      | 1            | `# Beta\n\nFrom B.`    |

**Config**:

```yaml
sectionOrder: alphabetical
contentOrder: lowest-layer-first
```

**Resolved output**:

```
# Alpha

From A.

# Beta

From B.
```

Both sections are unique, so both are included. Ordered alphabetically by header.

### Example 2: Conflict — Same Section Header

**Input files** (all sharing the same path):

| Origin Template | Origin Layer | Content                          |
| --------------- | ------------ | -------------------------------- |
| template-a      | 0            | `# Overview\n\nAlpha version.`   |
| template-b      | 1            | `# Overview\n\nBeta version.`    |

**Config**:

```yaml
sectionOrder: alphabetical
contentOrder: lowest-layer-first
```

**Resolved output**:

```
# Overview

Alpha version.

Beta version.
```

Both files define `# Overview`. With `contentOrder: lowest-layer-first`, both content blocks are concatenated, ordered by layer ascending (layer 0 first, layer 1 second).

### Example 3: Mixed — Some Shared, Some Unique

**Input files** (all sharing the same path):

| Origin Template | Origin Layer | Content                                               |
| --------------- | ------------ | ----------------------------------------------------- |
| template-a      | 0            | `# Introduction\n\nIntro from A.\n\n# Setup\n\nSetup A.` |
| template-b      | 1            | `# Introduction\n\nIntro from B.\n\n# Config\n\nCfg B.` |

**Config**:

```yaml
sectionOrder: alphabetical
contentOrder: lowest-layer-first
```

**Resolved output**:

```
# Config

Cfg B.

# Introduction

Intro from A.

Intro from B.

# Setup

Setup A.
```

`# Introduction` appears in both files — both content blocks are concatenated, ordered by layer ascending. `# Config` and `# Setup` are unique. Sections ordered alphabetically.

## Integration

Reference this resolver in a template's `cyan.yaml`:

```yaml
resolvers:
  - resolver: atomi/md:1
    config:
      sectionOrder: alphabetical
      contentOrder: lowest-layer-first
    files: ['**/*.md']
```

## Contributors

- [md](mailto:ernest@atomi.cloud)
