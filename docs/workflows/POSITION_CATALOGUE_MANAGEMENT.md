# MedCNX Position Catalogue Management Guide

## Purpose

The Position Catalogue defines the approved organisational roles that may exist in MedCNX independently of the employees who occupy them. It is the establishment layer underneath vacancy planning, recruitment, employee assignment, and workforce reporting.

A position is not an employee, and it is not an RBAC role. It is an approved workforce slot or role definition with a code, title, department, employment category, level, and approved headcount.

## Where users work

Position catalogue:

```text
/dashboard/positions
```

Vacancy planning:

```text
/dashboard/recruitment/jobs
```

The two workspaces link to each other.

## Position lifecycle

```text
Create position
    ↓
Set department / level / category
    ↓
Set approved headcount
    ↓
Employees occupy the position through effective-dated assignments
    ↓
Vacancy planning derives open seats
    ↓
Recruitment may be opened against approved vacancies
    ↓
Position may be edited while active
    ↓
Position may be archived only when safe
```

## Create a position

From the Position Catalogue, select **Create position**.

Required fields:

- Position code
- Position title
- Approved headcount

Optional fields:

- Department
- Level
- Employment category
- Description

Example:

```text
Code: SRN-001
Title: Senior Registered Nurse
Department: Nursing
Level: Professional
Employment category: FULL_TIME
Approved headcount: 4
```

The position code must be unique within the organisation.

## Approved headcount

Approved headcount represents the maximum planned occupancy for a position definition.

Example:

```text
Approved headcount: 4
Current occupants: 3
Vacancies: 1
```

Vacancies are derived from active position assignments rather than stored as a manually editable number.

## Edit a position

Select **Edit** from an active position row.

Users may update:

- Code
- Title
- Department
- Level
- Employment category
- Description
- Approved headcount

Changes affect future workforce planning. Historical position-assignment records remain separate from the current catalogue state.

## Archive a position

Select **Archive** from an active position row.

MedCNX blocks archival when:

- Employees are actively assigned to the position.
- Recruitment is still open for the position.

This prevents the organisation from removing a workforce role that is still operationally in use.

Archived positions may be displayed by enabling **Show archived** in the catalogue.

## Position catalogue metrics

The catalogue shows:

- Active positions
- Approved seats
- Filled seats
- Vacancies

Each row also shows:

- Position code and title
- Department
- Level
- Employment category
- Approved headcount
- Current headcount
- Vacancy count
- Active/archive state

## Search and filtering

Users may search by:

- Position code
- Position title
- Department
- Level

Archived positions are hidden by default.

## Relationship to vacancy planning

The Position Catalogue answers:

> What roles and approved seats exist?

Vacancy Planning answers:

> Which approved seats are currently unfilled, already recruiting, or fully staffed?

Users can move from the Position Catalogue to Vacancy Planning using the **Vacancy planning** button.

Users can move from Vacancy Planning back to the Position Catalogue using **Position catalogue**.

## Relevant API endpoints

```text
GET   /positions
GET   /positions/:id
POST  /positions
PATCH /positions/:id
POST  /positions/:id/archive
GET   /positions/vacancy-plan
POST  /positions/:id/recruitment-job
```

## Permissions

Current backend permission enforcement is authoritative.

Position reads currently use department read permissions, while position create/update/archive operations use department update permissions. Recruitment creation from a position uses employee update permission.

The frontend should eventually expose dedicated position permissions when the backend permission model is separated from generic department/employee permissions.

## Validation and guardrails

MedCNX validates:

- Code length and uniqueness
- Title length
- Approved headcount must be zero or greater
- Department must belong to the organisation
- Position must be active before recruitment can be opened
- Recruitment cannot exceed remaining approved vacancy
- Position cannot be archived while occupied
- Position cannot be archived while recruitment is open

## Audit behaviour

Position creation, update, and archive actions create audit records.

Position assignment history is stored separately as effective-dated employee position assignments.

## Common errors

### Position code already exists

Use a unique establishment code within the organisation.

### Cannot archive while employees are assigned

Transfer or close active employee assignments before archiving the position.

### Cannot archive while recruitment is open

Close or complete the linked recruitment workflow before archiving.

### No approved vacancies

Increase approved headcount through an authorised establishment change, or wait until an existing occupant leaves or transfers.

## Frontend workflow checklist

- [x] Position catalogue route exists.
- [x] Active positions can be listed.
- [x] Archived positions can be displayed.
- [x] Search by code/title/department/level exists.
- [x] Position creation UI exists.
- [x] Position editing UI exists.
- [x] Position archive action exists.
- [x] Approved/filled/vacancy metrics are displayed.
- [x] Catalogue links to vacancy planning.
- [x] Vacancy planning links back to catalogue.
- [ ] Dedicated Positions navigation item is added to the main sidebar.
- [ ] Position detail screen displays occupants and assignment history.
- [ ] Dedicated `positions:*` permissions replace generic department/employee permissions.
- [ ] End-to-end browser tests cover create/edit/archive and vacancy transition.

## Operating principle

Position management is establishment management. HR should change approved headcount intentionally and audibly, then allow vacancy planning and recruitment to derive from that approved structure. MedCNX should never require users to maintain an independent vacancy number by hand.
