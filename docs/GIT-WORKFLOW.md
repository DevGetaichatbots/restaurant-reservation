# Git Workflow

Everything below assumes the one-time setup in section 1 is done. After that,
section 2 is the loop you repeat for the rest of the project.

---

## 1 · One-time setup

Already configured on this machine:

```
credential.helper = manager       # browser sign-in, no tokens
user.email        = dev@getaichatbots.com
user.name         = Dev
core.autocrlf     = true          # Windows line endings handled
branch            = main
```

### 1.1 Create the repository on GitHub

**github.com → New repository**

| Field | Value |
|---|---|
| Repository name | `restaurant-reservation` |
| Visibility | **Private** |
| Add a README | ❌ leave unchecked |
| Add .gitignore | ❌ leave unchecked |
| Choose a licence | ❌ leave unchecked |

All three must stay unchecked. This project already has a commit; if GitHub
creates its own the two histories collide and the first push is rejected.

### 1.2 Connect and push

```bash
git remote add origin https://github.com/YOUR_USERNAME/restaurant-reservation.git
git push -u origin main
```

A browser window opens on the first push. Sign in to GitHub there and approve.
Windows Credential Manager stores it, and no later push will ask again.

**No personal access token is needed at any point.** If a token ever does get
created, it belongs in Credential Manager or a platform's secrets page — never
in a file, a message, or a chat.

---

## 2 · The daily loop

Never commit directly to `main`. One branch per piece of work.

```bash
# 1 — start from the latest main
git checkout main
git pull

# 2 — branch, named for the work
git checkout -b feat/reservations-schema

# 3 — work, then see what changed
git status
git diff

# 4 — stage and commit
git add -A
git commit -m "Add reservations table with exclusion constraint"

# 5 — push the branch
git push -u origin feat/reservations-schema

# 6 — open a pull request on github.com, review, merge

# 7 — back to main and clean up
git checkout main
git pull
git branch -d feat/reservations-schema
```

### Branch naming

| Prefix | For | Example |
|---|---|---|
| `feat/` | New capability | `feat/request-queue` |
| `fix/` | Bug fix | `fix/timezone-slot-offset` |
| `chore/` | Tooling, dependencies | `chore/upgrade-drizzle` |
| `docs/` | Documentation only | `docs/api-endpoints` |

### Commit messages

Write what the commit *does*, in the imperative:

```
✅ Add exclusion constraint to prevent double bookings
✅ Fix slot times drifting across a daylight-saving change
✅ Reject blocked dates in the availability endpoint

❌ updates
❌ fixed stuff
❌ wip
```

The first line stays under ~70 characters. If the change needs explaining, add
a blank line and a paragraph saying **why** — the diff already shows what.

---

## 3 · What a push triggers

```
  git push origin main
          │
          ├──→ Render   rebuilds the Docker image, redeploys the API
          │
          └──→ Netlify  rebuilds only the sites whose folders changed
```

Nothing deploys by hand. A branch push deploys nothing; only `main` does.

---

## 4 · Before every commit

- [ ] `pnpm typecheck` passes
- [ ] `pnpm test` passes
- [ ] No secret in the diff — check with `git diff --cached`
- [ ] `.env` is not staged (it is gitignored, but confirm)

Quick check that nothing sensitive is going out:

```bash
git diff --cached | grep -iE "password|secret|token|api[_-]?key"
```

Empty output means clean.

---

## 5 · Getting out of trouble

```bash
# Uncommitted changes to one file — throw them away
git restore path/to/file

# Everything uncommitted — throw it all away (destructive)
git restore .

# Undo the last commit, keep the changes staged
git reset --soft HEAD~1

# Committed to main by mistake, not yet pushed —
# move that commit onto a branch where it belongs
git branch feat/my-work
git reset --hard HEAD~1
git checkout feat/my-work

# Pushed a secret by mistake
#   1. Rotate the secret immediately — it is compromised
#   2. Then worry about the history. Rewriting alone is not enough,
#      because the value is already out.
```

---

## 6 · If a push is rejected

**`rejected — fetch first`** — the remote has commits you don't:

```bash
git pull --rebase
git push
```

**`refusing to merge unrelated histories`** — GitHub created its own initial
commit. Easiest fix is to delete the repository on GitHub and recreate it with
every checkbox unticked, per 1.1.

**Browser sign-in loops** — clear the stored credential and try once more:

```bash
git credential-manager erase
```
