# Gap Closure Pack 03

This patch resolves the cross-review inconsistencies.

## Resolved Issues

1. Flat ticket status enum mismatch:
   - Added lifecycle/workflow state machine split.
   - Added `workflow_instances` and `workflow_events`.

2. Doctrine challenge score credit:
   - Added explicit adoption transaction spec.

3. Controls access ambiguity:
   - Added page and dataset scoping.

4. `subject_discord_id` semantics:
   - Defined submitter vs credit subject.

5. Contract terms retention mapping:
   - Added `contract_details` table.

6. Reversal-of-reversal:
   - Added `score_corrections` table and correction workflow.

7. Outbox dependency confusion:
   - Clarified that migration 003 is operational dependency for outbox-backed reliability.

8. Short IDs:
   - Added `short_id` to tickets and evidence.

9. `check:lines` undefined:
   - Added build tooling spec.

10. Doctrine icon mismatch:
   - Added UI patch recommending `Scale`.

11. Patch notes clutter:
   - Added repo hygiene/changelog policy.
