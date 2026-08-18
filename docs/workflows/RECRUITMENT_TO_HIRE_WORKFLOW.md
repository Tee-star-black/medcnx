# MedCNX Recruitment-to-Hire Workflow Guide

## Purpose

This guide explains how MedCNX moves from workforce planning to an actual employee record. It is written for HR administrators, managers, implementation teams, testers, and support staff who need to understand what the system is doing and why.

The workflow is designed so that workforce planning, recruitment, hiring, employee creation, and position occupancy remain connected instead of becoming separate records that humans must manually reconcile.

## Current implementation status

### Backend

Implemented and validated:

- Department hierarchy and department heads.
- Position catalogue and approved headcount.
- Effective-dated employee position assignments.
- Vacancy planning and staffing status.
- Recruitment jobs linked to approved position vacancies.
- Recruitment applications and normal pipeline statuses.
- Dedicated hire conversion from an application to an employee.
- Automatic position assignment when the recruitment job is position-linked.
- Automatic vacancy consumption through the new position assignment.
- Automatic recruitment-job closure when all planned openings are filled.
- Immutable audit events and persistent candidate/application/employee conversion trace.

### Frontend

The current branch contains the recruitment overview at `/dashboard/recruitment`, including summary metrics and recent applications. The page links to jobs, candidates, and applications workspaces, but those detailed pages have not yet been implemented on this branch.

Therefore, the backend workflow is currently ahead of the web UI. The next frontend implementation must expose the actions described in this guide rather than allowing users to bypass or duplicate them.

## Core concepts

### Department

Answers: **Where in the organisation does this work belong?**

Example: Clinical Services > Nursing.

### Position

Answers: **What approved organisational role exists?**

A position has a code, title, department, category, approved headcount, and active/archive state.

Example: `SRN-001 - Senior Registered Nurse` with approved headcount 4.

### Employee

Answers: **Which person currently occupies the role?**

Employees are assigned to positions using effective-dated `EmployeePositionAssignment` records. Position history is preserved rather than overwritten.

### Recruitment job

Answers: **Which approved vacancy are we actively trying to fill?**

A position-based recruitment job is linked to a position through `RecruitmentPositionLink` and records the number of planned openings.

### Hire conversion

Answers: **Which candidate/application became which employee?**

`RecruitmentHireConversion` creates a permanent trace from application and candidate to employee, position, and recruitment job.

## End-to-end workflow

### Step 1: Define the organisation structure

HR configures departments and their hierarchy.

Typical structure:

```text
Organisation
└── Clinical Services
    ├── Nursing
    └── Doctors
```

A department may also have a department head. Direct reporting relationships remain separate from department-head responsibility.

Relevant API operations:

```text
GET   /departments/structure
PATCH /departments/:id/structure
```

## Step 2: Create an approved position

HR creates a position in the relevant department and defines approved headcount.

Example:

```text
Code: SRN-001
Title: Senior Registered Nurse
Department: Nursing
Employment category: FULL_TIME
Approved headcount: 4
```

Relevant API operations:

```text
GET   /positions
POST  /positions
PATCH /positions/:id
POST  /positions/:id/archive
```

A position cannot be archived while employees are actively assigned to it or while recruitment is still open for it.

## Step 3: Review vacancy planning

MedCNX compares approved headcount with current active position assignments.

For every position, it calculates:

- Approved headcount.
- Current headcount.
- Vacancies.
- Openings already being recruited.
- Vacancies that have not yet been planned for recruitment.
- Staffing status.

Possible staffing statuses:

```text
FULLY_STAFFED
RECRUITMENT_IN_PROGRESS
VACANCY_UNPLANNED
```

Relevant API operation:

```text
GET /positions/vacancy-plan
```

Example:

```text
Senior Registered Nurse
Approved headcount: 4
Current headcount: 2
Vacancies: 2
Recruiting openings: 1
Unplanned vacancies: 1
Status: VACANCY_UNPLANNED
```

## Step 4: Open recruitment from the position vacancy

