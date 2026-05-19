# Requirements Document

## Introduction

This feature introduces a two-level trip weight system for bazar (market shopping) expenses to differentiate between regular shopping trips and quick instant purchases. Currently, every bazar expense submission increments a member's visit count by 1, regardless of the purchase size or nature. The new system allows members to submit expenses with either a Regular Bazar weight (1.0) or an Instant Bazar weight (0.1), enabling more accurate tracking of shopping effort while maintaining the existing expense recording and trip closure workflow.

## Glossary

- **Bazar_System**: The market shopping expense tracking subsystem within the Household Meal & Expense Management System
- **Trip_Weight**: A decimal value (1.0 or 0.1) assigned to a bazar expense submission that determines its contribution to the member's visit count
- **Regular_Bazar**: A standard shopping trip with a trip weight of 1.0 (existing behavior)
- **Instant_Bazar**: A quick purchase with a trip weight of 0.1 (new behavior)
- **Visit_Count**: The cumulative sum of trip weights for all bazar expenses submitted by a member
- **Active_Trip**: A BazarTrip record with status = 'open' in the database
- **Expense_Form**: The user interface component where members submit bazar expenses
- **Expense_History**: The historical record of all bazar expenses displayed to users

## Requirements

### Requirement 1

**User Story:** As a member, I want to choose between Regular Bazar and Instant Bazar when submitting an expense, so that quick purchases are weighted differently from full shopping trips.

#### Acceptance Criteria

1.1 THE Expense_Form SHALL display two submission buttons labeled "Regular Bazar" and "Instant Bazar"

1.2 WHEN a member taps the "Regular Bazar" button, THE Bazar_System SHALL assign a Trip_Weight of 1.0 to the expense

1.3 WHEN a member taps the "Instant Bazar" button, THE Bazar_System SHALL assign a Trip_Weight of 0.1 to the expense

1.4 THE Expense_Form SHALL stack the two buttons vertically with minimum height of 44px each

1.5 THE Expense_Form SHALL display both buttons with full width on mobile devices

### Requirement 2

**User Story:** As a member, I want both submission options to close the active trip, so that the trip workflow remains consistent regardless of trip weight.

#### Acceptance Criteria

2.1 WHEN a member submits an expense via "Regular Bazar", THE Bazar_System SHALL mark the Active_Trip status as 'completed'

2.2 WHEN a member submits an expense via "Instant Bazar", THE Bazar_System SHALL mark the Active_Trip status as 'completed'

2.3 WHEN a member submits an expense via either button, THE Bazar_System SHALL set the Active_Trip completedAt timestamp to the current time

2.4 WHEN a member submits an expense via either button, THE Bazar_System SHALL clear the Active_Trip shopping_notes field

2.5 WHEN a member submits an expense via either button, THE Bazar_System SHALL set SystemConfig.activeTripId to null

2.6 THE Bazar_System SHALL execute all trip closure operations within a single database transaction

### Requirement 3

**User Story:** As a member, I want no amount restrictions on either submission type, so that I can record any expense value with any trip weight.

#### Acceptance Criteria

3.1 THE Bazar_System SHALL accept non-negative decimal amounts for Regular_Bazar submissions

3.2 THE Bazar_System SHALL accept non-negative decimal amounts for Instant_Bazar submissions

3.3 THE Bazar_System SHALL accept zero-amount expenses for Regular_Bazar submissions

3.4 THE Bazar_System SHALL accept zero-amount expenses for Instant_Bazar submissions

3.5 IF an amount is negative, THEN THE Bazar_System SHALL return an error message "Amount must be a non-negative number"

### Requirement 4

**User Story:** As a member, I want my visit count to reflect the sum of all trip weights, so that my shopping effort is accurately tracked.

#### Acceptance Criteria

4.1 THE Bazar_System SHALL store the Trip_Weight value in the BazarExpense database record

4.2 WHEN calculating Visit_Count for a member, THE Bazar_System SHALL sum all Trip_Weight values from the member's BazarExpense records

4.3 THE Bazar_System SHALL display Visit_Count as a decimal number with one decimal place precision

4.4 THE Bazar_System SHALL display Visit_Count in the format "X.Y trips" where X is the integer part and Y is the decimal part

