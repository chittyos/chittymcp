# `chittyagent-git` — read-only git tool upstream (SPEC)

> Status: SPEC. No worker implemented yet. Tracked in followup issue.
> Implementation lives in `github.com/CHITTYOS/chittyentity/workers/chittyagent-git`
> per MCP-SOP §2. This document is the upstream contract chittymcp will federate.

## Scope

Read-only git inspection for non-shell channels (ChatGPT, mobile Claude, scheduled
routines, ch1tty slim-MCP via `search`+`execute`). Write/sensitive git operations
(`git_commit`, `git_push`, `git_tag`) are intentionally **not** in this upstream —
they live on ChittyConnect (`connect.chitty.cc/mcp`) behind OAuth + 1Password +
ChittyLedger audit per the sensitive-intent contract.

## Aggregator surface

| Aggregator | Namespaced path | Membership |
|------------|-----------------|------------|
| `chittymcp` | `mcp.chitty.cc/git/mcp` | `surface:all` (default) |
| `ch1tty`    | `ch1tty.chitty.cc` (slim-MCP `search`+`execute`) | `audience:human ∧ auth:oauth-ok` — included |
| `chittymsg` | excluded | not `domain:messaging` |

## Tool naming (MCP-SOP §3)

`<service>_<verb>` snake_case. The task spec used dot-notation (`git.status`);
canonical naming wins.

| Canonical name      | Purpose |
|---------------------|---------|
| `git_status`        | Porcelain v2 status of a repo |
| `git_log`           | Commit history with optional path/ref filters |
| `git_diff`          | Diff between two refs or vs working tree |
| `git_show`          | Show a single commit/tag with optional path filter |
| `git_blame`         | Line-level authorship for a file at a ref |
| `git_branch_list`   | Local and/or remote branches, with merged-into filter |

## Repo allowlist (binding)

chittymcp upstreams are stateless. The `chittyagent-git` worker MUST constrain
which paths it can read via an env-configured allowlist:

- **Env var:** `CHITTYMCP_GIT_REPO_ROOTS` — colon-separated absolute path prefixes
- **Default:** `/home/ubuntu/projects/`
- **Resolution:** Each call's `repo_path` is canonicalized (no `..`, no symlinks
  escaping the prefix) and prefix-matched. Failures return `REPO_NOT_ALLOWED`.
- **Cold source:** value provisioned via 1Password → CF secrets store. Per global
  policy, never paste-in. The allowlist itself is non-secret but follows the
  same provisioning path for consistency.

## Tool schemas

### `git_status`

```json
{
  "name": "git_status",
  "description": "Return porcelain v2 status for a repo.",
  "input_schema": {
    "type": "object",
    "required": ["repo_path"],
    "additionalProperties": false,
    "properties": {
      "repo_path": { "type": "string", "description": "Absolute path; must match CHITTYMCP_GIT_REPO_ROOTS." }
    }
  },
  "output_schema": {
    "type": "object",
    "required": ["branch", "ahead", "behind", "entries"],
    "properties": {
      "branch":  { "type": "string" },
      "upstream":{ "type": ["string", "null"] },
      "ahead":   { "type": "integer", "minimum": 0 },
      "behind":  { "type": "integer", "minimum": 0 },
      "entries": {
        "type": "array",
        "items": {
          "type": "object",
          "required": ["path", "index_status", "worktree_status"],
          "properties": {
            "path":            { "type": "string" },
            "index_status":    { "type": "string", "description": "Porcelain v2 XY[0]" },
            "worktree_status": { "type": "string", "description": "Porcelain v2 XY[1]" },
            "renamed_from":    { "type": ["string", "null"] }
          }
        }
      }
    }
  }
}
```

### `git_log`

```json
{
  "name": "git_log",
  "description": "Return commit history.",
  "input_schema": {
    "type": "object",
    "required": ["repo_path"],
    "additionalProperties": false,
    "properties": {
      "repo_path":   { "type": "string" },
      "ref":         { "type": "string", "default": "HEAD" },
      "max_count":   { "type": "integer", "default": 20, "minimum": 1, "maximum": 500 },
      "path_filter": { "type": "string", "description": "Optional path or pathspec to filter commits touching it." }
    }
  },
  "output_schema": {
    "type": "object",
    "required": ["commits"],
    "properties": {
      "commits": {
        "type": "array",
        "items": {
          "type": "object",
          "required": ["sha", "author", "date", "subject"],
          "properties": {
            "sha":     { "type": "string" },
            "author":  { "type": "string" },
            "email":   { "type": "string" },
            "date":    { "type": "string", "format": "date-time" },
            "subject": { "type": "string" },
            "body":    { "type": "string" }
          }
        }
      }
    }
  }
}
```

### `git_diff`

