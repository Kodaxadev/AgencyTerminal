# AgencyTerminalPage Patch

## Issue

The concept page used `GitPullRequestDraft` for Doctrine Challenge. That icon implies GitHub pull requests rather than structured dissent/doctrine review.

## Recommended Replacement

Use one of:

```ts
Scale
MessagesSquare
GitBranch
FileWarning
```

Best choice:

```ts
Scale
```

Reason:

Doctrine Challenge is about weighing evidence, dissent, and revision. `Scale` maps better than a GitHub-specific draft PR icon.

## Patch

```diff
-import { GitPullRequestDraft } from "lucide-react";
+import { Scale } from "lucide-react";

- icon: GitPullRequestDraft,
+ icon: Scale,
```
