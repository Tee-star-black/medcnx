# MedCNX Workforce Position & Vacancy Planning Guide

## Purpose

This guide explains how HR and workforce administrators use MedCNX to understand approved establishment, current position occupancy, vacancies, and recruitment demand.

The workflow exists to prevent recruitment from becoming disconnected from the organisation's approved staffing structure.

## Current frontend route

```text
/dashboard/recruitment/jobs
```

The existing Recruitment overview links to this workspace through **Manage jobs**.

The screen is intentionally driven by the position establishment rather than by an isolated recruitment-job list.

## What the screen shows

The workspace loads:

```text
GET /positions/vacancy-plan
```

It displays organisation-level totals for:

- Approved headcount.
- Filled headcount.
- Total vacancies.
- Openings already in recruitment.
- Vacancies not yet planned for recruitment.

Each active position displays:

- Position code.
- Position title.
- Department.
- Employment category where configured.
- Approved headcount.
- Current filled headcount.
- Vacancy count.
- Openings already being recruited.
- Staffing status.

## Staffing statuses

### FULLY_STAFFED

Approved headcount is fully occupied.

UI action:

```text
No action needed
```

### RECRUITMENT_IN_PROGRESS

The position still has vacancies, but all remaining vacancies are already covered by active recruitment plans.

UI action:

```text
Covered by recruitment
```

### VACANCY_UNPLANNED

One or more approved vacancies exist that are not yet covered by recruitment.

UI action:

```text
Open recruitment
```

## Search and filtering

The workspace supports search by:

- Position title.
- Position code.
- Department name.

The user can filter by:

```text
All
Vacancy unplanned
Recruitment in progress
Fully staffed
```

## Opening recruitment

When a position has an unplanned approved vacancy, HR can select **Open recruitment**.

The drawer shows the selected position and its current vacancy context:

```text
Vacant
Recruiting
Available
```

The user can provide:

- Recruitment reference.
- Number of planned openings.
- Location.
- Opening date.
- Closing date.
- Description.

The frontend submits:

```text
POST /positions/:positionId/recruitment-job
```

## System guardrails

The frontend limits `plannedOpenings` to the currently available unplanned vacancies, but the backend remains authoritative.

The backend also prevents:

- Recruitment against an archived position.
- Recruitment where no approved vacancy exists.
- Planned openings exceeding remaining approved vacancies.
- Duplicate recruitment references within the organisation.
- Closing dates earlier than opening dates.

## After recruitment is created

The frontend refreshes the vacancy plan immediately.

The position should normally move from:

```text
VACANCY_UNPLANNED
```

to either:

```text
RECRUITMENT_IN_PROGRESS
```

or remain `VACANCY_UNPLANNED` if only part of the available vacancy was opened for recruitment.

The organisation totals also refresh so the recruiting and unplanned-vacancy counts stay current.

## Example

Before action:

```text
Senior Registered Nurse
Approved headcount: 4
Filled: 2
Vacancies: 2
Recruiting: 0
Unplanned vacancies: 2
Status: VACANCY_UNPLANNED
```

HR opens recruitment for one position.

After refresh:

```text
Senior Registered Nurse
Approved headcount: 4
Filled: 2
Vacancies: 2
Recruiting: 1
Unplanned vacancies: 1
Status: VACANCY_UNPLANNED
```

If HR opens the second vacancy as well:

```text
Approved headcount: 4
Filled: 2
Vacancies: 2
Recruiting: 2
Unplanned vacancies: 0
Status: RECRUITMENT_IN_PROGRESS
```

## Relationship to hiring

Opening recruitment does not alter headcount.

Headcount changes only when an employee receives an active position assignment.

For a successful recruitment hire, the flow is:

```text
Approved position
  -> Vacancy
  -> Recruitment job
  -> Application
  -> Hire conversion
  -> Employee
  -> Position assignment
  -> Filled headcount increases
  -> Vacancy decreases
```

See `RECRUITMENT_TO_HIRE_WORKFLOW.md` for the full hire-conversion process.

## Permissions

The vacancy plan endpoint currently requires department-read access.

Opening recruitment from a position currently requires employee-update access.

The frontend should present actions only to appropriate users, but the API remains the final permission boundary.

A dedicated `positions:*` permission family is still planned and will eventually replace these transitional permission mappings.

## Current completion status

- [x] Position backend model.
- [x] Approved headcount.
- [x] Effective-dated occupancy.
- [x] Vacancy calculation.
- [x] Recruitment-demand calculation.
- [x] Position-to-recruitment linkage.
- [x] Prevent over-recruitment beyond establishment.
- [x] Frontend vacancy-planning dashboard.
- [x] Search and staffing filters.
- [x] Frontend Open recruitment action.
- [x] Frontend refresh after creating recruitment.
- [ ] Position catalogue create UI.
- [ ] Position catalogue edit/archive UI.
- [ ] Dedicated Positions navigation entry.
- [ ] Position detail page with occupants and assignment history.
- [ ] Browser-level end-to-end tests.
- [ ] Dedicated `positions:*` permissions.

## Support notes

If a user cannot open recruitment, first confirm:

1. The position is active.
2. Approved headcount is greater than current occupancy.
3. Existing active recruitment is not already covering every vacancy.
4. The user has the required permissions.
5. A duplicate recruitment reference is not being used.

Do not manually reduce vacancy counts. Vacancies are derived from approved headcount and active assignments and should not be independently edited.