HR should open recruitment **from the position**, not create an unrelated job title manually when the role represents an approved vacancy.

Relevant API operation:

```text
POST /positions/:id/recruitment-job
```

MedCNX carries the position title, department, and employment category into the recruitment job and records the number of planned openings.

The system refuses to recruit beyond the remaining approved vacancies.

Example:

```text
Approved headcount: 4
Current headcount: 2
Already recruiting: 1
Remaining unplanned vacancy: 1
```

A request to recruit two additional people is rejected because only one approved vacancy remains.

## Step 5: Add the candidate

HR creates or selects a candidate record.

Relevant API operations:

```text
GET  /recruitment/candidates
POST /recruitment/candidates
```

Candidate information currently includes identity/contact and recruitment-profile information such as current role, company, location, source, and notes.

## Step 6: Create the application

The candidate is linked to a recruitment job through a job application.

Relevant API operations:

```text
GET  /recruitment/applications
POST /recruitment/applications
```

A candidate cannot be added twice to the same recruitment job.

## Step 7: Move the candidate through the pipeline

Normal recruitment stages use the status endpoint:

```text
PATCH /recruitment/applications/:applicationId/status
```

Supported normal stages are:

```text
APPLIED
SCREENING
INTERVIEW
OFFER
REJECTED
WITHDRAWN
```

`HIRED` is intentionally excluded from this endpoint.

Hiring is not a simple status change because it creates workforce records. MedCNX therefore requires the dedicated hire conversion command.

## Step 8: Hire the candidate

When the offer is accepted, HR performs the hire action.

Relevant API operation:

```text
POST /recruitment/applications/:applicationId/hire
```

Required information:

```json
{
  "employeeNumber": "MED-100",
  "startDate": "2026-09-01",
  "employmentType": "FULL_TIME",
  "reason": "Offer accepted."
}
```

`employeeNumber` and `startDate` are required because they are workforce data, not merely recruitment-pipeline data.

## Step 9: What MedCNX does during hire

The hire command runs as a single database transaction.

MedCNX:

1. Validates that the application exists in the current organisation.
2. Rejects withdrawn or rejected applications.
3. Rejects hiring from a closed recruitment job.
4. Prevents the same application being converted twice.
5. Prevents duplicate employee numbers.
6. Resolves the linked approved position, when present.
7. Confirms that planned openings remain available.
8. Creates the employee from the candidate and recruitment-job information.
9. Creates an effective-dated position assignment when the job is position-linked.
10. Changes the application status to `HIRED`.
11. Creates a permanent `RecruitmentHireConversion` record.
12. Writes employee-hire and recruitment-conversion audit events.
13. Closes the recruitment job when all planned openings have been filled.

If any required step fails, the transaction fails rather than leaving half-completed records.

## Step 10: Vacancy occupancy updates automatically

No separate 'reduce vacancy' command exists.

A vacancy is derived from:

```text
approved headcount - current active position assignments
```

Therefore, when the hire transaction creates the employee's active position assignment, current headcount increases and the vacancy count automatically falls.

Example:

```text
Before hire
Approved: 4
Filled: 3
Vacancies: 1

After hire
Approved: 4
Filled: 4
Vacancies: 0
Status: FULLY_STAFFED
```

## Step 11: Recruitment auto-close

When a position-linked recruitment job has filled all of its `plannedOpenings`, MedCNX changes the recruitment job status to `CLOSED` in the same hire transaction.

Example:

```text
Planned openings: 2
Completed hires before action: 1
Current hire: 1
Completed hires after action: 2
Result: recruitment job CLOSED
```

## Expected frontend behaviour

The web UI should mirror the domain rules above rather than expose generic CRUD controls.

### Vacancy planning screen

Each position should show:

- Department.
- Position code and title.
- Approved headcount.
- Filled headcount.
- Vacancies.
- Recruiting openings.
- Unplanned vacancies.
- Staffing status.

An `Open recruitment` button should only be enabled when an unplanned approved vacancy exists.