4.5 WHEN a member has submitted 3 Regular_Bazar expenses and 2 Instant_Bazar expenses, THE Bazar_System SHALL display Visit_Count as "3.2 trips"

### Requirement 5

**User Story:** As a member, I want no visual distinction in expense history between Regular and Instant bazars, so that the history remains simple and focused on amounts and dates.

#### Acceptance Criteria

5.1 THE Expense_History SHALL display all bazar expenses in a unified list regardless of Trip_Weight

5.2 THE Expense_History SHALL NOT display Trip_Weight values in the expense list

5.3 THE Expense_History SHALL NOT display badges or labels indicating Regular_Bazar versus Instant_Bazar

5.4 THE Expense_History SHALL display expense amount, date, note, and submitter name for all expenses

### Requirement 6

**User Story:** As a system administrator, I want the trip weight data to be stored permanently, so that historical visit counts remain accurate and auditable.

#### Acceptance Criteria

6.1 THE Bazar_System SHALL add a trip_weight column to the BazarExpense database table

6.2 THE Bazar_System SHALL define trip_weight as a Decimal type with precision (3, 2)

6.3 THE Bazar_System SHALL set trip_weight as a required field with no null values allowed

6.4 THE Bazar_System SHALL set the default value of trip_weight to 1.0 for backward compatibility

6.5 THE Bazar_System SHALL apply the default value of 1.0 to all existing BazarExpense records during migration

### Requirement 7

**User Story:** As a developer, I want the trip weight assignment logic to be centralized in the domain layer, so that business rules are separated from HTTP handling.

#### Acceptance Criteria

7.1 THE Bazar_System SHALL implement trip weight validation in lib/domain/bazar.ts

7.2 THE Bazar_System SHALL define valid Trip_Weight values as 1.0 and 0.1 only

7.3 IF a Trip_Weight value is not 1.0 or 0.1, THEN THE Bazar_System SHALL return an error message "Invalid trip weight. Must be 1.0 or 0.1"

7.4 THE Bazar_System SHALL accept Trip_Weight as a parameter in the expense submission API endpoint

7.5 THE Bazar_System SHALL validate Trip_Weight before creating the BazarExpense database record

### Requirement 8

**User Story:** As a member, I want the assignee suggestion algorithm to use decimal visit counts, so that members with more instant bazars are prioritized for the next trip.

#### Acceptance Criteria

8.1 WHEN suggesting assignees for a new trip, THE Bazar_System SHALL calculate Visit_Count as the sum of Trip_Weight values

8.2 THE Bazar_System SHALL sort members by Visit_Count in ascending order

8.3 THE Bazar_System SHALL select the two members with the lowest Visit_Count values as suggested assignees

8.4 WHEN two members have equal Visit_Count values, THE Bazar_System SHALL preserve the original array order

8.5 WHEN a member has Visit_Count of 3.2 and another has 3.5, THE Bazar_System SHALL suggest the member with 3.2 first

### Requirement 9

**User Story:** As a member, I want the monthly settlement report to display decimal visit counts, so that I can see accurate shopping contribution metrics.

#### Acceptance Criteria

9.1 THE Bazar_System SHALL display Visit_Count with one decimal place in the monthly settlement report

9.2 THE Bazar_System SHALL display Visit_Count with one decimal place in the member profile aggregate view

9.3 THE Bazar_System SHALL display Visit_Count with one decimal place in the bazar history leaderboard

9.4 THE Bazar_System SHALL use tabular-nums font variant for Visit_Count display to ensure alignment

### Requirement 10

**User Story:** As a developer, I want all existing visit count calculations to be updated to use trip weights, so that the system behavior is consistent across all features.

#### Acceptance Criteria

10.1 THE Bazar_System SHALL replace all COUNT(BazarExpense) queries with SUM(trip_weight) queries

10.2 THE Bazar_System SHALL update the member profile API endpoint to calculate Visit_Count using SUM(trip_weight)

10.3 THE Bazar_System SHALL update the bazar history API endpoint to calculate Visit_Count using SUM(trip_weight)

10.4 THE Bazar_System SHALL update the settlement monthly report API endpoint to calculate Visit_Count using SUM(trip_weight)

10.5 THE Bazar_System SHALL update the trip assignee suggestion logic to use SUM(trip_weight) for Visit_Count
