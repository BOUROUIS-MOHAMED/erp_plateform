# Finance Module — Budget Redesign + Targets + Money Flow
**Date:** 2026-04-01
**Status:** Approved

---

## Overview

Three interconnected changes to the Finance module of the ERP:

1. **Budget page redesign** — project/event-based budgets with start/end dates and used amount tracking
2. **New Targets page** — track financial **revenue goals** (realisedAmount tracks income, not expense)
3. **New Money Flow page** — simple income/expense log with account balance rows and net summary
4. **Account model update** — rename `inBudget` → `inMoneyFlow`

All three features share a consistent UI pattern and are backed by real backend models/APIs. Category fields are **normalized to lowercase** on save across all three models for consistent matching.

---

## Data Models

### Budget (updated)

**Removed fields:** `month`, `actual`, `variance`, `variancePercentage`

**Added fields:**
- `usedAmount` — Number, default 0. Auto-recalculated from MoneyFlow expense entries on every MoneyFlow event. Also manually settable via PATCH endpoint (admin correction). Manual edits are valid but will be overwritten on the next MoneyFlow sync for that category.
- `startDate` — Date, required
- `endDate` — Date, required

**Kept fields:** `category` (String, required, **normalized to lowercase**), `budget` (Number, required), `status` (enum, see below), `notes` (String), `createdBy` (ObjectId), `updatedBy` (ObjectId)

**Status enum:** `desactivated | respected | passed`

**Auto-calc pre-save (when `budget` or `usedAmount` changes, skipped when status is `desactivated`):**
- `passed` when `usedAmount > budget`
- `respected` when `usedAmount <= budget`

**Setting `desactivated`:** Done manually via the edit form status dropdown. When `desactivated`, auto-calc is skipped and status is preserved as-is.

**Migration note:** Existing Budget documents with a `month` field are not migrated — the field is simply ignored. Existing `status` values (`respecté`, `dépassé`, `en_attente`) are overwritten on next save.

---

### Target (new model)

**Purpose:** Track revenue/income goals. `realisedAmount` tracks how much income has been received toward the goal. It is auto-synced from MoneyFlow **revenue** entries (`isExpense === false`) with matching category.

| Field | Type | Required | Default | Notes |
|---|---|---|---|---|
| `category` | String | yes | — | **Normalized to lowercase**. Free text title |
| `amount` | Number | yes | — | The revenue goal |
| `realisedAmount` | Number | no | 0 | Auto-synced from revenue MoneyFlow entries, also manually editable |
| `status` | enum | no | `in_progress` | See logic below |
| `startDate` | Date | yes | — | |
| `endDate` | Date | yes | — | |
| `notes` | String | no | — | |
| `createdBy` | ObjectId | yes | — | ref User |
| `updatedBy` | ObjectId | no | — | ref User |

**Status enum:** `desactivated | in_progress | reached | failed`

**Auto-calc pre-save (skipped when `desactivated`):**
- `reached` if `realisedAmount >= amount`
- `failed` if `endDate < Date.now() && realisedAmount < amount`
- `in_progress` otherwise

**Setting `desactivated`:** Done manually via the edit form status dropdown.

**Note on staleness:** `failed` is only set on save. A target with a past endDate retains `in_progress` until the next save. The frontend should call `PATCH /api/targets/:id/realised` on load for expired targets to force a status recalc. No scheduled job.

**Virtual:** `progression = Math.min((realisedAmount / amount) * 100, 100)`

---

### MoneyFlow (new model)

| Field | Type | Required | Default | Notes |
|---|---|---|---|---|
| `category` | String | yes | — | **Normalized to lowercase** before save |
| `amount` | Number | yes | — | Always positive, `min: 0` |
| `date` | Date | yes | now | |
| `isExpense` | Boolean | yes | — | `true` = expense (syncs to Budget), `false` = revenue (syncs to Target) |
| `note` | String | no | — | |
| `createdBy` | ObjectId | yes | — | ref User |
| `updatedBy` | ObjectId | no | — | ref User |

---

### Account (updated)

`inBudget` renamed to `inMoneyFlow` (Boolean, default false, index true).

**Migration script (run once on deploy):**
```js
db.accounts.updateMany(
  { inBudget: { $exists: true } },
  [{ $set: { inMoneyFlow: "$inBudget" } }, { $unset: "inBudget" }]
)
```
The controller also reads `inBudget` as fallback if `inMoneyFlow` is undefined, for safety.

---

## Auto-Sync Logic

