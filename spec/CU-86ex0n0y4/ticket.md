# Ticket: CU-86ex0n0y4

- **Type**: task
- **Status**: in progress
- **URL**: https://app.clickup.com/t/86ex0n0y4
- **Parent**: none

## Description

Overview

Repo: ketone.md-resolver
Artifact: atomi/md
Language: TypeScript
Purpose: Merge CLAUDE.md files when multiple CyanPrint templates contribute one.

Approach

Section-based parsing. Split by # (H1 only), sort sections alphabetically, concat same-named sections.

Commutativity

Sort sections alphabetically (deterministic regardless of input order).

File Matching

Config in template's cyan.yaml:

resolvers:
  - resolver: atomi/md:1
    files: ['CLAUDE.MD']

Input Structure

# Overview

This is the project overview.

## Setup

### Prerequisites

Install the dependencies.

### Configuration

Configure the settings.

# Development

Instructions for development.

# Contributing

How to contribute.

Convention

# (H1) headers define section boundaries
## (H2) and deeper are content within a section (not boundaries)
Content within a section is plain text/mardown (no nesting merge)
Sections are separated by one or more blank lines
A section = { header: "# Overview", content: "This is the project overview." }

Merge Strategy

Parse each input into sections by splitting on #  (H1 only)
Group sections by header name (case-insensitive)
For same-named sections:
Split content into paragraphs (blocks separated by blank lines)
Concat all paragraphs from all versions
Sort paragraphs alphabetically
Sort all section names alphabetically
Reconstruct: # Header\n\n<content> with blank lines between sections

Example

Template A:

# Setup

Install deps.

# Usage

Run the app.

Template B:

# Usage

Build the app.

# Setup

Configure env.

Merged:

# Setup

Configure env.

Install deps.

# Usage

Build the app.

Run the app.

Edge Cases

Section with only blank content after merge  still include the section (with just the header)
Section in one template but not another  included as-is
H2 headers within content are preserved as-is (not parsed/merged)
Trailing whitespace in content: normalize (strip trailing spaces, keep paragraph structure)
Content has inline code, lists, etc: treated as opaque text within paragraphs

Testing Plan

Single file resolution (1 input  passthrough)
Two files, no shared sections  both included, alphabetically sorted
Two files, same section name  content concat + sorted
Three files, all same section  triple concat + sorted
Mixed: some shared sections, some unique
H2 headers preserved in content (not treated as sections)
Empty content section  still included
Trailing whitespace normalization

## Comments

No comments.