### Recruitment jobs screen

Jobs created from positions should display:

- Linked position.
- Department.
- Planned openings.
- Completed hires.
- Remaining openings.
- Job status.

### Candidate screen

The user should be able to create/select a candidate and move naturally into an application without re-entering the same information.

### Applications screen

Each application should display a stage/action appropriate to its current state.

Suggested actions:

```text
APPLIED     -> Start screening
SCREENING   -> Schedule interview / Move to interview
INTERVIEW   -> Move to offer / Reject
OFFER       -> Hire candidate / Reject / Withdraw
HIRED       -> View employee
REJECTED    -> Read-only outcome
WITHDRAWN   -> Read-only outcome
```

The UI must **not** show a generic `Set status: HIRED` option.

### Hire dialog

When an application is in `OFFER`, the primary action should be `Hire candidate`.

The dialog should request:

- Employee number.
- Start date.
- Employment type, pre-populated where possible.
- Reason/notes.

Before submission, show the destination context:

```text
Candidate: Naledi Dube
Department: Nursing
Position: Senior Registered Nurse
Position code: SRN-001
Planned openings remaining: 1
```

On successful hire, the UI should:

1. Show a success confirmation.
2. Refresh the application and recruitment-job state.
3. Refresh vacancy/headcount metrics.
4. Change the application badge to `HIRED`.
5. Replace `Hire candidate` with `View employee`.
6. Show the new employee number and start date.
7. Show the recruitment job as `CLOSED` if the final planned opening was filled.

## Audit and traceability

A hire must be traceable across:

```text
Candidate
  -> Job application
  -> Recruitment job
  -> Position
  -> Employee
  -> Position assignment
  -> Audit history
```

The conversion record prevents support staff from having to infer which employee came from which application.

## Permissions

Current recruitment endpoints use authenticated permission guards. The UI must hide or disable actions that the current user cannot perform, but backend permission enforcement remains authoritative.

## Error handling expectations

Frontend error messages should expose useful API validation without leaking implementation detail.

Examples:

- `Employee number already exists.`
- `This application has already been hired.`
- `All planned openings for this recruitment job have already been filled.`
- `Closed recruitment jobs cannot accept hires.`
- `Only 1 unplanned approved vacancy remains for this position.`

After an error, the UI must preserve entered form values where safe so the user can correct the issue without starting again.

## Workflow completion checklist

A recruitment-to-hire implementation is considered complete only when all of the following are true:

- [x] Workforce hierarchy model exists.
- [x] Position catalogue exists.
- [x] Approved headcount and vacancy calculation exist.
- [x] Recruitment can originate from an approved position vacancy.
- [x] Applications have controlled pipeline stages.
- [x] Hire creates the employee transactionally.
- [x] Hire creates the position assignment transactionally.
- [x] Hire creates a permanent conversion trace.
- [x] Hire reduces vacancy through occupancy.
- [x] Recruitment auto-closes when planned openings are filled.
- [x] Backend tests cover key guardrails.
- [ ] Vacancy-planning frontend is implemented.
- [ ] Recruitment jobs frontend is implemented.
- [ ] Candidate-management frontend is implemented.
- [ ] Applications pipeline frontend is implemented.
- [ ] Hire dialog/action is implemented.
- [ ] Employee/profile frontend displays position and recruitment-origin context.
- [ ] End-to-end browser flow is tested.

## Documentation rule for future MedCNX changes

For future meaningful workflow changes, documentation should be updated or created in `docs/workflows/` as part of the same implementation slice.

A slice is not considered fully documented until its guide covers:

1. Purpose and business outcome.
2. Roles/permissions involved.
3. User-facing steps.
4. System behaviour behind each step.
5. Validation and guardrails.
6. Audit/history effects.
7. Relevant API endpoints.
8. Expected frontend states and buttons.
9. Common errors and recovery guidance.
10. A completion/test checklist.

This keeps the code, UI, and operating procedure aligned as MedCNX grows.
