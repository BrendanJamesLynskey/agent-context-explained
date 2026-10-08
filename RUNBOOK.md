# RUNBOOK.md — Deploying and checking the site

The site is static: no database, no secrets, no environment variables. A
deploy can't break a schema, but it can still break in ways CI doesn't
see, so every deploy follows the same three steps. They are adapted from
transformer-explainer's RUNBOOK §7.

## 1. Deploy from a clean export

The Vercel project (`agent-context-explained`) is not on Vercel's Git
integration. Deploy with the logged-in Vercel CLI from a clean export of
`HEAD`, so nothing untracked (caches, `node_modules`, local files) is
uploaded:

```bash
rm -rf /tmp/ace-deploy && mkdir /tmp/ace-deploy
git archive HEAD | tar -x -C /tmp/ace-deploy
cp -r .vercel /tmp/ace-deploy/
(cd /tmp/ace-deploy && vercel deploy --yes)          # preview
(cd /tmp/ace-deploy && vercel deploy --prod --yes)   # production
vercel ls agent-context-explained | head                   # newest must be ● Ready
```

Test a preview first. Previews are protected by Vercel Authentication; to
smoke-check one, create a protection-bypass token in the project settings
and pass it as `VERCEL_BYPASS` (never commit or print it).

## 2. Smoke-check

```bash
pnpm smoke https://agent-context-explained.vercel.app
# a protected preview:
VERCEL_BYPASS=… pnpm smoke https://<preview-url>
```

It fetches every page and fails on any non-200 (redirects included) or on a
page without the content that proves it rendered from the engine: the
landing page's numbers (computed by the smoke script with the same
engine code), every data file's checksum on `/data`, every chapter's
MDX (a layer, server-rendered KaTeX and the animation's placeholder), the
two-group site switch, and the tokenizer and every data file the worker
fetches (each SHA-256 must be the vendored one). Then open one
chapter in a browser and press **Play**, step and scrub: the engine runs
client-side in a Web Worker, which the smoke check can't see. With
reduce-motion set in the OS, nothing should play until you press Play.

## 3. Read the logs

```bash
vercel logs --environment production --since 15m --no-branch --expand
```

A static site should log almost nothing. On the Hobby plan the CLI only
reaches back about an hour; the dashboard's Logs view keeps more.

## Why e2e runs under `--no-experimental-require-module`

Plain Node 20.19+ / 22.12+ can `require()` an ES module; Vercel's function
loader can't. transformer-explainer shipped a comment renderer that passed
every local and CI test and returned 500 on Vercel for that reason
(2026-10-04). This site has no server functions, but CI runs the e2e
server under the flag anyway, so the class of bug can't arrive unnoticed if
one is added.

## Updating the engine

The engine is vendored from
[Agent_Loop_Sim](https://github.com/BrendanJamesLynskey/Agent_Loop_Sim) at a
pinned commit. To move to a newer one (it must be pushed first):

```bash
pnpm vendor:engine <commit>                 # copies the files, writes VENDORED.json
# pin the same commit in reference/requirements.txt, then
.venv/bin/pip install -r reference/requirements.txt
.venv/bin/python scripts/make_fixtures.py   # the site's fixtures, from the reference
pnpm test && .venv/bin/python -m pytest -q tests/python
```

CI fails if the vendored files, the pinned reference and the fixtures
disagree.
