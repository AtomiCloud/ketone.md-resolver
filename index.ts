import { StartResolverWithLambda } from '@atomicloud/cyan-sdk';
import type { ResolverInput, ResolverOutput } from '@atomicloud/cyan-sdk';

export type OrderStrategy = 'alphabetical' | 'reverse-alphabetical' | 'lowest-layer-first' | 'highest-layer-first';

interface FileOrigin {
  template: string;
  layer: number;
}

interface ResolvedFile {
  readonly path: string;
  readonly content: string;
  readonly origin: FileOrigin;
}

interface Section {
  header: string;
  content: string;
  origin: FileOrigin;
}

// --- H1 Section Parsing ---

function parseSections(file: ResolvedFile): Section[] {
  const content = file.content.replace(/\r\n?/g, '\n');
  const sections: Section[] = [];

  const lines = content.split('\n');
  let currentHeader = '';
  let currentLines: string[] = [];
  let isFirstSection = true;

  for (const line of lines) {
    if (line.startsWith('# ') && line.length > 2) {
      if (isFirstSection) {
        const preamble = trimSectionContent(currentLines);
        if (preamble.length > 0) {
          sections.push({ header: '', content: preamble, origin: file.origin });
        }
        isFirstSection = false;
        currentLines = [];
      } else {
        const sectionContent = trimSectionContent(currentLines);
        sections.push({ header: currentHeader, content: sectionContent, origin: file.origin });
        currentLines = [];
      }
      currentHeader = line.slice(2);
    } else {
      currentLines.push(line);
    }
  }

  if (isFirstSection) {
    const text = trimSectionContent(currentLines);
    if (text.length > 0) {
      sections.push({ header: '', content: text, origin: file.origin });
    }
  } else {
    const sectionContent = trimSectionContent(currentLines);
    sections.push({ header: currentHeader, content: sectionContent, origin: file.origin });
  }

  return sections;
}

// Trim leading blank lines and trailing whitespace from section content lines
function trimSectionContent(lines: string[]): string {
  // Find first non-empty line index
  let start = 0;
  while (start < lines.length && lines[start].trim() === '') start++;
  return lines.slice(start).join('\n').trimEnd();
}

// --- Sorting Helpers ---

function sortLayerAsc(a: Section, b: Section): number {
  if (a.origin.layer !== b.origin.layer) return a.origin.layer - b.origin.layer;
  return a.origin.template.localeCompare(b.origin.template);
}

function sortLayerDesc(a: Section, b: Section): number {
  if (a.origin.layer !== b.origin.layer) return b.origin.layer - a.origin.layer;
  return a.origin.template.localeCompare(b.origin.template);
}

function sortHeaderAsc(a: Section, b: Section): number {
  return a.header.localeCompare(b.header);
}

function sortHeaderDesc(a: Section, b: Section): number {
  return b.header.localeCompare(a.header);
}

function sortContentAsc(a: Section, b: Section): number {
  return a.content.localeCompare(b.content);
}

function sortContentDesc(a: Section, b: Section): number {
  return b.content.localeCompare(a.content);
}

const VALID_STRATEGIES: readonly OrderStrategy[] = ['alphabetical', 'reverse-alphabetical', 'lowest-layer-first', 'highest-layer-first'];

function validateStrategy(value: unknown, field: string): OrderStrategy {
  if (VALID_STRATEGIES.includes(value as OrderStrategy)) return value as OrderStrategy;
  throw new Error(`Invalid ${field}: "${String(value)}". Must be one of: ${VALID_STRATEGIES.join(', ')}`);
}

function pickComparator(strategy: OrderStrategy): (a: Section, b: Section) => number {
  switch (strategy) {
    case 'alphabetical':
      return sortHeaderAsc;
    case 'reverse-alphabetical':
      return sortHeaderDesc;
    case 'lowest-layer-first':
      return sortLayerAsc;
    case 'highest-layer-first':
      return sortLayerDesc;
  }
}

function pickContentComparator(strategy: OrderStrategy): (a: Section, b: Section) => number {
  switch (strategy) {
    case 'alphabetical':
      return sortContentAsc;
    case 'reverse-alphabetical':
      return sortContentDesc;
    case 'lowest-layer-first':
      return sortLayerAsc;
    case 'highest-layer-first':
      return sortLayerDesc;
  }
}