```json
{
  "name": "git_diff",
  "description": "Diff between two refs, or ref vs working tree.",
  "input_schema": {
    "type": "object",
    "required": ["repo_path", "ref_a"],
    "additionalProperties": false,
    "properties": {
      "repo_path":   { "type": "string" },
      "ref_a":       { "type": "string" },
      "ref_b":       { "type": ["string", "null"], "description": "If omitted, diff vs working tree." },
      "path_filter": { "type": "string" },
      "stat_only":   { "type": "boolean", "default": false }
    }
  },
  "output_schema": {
    "type": "object",
    "required": ["diff"],
    "properties": {
      "diff":  { "type": "string", "description": "Unified diff, or --stat output if stat_only." },
      "files_changed": { "type": "integer", "minimum": 0 },
      "insertions":    { "type": "integer", "minimum": 0 },
      "deletions":     { "type": "integer", "minimum": 0 }
    }
  }
}
```

### `git_show`

```json
{
  "name": "git_show",
  "description": "Show a single commit or tag.",
  "input_schema": {
    "type": "object",
    "required": ["repo_path", "ref"],
    "additionalProperties": false,
    "properties": {
      "repo_path":   { "type": "string" },
      "ref":         { "type": "string" },
      "path_filter": { "type": "string" }
    }
  },
  "output_schema": {
    "type": "object",
    "required": ["sha", "author", "date", "subject", "patch"],
    "properties": {
      "sha":     { "type": "string" },
      "author":  { "type": "string" },
      "date":    { "type": "string", "format": "date-time" },
      "subject": { "type": "string" },
      "body":    { "type": "string" },
      "patch":   { "type": "string" }
    }
  }
}
```

### `git_blame`

```json
{
  "name": "git_blame",
  "description": "Line-level authorship for a file at a ref.",
  "input_schema": {
    "type": "object",
    "required": ["repo_path", "path"],
    "additionalProperties": false,
    "properties": {
      "repo_path": { "type": "string" },
      "path":      { "type": "string" },
      "ref":       { "type": "string", "default": "HEAD" }
    }
  },
  "output_schema": {
    "type": "object",
    "required": ["lines"],
    "properties": {
      "lines": {
        "type": "array",
        "items": {
          "type": "object",
          "required": ["line_number", "sha", "author", "date", "content"],
          "properties": {
            "line_number": { "type": "integer", "minimum": 1 },
            "sha":         { "type": "string" },
            "author":      { "type": "string" },
            "date":        { "type": "string", "format": "date-time" },
            "content":     { "type": "string" }
          }
        }
      }
    }
  }
}
```

### `git_branch_list`

```json
{
  "name": "git_branch_list",
  "description": "List branches.",
  "input_schema": {
    "type": "object",
    "required": ["repo_path"],
    "additionalProperties": false,
    "properties": {
      "repo_path":   { "type": "string" },
      "remote":      { "type": "boolean", "default": false, "description": "If true, include remote-tracking branches." },
      "merged_into": { "type": "string", "description": "Optional ref; restrict to branches merged into it." }
    }
  },
  "output_schema": {
    "type": "object",
    "required": ["branches"],
    "properties": {
      "branches": {
        "type": "array",
        "items": {
          "type": "object",
          "required": ["name", "is_remote", "head_sha"],
          "properties": {
            "name":      { "type": "string" },
            "is_remote": { "type": "boolean" },
            "head_sha":  { "type": "string" },
            "upstream":  { "type": ["string", "null"] }
          }
        }
      }
    }
  }
}
```

## Error codes

| Code | Meaning |
|------|---------|
| `REPO_NOT_ALLOWED` | `repo_path` not under `CHITTYMCP_GIT_REPO_ROOTS` |
| `REPO_NOT_FOUND` | Path exists but is not a git work tree |
| `REF_NOT_FOUND` | `ref` / `ref_a` / `ref_b` not resolvable |
| `PATH_NOT_FOUND` | `path` not present at the given ref |
| `GIT_ERROR` | Underlying git command failed; stderr included |

## Out of scope

- Any write operation (`commit`, `push`, `tag`, `reset`, `checkout`, `merge`,
  `rebase`, etc.) — see ChittyConnect's Git Tool Surface.
- Repositories outside the configured allowlist.
- Submodule traversal (followup; default behavior is to ignore submodules).

## Wire-up after implementation (MCP-SOP §4)

1. Implement `chittyentity/workers/chittyagent-git/src/index.ts` with the six
   tools above, backed by `git` subprocess against the canonicalized
   `repo_path`. No mocks; real git invocation per global no-mocks policy.
2. Deploy. Verify `https://chittyagent-git.chitty.cc/mcp` returns all six tools.
3. Add `{ "binding": "SVC_GIT", "service": "chittyagent-git" }` to chittymcp's
   `wrangler.jsonc` `services[]` and `SERVICE_MAP` in `src/worker/index.ts`.
4. Tag the CF gateway registration with `surface:all`, `audience:human`,
   `auth:oauth-ok` so it surfaces in chittymcp and ch1tty but not chittymsg.
5. Deploy chittymcp. Verify `mcp.chitty.cc/git/mcp` returns the same six tools.
