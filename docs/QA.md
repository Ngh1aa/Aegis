# Aegis — Verification

## How to reproduce

```sh
npm ci
npm run lint
npm run typecheck
npm run build
npx playwright install --only-shell chromium
npm test
```

Use `AEGIS_BROWSER=msedge` to select Edge when the bundled headless shell cannot launch. Set `AEGIS_CAPTURES` before running the suite to save route and interaction captures.

## Browser matrix

**Result on 9 November 2026:** 16 Playwright tests passed on Edge Chromium. ESLint, TypeScript and the production build completed. `npm audit` reported zero advisories at the time of the run. The Vite build emitted upstream React Router module-directive warnings.

The Playwright suite serves `dist` from Vite preview. It opens 11 routes (eight core views plus case, dispute and rule detail) at 1440, 1280, 768, 390 and 320 px. At 1440 and 390 px it checks light and dark mode with axe. The matrix detects viewport overflow, missing headings, console errors and failed HTTP responses. A separate test checks light/dark semantic token parity and 19 contrast pairs.

The XL workflow used [uiux-ai-workspace at 5404c18](https://github.com/Ngh1aa/uiux-ai-workspace/tree/5404c183e2e6d09261ddb97b238e09ab56bd5a8a). Its unmodified `taste-check.cjs` checked Overview, Transactions and Analytics with strict layout, axe and 320 px reflow. The bundled headless executable was blocked on this Windows machine, so a launcher selected installed Edge Chromium for the same checks. Result: **0 errors, 86 heuristic warnings**. The warnings cover semantic badge colors, the square app header grouped with panels, and columns intentionally outside scrollable table viewports. [Checker output](qa/taste-check.json)

The upstream `validate.py` validated the reference design system. Aegis uses its own CSS tokens, so the Aegis parity and contrast results come from the browser test above.

## FLOW evidence

| Check | Scenario |
| --- | --- |
| A / entry and context | Open Critical alerts, search Northline, select sort, open TX-8421, go Back. Verify URL, filter text and focus on the selected record. |
| A / recovery | Missing reason and unreviewed evidence explain why the review is disabled. After both are present, cancel and verify the reason is preserved. |
| A / effect | Confirm Block payment. Verify Declined, CS-2401 Resolved, reason/actor in audit, record backlink, refresh persistence and analytics drill-down. |
| B / recovery | A challenge cannot be reviewed until the linked case has an owner and the required evidence is reviewed. Escape cancels without discarding the form. |
| B / effect | Confirm Challenge dispute. Verify DP-6101, preserved search and updated queue, audit event and CS-2403 checklist progress. |
| Rules | Reject an invalid threshold, show a zero-match test, require a fresh test, publish after review, deny publication for protected RULE-104. |
| Failure and recovery | No search matches, empty dataset, missing ID, unreadable storage with confirmed restore, stale decision in a second tab and successful retry with reason intact. |
| Keyboard | Skip link, mobile navigation, route focus, native modal, Escape and focus restored to the trigger. |

## Visual iteration

1. **Layout.** Compared [Shift ledger desktop](directions/shift-ledger-1440.png) and [mobile](directions/shift-ledger-390.png) with [Monitoring desk desktop](directions/monitoring-desk-1440.png) and [mobile](directions/monitoring-desk-390.png). Selected Shift ledger because exceptions retain the first reading position at both widths. Direction **CHƯA DUYỆT**.
2. **Role walkthrough.** Moved investigation notes and related transactions after the decision section on mobile. Added scroll affordance for wide tables, corrected chart scale labels and verified the keyboard return from the confirmation dialog. Case progress uses the linked checklist for dispute cases.
3. **Independent image review.** The first screenshot-only agent review of 13 captures scored 3.9/5 and flagged clipped amounts on mobile Overview and Transactions. The iteration also added decision prerequisites, the affected case and dispute outcome in confirmation, and deadline times in queues. The same reviewer rechecked 13 updated images and scored **4.1/5** with a 3.5 minimum and zero visual hard fails observed. The updated mobile test checks that the first transaction amount is fully inside the table viewport at 390 px. Remaining review notes include making overdue workload more prominent and surfacing required evidence counts separately.

[Portfolio captures](CASE-STUDY.md#rendered-interfaces) · [Flow A confirmation](screens/flow-a-confirmation.png) · [Flow B confirmation](screens/flow-b-confirmation.png)

## Coverage limits

The browser checks and screenshot critique cover the synthetic workspace. Manual assistive-technology testing, real devices, analyst testing, detection accuracy, production access control and audit immutability remain unverified. Data lives in the browser and is resettable. The independent review is a heuristic and the direction awaits human approval.