Triggered by the MoneyFlow controller after every **create**, **update**, and **delete**. All category comparisons use case-insensitive regex since stored values may differ in source.

### Sync function (shared helper)

```js
async function syncCategoryToBudgetsAndTargets(category) {
  const re = new RegExp('^' + category + '$', 'i');

  // Sync budgets (expense entries)
  const budgets = await Budget.find({ category: re });
  for (const budget of budgets) {
    const entries = await MoneyFlow.find({ category: re, isExpense: true });
    budget.usedAmount = entries.reduce((sum, e) => sum + e.amount, 0); // 0 if empty
    await budget.save(); // triggers status recalc
  }

  // Sync targets (revenue entries)
  const targets = await Target.find({ category: re });
  for (const target of targets) {
    const entries = await MoneyFlow.find({ category: re, isExpense: false });
    target.realisedAmount = entries.reduce((sum, e) => sum + e.amount, 0); // 0 if empty
    await target.save(); // triggers status recalc
  }
}
```

### On CREATE
```
syncCategoryToBudgetsAndTargets(moneyFlow.category)
```

### On DELETE
```
syncCategoryToBudgetsAndTargets(moneyFlow.category)
// Sum of empty set → usedAmount/realisedAmount set to 0
```

### On UPDATE
```
oldDoc = await MoneyFlow.findById(id)  // fetch BEFORE applying update
apply update
if oldDoc.category !== newDoc.category:
  syncCategoryToBudgetsAndTargets(oldDoc.category)  // old category may now sum to 0
  syncCategoryToBudgetsAndTargets(newDoc.category)
else:
  syncCategoryToBudgetsAndTargets(newDoc.category)
```

### When Budget or Target category is renamed

The `PUT /api/budgets/:id` and `PUT /api/targets/:id` controllers must:
1. Detect if `category` changed
2. Recalculate `usedAmount` / `realisedAmount` for the **new** category from existing MoneyFlow
3. The **old** category's Budget/Target retains its last calculated value. On the next MoneyFlow event for the old category, it will be recalculated (likely to 0 if no MoneyFlow entries remain).

---

## Backend API

### Budget (updated endpoints)

| Method | Route | Notes |
|---|---|---|
| `GET` | `/api/budgets` | Filter params: `startDate`, `endDate`, `status` |
| `GET` | `/api/budgets/:id` | Get single budget |
| `POST` | `/api/budgets` | Accepts: `category`, `budget`, `usedAmount`, `startDate`, `endDate`, `notes` |
| `PUT` | `/api/budgets/:id` | Same fields; triggers resync if category changed |
| `PATCH` | `/api/budgets/:id/used` | Manual admin override of `usedAmount`; will be overwritten by next MoneyFlow sync |
| `DELETE` | `/api/budgets/:id` | No change |

### Target (new — `/api/targets`)

| Method | Route | Description |
|---|---|---|
| `GET` | `/api/targets` | List all, pagination, filter by `status` |
| `GET` | `/api/targets/:id` | Get single target |
| `POST` | `/api/targets` | Create target |
| `PUT` | `/api/targets/:id` | Update; triggers resync if category changed |
| `PATCH` | `/api/targets/:id/realised` | Manual admin override of `realisedAmount`; also triggers status recalc |
| `DELETE` | `/api/targets/:id` | Delete target |

### MoneyFlow (new — `/api/money-flow`)

| Method | Route | Description |
|---|---|---|
| `GET` | `/api/money-flow` | List all; filter by `isExpense`, `category`, `startDate`, `endDate` |
| `GET` | `/api/money-flow/:id` | Get single entry |
| `POST` | `/api/money-flow` | Create → auto-sync |
| `PUT` | `/api/money-flow/:id` | Update → resync old + new category |
| `DELETE` | `/api/money-flow/:id` | Delete → auto-sync |

### Account (updated)

No new endpoints. `inBudget` → `inMoneyFlow` in controller and `formatAccount`. Existing `GET /api/accounts` supports `?inMoneyFlow=true` filter to return only accounts shown in Money Flow tab.

### New backend files

```
src/models/Target.js
src/models/MoneyFlow.js
src/controllers/targetController.js
src/controllers/moneyFlowController.js
src/routes/targetRoutes.js
src/routes/moneyFlowRoutes.js
```

Register both route files in the main app entry point.

---

## Frontend

### Sidebar navigation (updated)

```
📊 Dashboard Finance
💰 Transactions
🏦 Comptes
📋 Budgets         ← redesigned
🎯 Targets         ← new
💸 Money Flow      ← new
📑 Rapports
⚙️ Paramètres
```

