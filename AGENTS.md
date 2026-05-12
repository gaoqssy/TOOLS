# TOOLS Agent Memory

This repository is the user's personal small-tools workspace.

## Daily Interaction Workflow

When the user greets the agent, asks for notices, asks for a dashboard, or starts the first interaction of the day:

1. Inspect `/Users/gao/Desktop/TOOLS`.
2. Read registered tool data files, starting with:
   - `Finance/subscription-manager/data/recurring-expenses.json`
3. Produce a concise natural-language dashboard:
   - Today and next 7 days.
   - Next 30 days.
   - Fixed monthly and annualized spend.
   - Data quality warnings.
4. Check `.agent-state/daily-dashboard.json` if it exists.
   - If no dashboard was produced today, provide the full dashboard and update the state.
   - If today's dashboard was already produced, give a shorter update unless the user asks for a full refresh.

## Fixed Expense Agent Workflow

When the user says they added a fixed expense, subscription, membership, or recharge:

1. Extract known fields: name, amount, currency, cycle, next charge date, category, payment account, status, notes.
2. Ask only for missing required fields:
   - name
   - amount
   - cycle
   - next charge date
   - category
   - payment account
3. Default currency to `CNY` and status to `active` when not specified.
4. Store the record through the data service when available, or write the JSON data file directly if needed.
5. Confirm the stored record in natural language.

## Next Charge Date Policy

Do not silently mutate overdue `nextChargeDate` values. For dashboards:

- Compute the effective next charge date from the stored date and cycle.
- Show the computed next date in the dashboard.
- Flag records whose stored next charge date is before today.
- Ask the user before advancing stored dates, unless the user explicitly says the payment has happened or asks to update/roll forward.

