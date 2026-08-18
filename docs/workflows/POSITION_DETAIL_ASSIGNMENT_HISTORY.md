# Position Detail and Assignment History

## Purpose

The Position Detail workspace gives HR and workforce administrators a single operational view of an approved position, its current occupancy, approved vacancies, and historical employee assignments.

A Position is an organisational role or approved seat definition. It is not the employee, manager relationship, or application permission role.

## Where to work

- Position catalogue: `/dashboard/positions`
- Position detail: `/dashboard/positions/:id`
- Employee profile: `/dashboard/employees/:id`
- Vacancy planning: `/dashboard/recruitment/jobs`

From the Position Catalogue, select the position title or **View details**.

## Position summary

The detail page shows:

- position code and title
- department
- level
- employment category
- active or archived status
- approved headcount
- current occupants
- approved vacancies
- position description

Vacancies are calculated from approved headcount minus current effective assignments. Historical assignments do not count toward current headcount.

## Current occupants

The **Current occupants** section lists employee assignments where `effectiveTo` is empty.

For each occupant, HR can see:

- employee name
- employee number
- current job title
- employment status
- assignment effective-from date

Use **View employee** to open the employee's authoritative profile. Employee personal and employment data should be maintained in the employee workspace rather than duplicated in Position Detail.

## Assignment history

The **Assignment history** section lists former assignments to the position.

Each historical row includes:

- employee identity
- employee number
- effective-from date
- effective-to date
- recorded assignment reason when available

The history is effective-dated and should be treated as part of the workforce audit trail. Ending an assignment does not delete the historical record.

## Vacancy planning

When an active position has approved vacancies, the Position Detail page exposes **Vacancy planning**.

Recruitment planning remains separate from position occupancy:

1. Approved headcount defines how many seats are authorised.
2. Current assignments determine filled seats.
3. The difference is the approved vacancy count.
4. Recruitment links plan how many of those vacancies are currently being recruited.
5. Completed hires become employee position assignments and therefore reduce vacancies.

## Permissions

Current permission mappings use the existing workforce permissions:

- `departments:read` for position catalogue/detail reads
- `employees:read` for occupant and assignment-history reads
- `departments:update` for position maintenance
- `employees:update` for employee assignment and recruitment actions

A dedicated `positions:*` permission vocabulary remains a future hardening item.

## API endpoints

- `GET /positions`
- `GET /positions/:id`
- `GET /positions/:id/history`
- `GET /positions/assignments/:employeeId`
- `POST /positions/assignments/:employeeId`
- `GET /positions/vacancy-plan`
- `POST /positions/:id/recruitment-job`

## Guardrails

- Position history is organisation-scoped.
- A position outside the actor's organisation is returned as not found.
- Current occupancy is determined by effective-dated assignments, not by employee job-title text.
- Former assignments remain visible after an employee moves to another position.
- Position archive remains blocked while active occupants or open recruitment exist.

## Completion checklist

- [ ] Position catalogue links to Position Detail.
- [ ] Position Detail shows approved, filled, and vacant seat metrics.
- [ ] Current occupants match assignments with no effective end date.
- [ ] Former occupants appear in assignment history.
- [ ] Employee links open the authoritative employee profile.
- [ ] Assignment dates and reasons render correctly.
- [ ] Vacancy-planning action appears only for active positions with vacancies.
- [ ] Cross-organisation history requests are rejected.
- [ ] API tests pass.
- [ ] Web production build passes.