function normalizeTrailingWhitespace(content: string): string {
  return content
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n');
}

function splitParagraphs(content: string): string[] {
  return content.trim() === '' ? [] : content.split(/\n\s*\n+/);
}

// --- Core resolver logic (exported for testing) ---

export async function resolveMarkdown(input: ResolverInput): Promise<ResolverOutput> {
  const { config, files } = input;

  if (files.length === 0) throw new Error('Resolver received no files — at least 1 file is required');
  const uniquePaths = new Set(files.map((f) => f.path));
  if (uniquePaths.size > 1)
    throw new Error(
      `Resolver received files with different paths: ${[...uniquePaths].join(', ')} — all files must have the same path`,
    );

  const path = files[0].path;

  // Single file passthrough
  if (files.length === 1) {
    return { path, content: normalizeTrailingWhitespace(files[0].content) };
  }

  // Sort for commutativity (layer ascending, then template name)
  const sorted = [...files].sort((a, b) => {
    if (a.origin.layer !== b.origin.layer) return a.origin.layer - b.origin.layer;
    return a.origin.template.localeCompare(b.origin.template);
  });

  const sectionOrder = validateStrategy(config.sectionOrder ?? 'alphabetical', 'sectionOrder');
  const contentOrder = validateStrategy(config.contentOrder ?? 'lowest-layer-first', 'contentOrder');

  // Parse all sections from all files
  const allSections: Section[] = [];
  for (const file of sorted) {
    allSections.push(...parseSections(file));
  }

  if (allSections.length === 0) {
    return { path, content: '' };
  }

  // Group sections by header
  const grouped = new Map<string, Section[]>();
  for (const section of allSections) {
    const existing = grouped.get(section.header);
    if (existing) {
      existing.push(section);
    } else {
      grouped.set(section.header, [section]);
    }
  }

  // Resolve conflicts: for each header, concatenate all version contents sorted by contentOrder
  const contentComparator = pickContentComparator(contentOrder);
  const resolved: Section[] = [];

  for (const [, versions] of grouped) {
    if (versions.length === 1) {
      resolved.push(versions[0]);
    } else {
      // Collect all paragraphs from all versions, sort by contentOrder, concatenate
      const tagged = versions.flatMap((v) =>
        splitParagraphs(v.content).map((content) => ({
          content,
          origin: v.origin,
        })),
      );
      tagged.sort((a, b) => {
        const cmp = contentComparator(
          { header: '', content: a.content, origin: a.origin },
          { header: '', content: b.content, origin: b.origin },
        );
        if (cmp !== 0) return cmp;
        // Tie-break: layer asc, then template asc
        if (a.origin.layer !== b.origin.layer) return a.origin.layer - b.origin.layer;
        return a.origin.template.localeCompare(b.origin.template);
      });
      // Concatenate non-empty content blocks separated by blank lines
      const mergedContent = tagged
        .filter((t) => t.content.length > 0)
        .map((t) => t.content)
        .join('\n\n');
      // Select origin appropriate for the sectionOrder strategy:
      // layer-based strategies need the matching extremum origin for correct positioning
      const mergedOrigin = sectionOrder === 'highest-layer-first'
        ? versions[versions.length - 1].origin
        : versions[0].origin;
      resolved.push({ header: versions[0].header, content: mergedContent, origin: mergedOrigin });
    }
  }

  // Sort sections by sectionOrder strategy
  const sectionComparator = pickComparator(sectionOrder);
  resolved.sort(sectionComparator);

  // Reconstruct output
  const parts: string[] = [];
  for (const section of resolved) {
    if (section.header === '') {
      if (section.content.length > 0) {
        parts.push(section.content);
      }
    } else {
      if (section.content.length > 0) {
        parts.push(`# ${section.header}\n\n${section.content}`);
      } else {
        parts.push(`# ${section.header}`);
      }
    }
  }

  const content = normalizeTrailingWhitespace(parts.join('\n\n'));
  return { path, content };
}

// --- Entry Point ---

StartResolverWithLambda(resolveMarkdown);
