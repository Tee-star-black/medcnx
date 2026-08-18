# MedCNX Recruitment Candidate, Application & Hire Workflow

## Purpose

This workflow guides HR and recruitment staff from maintaining a reusable candidate pool through application progression and final employee conversion.

The workflow deliberately separates a **Candidate** from a **Job Application**. A candidate represents a person in the organisation's recruitment pool. An application represents that person's participation in a specific recruitment job.

## Roles and permissions

Current recruitment endpoints use the existing employee permissions:

- `employees:read` for recruitment overview, jobs, candidates and applications.
- `employees:update` for creating candidates, creating applications, updating application stages and hiring.

A dedicated `recruitment:*` permission vocabulary may replace this later. Until then, frontend access must remain consistent with the backend permission contract.

## User-facing workflow

### 1. Maintain the candidate pool

Open **Recruitment → Candidates**.

Staff can:

- search existing candidates;
- add a candidate;
- capture first name and last name;
- optionally capture email, phone, current company, current role, location, source and notes;
- see how many applications are linked to each candidate.

Candidate records remain independent from any one vacancy, which allows a candidate to be considered for more than one recruitment job without duplicating their profile.

### 2. Add an application

Open **Recruitment → Applications** and select **Add application**.

Required fields:

- candidate;
- open recruitment job.

Optional fields:

- expected salary;
- rating from 1 to 5;
- recruitment notes.

MedCNX prevents the same candidate from being added to the same recruitment job twice.

### 3. Progress an application

The UI exposes stage-specific actions rather than a generic status selector.

| Current stage | Primary next action | Other action |
|---|---|---|
| `APPLIED` | Start screening | Reject |
| `SCREENING` | Move to interview | Reject |
| `INTERVIEW` | Move to offer | Reject |
| `OFFER` | Hire candidate | Reject |
| `HIRED` | View employee | Read only |
| `REJECTED` | None | Read only |
| `WITHDRAWN` | None | Read only |

When an application moves to `INTERVIEW`, MedCNX records an interview timestamp. When it moves to `OFFER`, MedCNX records an offer timestamp.

## Hire Candidate

Hiring is intentionally not implemented as a generic status change.

The **Hire candidate** action is available only when:

- the application is in `OFFER` status; and
- the recruitment job is `OPEN`.

The hire dialog captures:

- employee number, required;
- employee start date, required;
- employment type, optional and prefilled from the recruitment job where available;
- reason or notes, optional.

### System behaviour during hire

The backend runs the conversion in a database transaction. It:

1. creates the Employee record;
2. creates an active position assignment when the recruitment job is linked to an approved Position;
3. sets the Job Application to `HIRED`;
4. creates a Recruitment Hire Conversion record linking application, candidate, employee, position and recruitment job;
5. writes Employee and Job Application audit events;
6. closes the recruitment job when the final planned opening has been filled.

If any transaction step fails, the conversion does not partially complete.

## Validation and guardrails

MedCNX rejects hiring when:

- the application is not in `OFFER` status;
- the recruitment job is not `OPEN`;
- the application has already been converted;
- the employee number already exists in the organisation;
- the linked position is inactive;
- all planned openings for the linked position recruitment job have already been filled.

## Audit and history

Candidate creation, application creation, application stage changes and successful hire conversions are audit logged.

The hire conversion preserves the relationship between:

- candidate;
- application;
- recruitment job;
- resulting employee;
- position, where applicable;
- user who performed the conversion.

## Relevant APIs

- `GET /recruitment/candidates`
- `POST /recruitment/candidates`
- `GET /recruitment/applications`
- `POST /recruitment/applications`
- `PATCH /recruitment/applications/:applicationId/status`
- `POST /recruitment/applications/:applicationId/hire`
- `GET /recruitment/jobs`

All routes are exposed beneath the API global prefix, normally `/api`.

## Frontend routes

- `/dashboard/recruitment`
- `/dashboard/recruitment/candidates`
- `/dashboard/recruitment/applications`
- `/dashboard/recruitment/jobs`
- `/dashboard/employees/:employeeId` after a successful hire.

## Errors and recovery

If a stage change fails, the application remains at its previous stage and the API message is displayed.

If hire conversion fails, no employee should be created unless the transaction completes. Correct the reported problem and retry the Hire Candidate action.

If the final planned opening is filled, the recruitment job automatically closes. Further hires against that job are rejected.

## Completion checklist

- Candidate can be created and appears in the candidate pool.
- Application can be created for an open recruitment job.
- Duplicate candidate/job application is rejected.
- `APPLIED → SCREENING` works.
- `SCREENING → INTERVIEW` works.
- `INTERVIEW → OFFER` works.
- Non-offer application cannot be hired.
- ON_HOLD or CLOSED recruitment job cannot accept a hire.
- Offer-stage application can be converted to an employee.
- Position assignment is created when a position link exists.
- Application becomes `HIRED` after conversion.
- Employee profile can be opened from the completed hire state.
- Final planned hire closes the recruitment job.
- Audit records exist for the conversion.
