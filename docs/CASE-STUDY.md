# Aegis — From alert to accountable decision

Aegis is an independent portfolio project for a fictional fraud operations team. The prototype covers eight core screens in a desktop-first browser application, with responsive access for checking work on smaller displays.

## The problem

An analyst sees a high score, a payment state, several signals and an investigation status at the same time. Those fields answer different questions. Aegis gives the analyst a clear entry point, makes the source and confidence of each signal visible, and requires a written rationale before a sensitive action can change the workspace.

| Role | Job | Product response |
| --- | --- | --- |
| Fraud Analyst | Find the next record, review evidence, decide or hand off | Prioritized queue, investigation record, decision preview |
| Risk Manager | Receive escalations and oversee controlled rules | Case ownership and protected rule boundary |
| Compliance Officer | Explain who changed a record, when, and why | Searchable audit events with source links |

## Research and scope

The reference review covered manual review queues, evidence packages, alert-to-case links and separation of the payment and review lifecycle. The resulting design puts the deadline in the queue, treats evidence review as an explicit action and preserves an audit backlink after resolution. [Stripe Radar](https://docs.stripe.com/radar/transaction-reviews) · [Stripe Disputes](https://docs.stripe.com/disputes/responding) · [Unit21 Alerts](https://support.unit21.ai/hc/en-us/articles/6712819596564-Alerts-overview) · [Adyen Case Management](https://docs.adyen.com/risk-management/case-management/)

The navigation separates **Operations** (triage, transactions, cases, disputes) from **Oversight** (analytics, rules, audit). Investigation opens from a transaction, and case, dispute and rule pages each have stable ID links. The two main paths can be walked directly using the records in the README. [Research, architecture and journey details](PRODUCT-DESIGN.md)

## Design decisions

**Put the work before the metrics.** The Shift ledger direction leads with critical alerts, past-due cases and disputes requiring a response. The adjacent trend answers how many alerts arrived each day and opens the matching records. The alternative Monitoring desk placed the transaction table first. That worked for continuous monitoring, but pushed time-sensitive work further down the mobile screen. The selected direction is **CHƯA DUYỆT**.

**Keep the evidence and consequence in view.** Signals show a score-based risk level plus an independent confidence label and observation. Evidence sources can be opened individually and marked reviewed. The decision dialog repeats the object ID, amount, outcome and rationale. The final outcome appears in the investigation or dispute, its linked case and the audit history.

**Use a table where analysts compare records.** Amounts are right-aligned and carry currency. The mobile table keeps the record link in the first column and scrolls the remaining fields in place. URL filters survive opening and returning from a record, and the previous row link regains focus when available. This favors preserving columns and context over fitting every value above the fold.

**Keep write paths deliberate.** An analyst can escalate an investigation with incomplete evidence, but must give a reason. A dispute challenge requires both an assigned owner and reviewed evidence. Rule changes require a current test and confirmation. The prototype uses a conservative workspace-wide revision check when another tab writes during a review.

## Design system

IBM Plex Sans Variable gives the product a single typographic voice. The shell uses warm neutral surfaces, fine borders, 8 px panel corners and a restrained olive accent. The semantic tokens in `src/tokens.css` own all theme and state colors. Status labels include text alongside color, while chart values use a separate palette and direct numerical labels. Shared components cover record links, tables, deadlines, badges, forms, feedback and native confirmation dialogs.

## Rendered interfaces

| Screen | Desktop | Mobile |
| --- | --- | --- |
| Risk Overview | [1440 px](screens/overview-1440-light.png) | [390 px](screens/overview-390-light.png) |
| Transaction Monitoring | [1440 px](screens/transactions-1440-light.png) | [390 px](screens/transactions-390-light.png) |
| Risk Investigation | [1440 px](screens/investigation-1440-light.png) | [390 px](screens/investigation-390-light.png) |
| Case Management | [1440 px](screens/cases-1440-light.png) | [390 px](screens/cases-390-light.png) |
| Dispute Resolution | [1440 px](screens/disputes-1440-light.png) | [390 px](screens/disputes-390-light.png) |
| Risk Analytics | [1440 px](screens/analytics-1440-light.png) | [390 px](screens/analytics-390-light.png) |
| Rules Management | [1440 px](screens/rules-1440-light.png) | [390 px](screens/rules-390-light.png) |
| Audit Trail | [1440 px](screens/audit-1440-light.png) | [390 px](screens/audit-390-light.png) |

[Dispute detail](screens/dispute-detail-1440-light.png) · [Case file](screens/case-detail-1440-light.png) · [Rule test workspace](screens/rule-detail-1440-light.png) · [Dark overview](screens/overview-1440-dark.png)

## Validation and next steps

The validation covers the running browser application, its rendered routes, persistence, and the behavior of both main flows including recovery branches. The [QA record](QA.md) distinguishes automated results, visual findings and open checks.

A future study could ask Fraud Analysts to triage a high-risk record, interpret a weak signal and choose whether to escalate, then have a Risk Manager and Compliance Officer follow the handoff. This project contains synthetic data and illustrative rules. Operational impact, detection performance, legal compliance, real-device usability, live access control and external payment integration are outside the evidence.