### Budget tab (redesigned)

**Form fields:**
- category (text input)
- budget amount (number)
- usedAmount (number, editable — note displayed: "recalculé automatiquement par Money Flow")
- status dropdown (desactivated only; respected/passed are auto-set)
- startDate, endDate
- notes

**Table columns:** Catégorie | Montant | Utilisé | Usage % (progress bar) | Statut | Début | Fin | Actions

**Status badge colors:** `respected` → green, `passed` → red, `desactivated` → gray

**Summary bar:** Total budget | Total utilisé | Variance | Taux global

---

### Targets tab (new — same UI pattern as Budget)

**Form fields:**
- category (text input)
- amount / goal (number)
- realisedAmount (number, editable — note: "recalculé automatiquement par Money Flow")
- status dropdown (desactivated only; other statuses auto-set)
- startDate, endDate
- notes

**Table columns:** Catégorie | Objectif | Réalisé | Progression % (progress bar) | Statut | Début | Fin | Actions

**Status badge colors:** `in_progress` → blue, `reached` → green, `failed` → red, `desactivated` → gray

**Summary bar:** Total objectifs | Total réalisé | Taux de réussite

---

### Money Flow tab (new)

**Data loaded on mount:**
1. All MoneyFlow entries via `GET /api/money-flow`
2. All `inMoneyFlow` accounts via `GET /api/accounts?inMoneyFlow=true`

**Table — two row types:**

1. **Manual entries** (MoneyFlow records):
   - Columns: Catégorie | Montant | Date | Type | Note | Actions
   - Type badge: `Revenu` (green) or `Dépense` (red)

2. **Account rows** (one per `inMoneyFlow` account, read-only, rendered after manual entries):
   - 🏦 icon, account name as category, `solde` as amount
   - Type badge: `Compte` (blue)
   - No edit/delete actions

**Bottom summary bar (calculated client-side):**
- **Total revenus** = sum of MoneyFlow entries where `isExpense === false`
- **Total dépenses** = sum of MoneyFlow entries where `isExpense === true`
- **Soldes comptes** = sum of `solde` from all `inMoneyFlow` account objects fetched via `GET /api/accounts?inMoneyFlow=true`
- **NET** = Total revenus − Total dépenses + Soldes comptes

**Form fields (add/edit manual entry):** category (text), amount (positive number), date, isExpense toggle (Revenu/Dépense), note

---

### Account form (updated)

- Checkbox label: `"Inclure dans le flux de trésorerie"`
- Field sent to backend: `inMoneyFlow` (replaces `inBudget`)

---

### New frontend files

```
src/services/targetService.js
src/services/moneyFlowService.js
```

**Updated files:**

```
src/utils/frontendApiAdapters.js    ← add mapTargetToUi, mapMoneyFlowToUi; update mapBudgetToUi, mapAccountToUi
src/services/budgetService.js        ← update create/update for new fields; remove month param
src/services/accountService.js       ← inBudget → inMoneyFlow in payloads
src/pages/finance/FinanceAdmin.jsx   ← 2 new tabs, budget redesign, new state/handlers/forms
```

**EMPTY_FORMS updates:**
```js
budget:    { category: "", budget: "", usedAmount: "0", startDate: "", endDate: "", notes: "", status: "respected" }
target:    { category: "", amount: "", realisedAmount: "0", startDate: "", endDate: "", notes: "", status: "in_progress" }
moneyFlow: { category: "", amount: "", date: today, isExpense: false, note: "" }
```

---

## Key Decisions

- **Auto-sync uses full recalculation** (sum from scratch) — prevents drift on edits/deletes; sets value to 0 when no entries remain
- **Category normalization** — all three models (Budget, Target, MoneyFlow) normalize category to lowercase on save
- **Money Flow is a separate simple table** — not linked to the double-entry Transaction system
- **`inMoneyFlow` accounts** appear as read-only balance rows in Money Flow; their `solde` contributes to the summary bar
- **`desactivated` status** is set manually via the edit form dropdown; overrides auto-calc on both Budget and Target
- **PATCH /api/budgets/:id/used and PATCH /api/targets/:id/realised** are manual admin correction endpoints — intentional overrides that will be recalculated on next MoneyFlow sync
- **`failed` status** is evaluated at save time only; no scheduled job
- **Migration script** handles `inBudget` → `inMoneyFlow` rename on existing Account documents
- **Everything backed by real APIs from day 0** — no localStorage fallback
