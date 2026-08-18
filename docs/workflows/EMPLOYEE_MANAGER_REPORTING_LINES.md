# Employee Manager Reporting Lines

## Purpose

MedCNX separates employee reporting lines from departments, positions and RBAC. A department head is not automatically the direct manager of every employee in that department, and a manager assignment does not grant application permissions.

## Current-state and history model

`Employee.managerId` remains the fast current-state pointer used by operational workflows. `EmployeeManagerAssignment` is the effective-dated historical record.

Each manager change:

1. validates the employee and proposed manager in the same organisation,
2. rejects self-management,
3. rejects reporting cycles,
4. closes the current open-ended manager assignment,
5. creates a new effective-dated assignment,
6. updates `Employee.managerId`, and
7. writes the lifecycle audit event in the same transaction.

Removing a manager creates a new effective-dated assignment with a null manager, preserving the fact that the reporting line was deliberately removed.

## Employee profile experience

The employee profile now includes a **Reporting lines** workspace showing:

- current manager,
- active direct reports,
- full manager-assignment history,
- effective date ranges,
- reasons for reporting-line changes, and
- direct links to manager and direct-report employee profiles.

The **Change manager** drawer lets an authorised HR user select a manager or remove the current manager, choose an effective date and record a reason.

## API

### Read reporting context

`GET /employees/:id/manager-context`

Permission: `employees:read`

Returns the employee summary, current manager, active direct reports and effective-dated manager history.

### Change manager

`POST /employees/:id/employment/manager`

Permission: `employees:update`

Body:

```json
{
  "managerId": "employee-id-or-omitted",
  "effectiveDate": "2026-08-18",
  "reason": "Team restructure"
}
```

Omit `managerId` to remove the current manager.

## Integrity rules

The API is authoritative. The browser UI is convenience only.

- Employee and manager must belong to the same organisation.
- An employee cannot manage themselves.
- A manager assignment cannot introduce a reporting cycle.
- Terminated and resigned employees cannot be selected as new managers.
- Only one current open-ended manager assignment may exist for an employee.
- A new effective date cannot precede the current assignment's start date.
- Historical assignment rows are retained instead of overwritten.

## Operational distinction

Keep these concepts separate:

- **Department**: functional organisational unit.
- **Position**: approved role/slot.
- **Manager**: direct reporting relationship.
- **Department head**: leadership responsibility for a department.
- **RBAC role**: application permissions.

This separation prevents organisational structure from silently becoming an authorisation model and preserves accurate reporting history during transfers, promotions and restructures.
