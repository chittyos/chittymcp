import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const WORKFLOW_PATH = resolve(__dirname, '../.github/workflows/governance-gates.yml');

const CANONICAL_USES =
  'CHITTYOS/chittycommand/.github/workflows/reusable-governance-gates.yml@main';
const OLD_LOCAL_USES = './.github/workflows/reusable-governance-gates.yml';

let workflowContent;
try {
  workflowContent = readFileSync(WORKFLOW_PATH, 'utf8');
} catch (err) {
  throw new Error(`Failed to read governance-gates.yml: ${err.message}`);
}

describe('governance-gates.yml workflow', () => {
  describe('workflow metadata', () => {
    it('has the correct workflow name', () => {
      assert.match(workflowContent, /^name:\s*Governance Gates\s*$/m);
    });
  });

  describe('trigger configuration', () => {
    it('triggers on pull_request events', () => {
      assert.match(workflowContent, /pull_request/);
    });

    it('triggers on push events', () => {
      assert.match(workflowContent, /push:/);
    });

    it('restricts push trigger to the main branch', () => {
      assert.match(workflowContent, /branches:\s*\[\s*main\s*\]/);
    });
  });

  describe('jobs definition', () => {
    it('defines a job named "gates"', () => {
      assert.match(workflowContent, /^\s*gates:/m);
    });

    it('passes secrets to the reusable workflow', () => {
      assert.match(workflowContent, /secrets:\s*inherit/);
    });
  });

  describe('canonical reusable workflow reference (the PR change)', () => {
    it('uses the canonical external repository reference', () => {
      assert.ok(
        workflowContent.includes(CANONICAL_USES),
        `Expected workflow to use canonical reference "${CANONICAL_USES}" but it was not found`,
      );
    });

    it('includes the @main version pin in the uses reference', () => {
      assert.match(
        workflowContent,
        /uses:\s*CHITTYOS\/chittycommand\/.github\/workflows\/reusable-governance-gates\.yml@main/,
      );
    });

    it('references the correct organisation and repository (CHITTYOS/chittycommand)', () => {
      assert.match(workflowContent, /CHITTYOS\/chittycommand\//);
    });

    it('references the correct reusable workflow filename', () => {
      assert.match(workflowContent, /reusable-governance-gates\.yml/);
    });

    it('does NOT use the old local workflow reference', () => {
      assert.ok(
        !workflowContent.includes(OLD_LOCAL_USES),
        `Workflow must not reference the deprecated local path "${OLD_LOCAL_USES}"`,
      );
    });

    it('does NOT use any local (./) path as the uses value', () => {
      // Ensure no line starting with `uses:` points to a local path
      const usesLines = workflowContent
        .split('\n')
        .filter((line) => /^\s*uses:\s*\.\//.test(line));
      assert.equal(
        usesLines.length,
        0,
        `Found local uses reference(s): ${usesLines.join(', ')}`,
      );
    });

    it('includes a version pin (@ suffix) so the reference is not unpinned', () => {
      // Any `uses:` line that references an external repo must carry a version pin
      const externalUsesLines = workflowContent
        .split('\n')
        .filter((line) => /^\s*uses:\s*[^./]/.test(line)); // external (not local) uses lines
      for (const line of externalUsesLines) {
        assert.match(
          line,
          /@/,
          `External uses reference is missing a version pin: "${line.trim()}"`,
        );
      }
    });
  });

  describe('regression guard', () => {
    it('workflow file is non-empty and well-formed enough to contain jobs', () => {
      assert.match(workflowContent, /^jobs:/m);
    });

    it('uses value is exactly the canonical reference with no trailing whitespace', () => {
      const match = workflowContent.match(/uses:\s*(.+)/);
      assert.ok(match, 'No uses: line found in the workflow');
      const usesValue = match[1].trim();
      assert.equal(
        usesValue,
        CANONICAL_USES,
        `Expected uses value to be "${CANONICAL_USES}", got "${usesValue}"`,
      );
    });

    it('workflow contains exactly one uses declaration', () => {
      const usesMatches = workflowContent.match(/^\s*uses:/gm) || [];
      assert.equal(
        usesMatches.length,
        1,
        `Expected exactly 1 "uses:" declaration, found ${usesMatches.length}`,
      );
    });
  });
});
