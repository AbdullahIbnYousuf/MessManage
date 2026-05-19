# Implementation Plan: instant-bazar-trip-weight

## Overview

This feature introduces a two-level trip weight system for bazar expenses, allowing members to differentiate between regular shopping trips (weight 1.0) and quick instant purchases (weight 0.1). The implementation follows the existing three-layer architecture (API → Domain → Database) and maintains mobile-first design principles.

## Tasks

- [ ] 1. Database schema migration
  - Add `trip_weight` column to `BazarExpense` table
  - Type: `Decimal(3, 2)`, NOT NULL, default 1.0
  - Run migration to backfill existing records with default value
  - Generate Prisma client types
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

- [ ] 2. Domain layer - Trip weight validation
  - [ ] 2.1 Add trip weight validation to lib/domain/bazar.ts
    - Define `VALID_TRIP_WEIGHTS` constant array [1.0, 0.1]
    - Implement `validateTripWeight()` function
    - Implement `isTripWeight()` type guard
    - Export `TripWeight` type
    - _Requirements: 7.1, 7.2, 7.3_
  - [ ]\* 2.2 Write property test for trip weight validation
    - **Property 9: Trip weight validation**
    - **Validates: Requirements 7.2, 7.3**
    - Test that only 1.0 and 0.1 are accepted
    - Test that invalid values return appropriate error messages
    - Test that non-numbers are rejected

- [ ] 3. API layer - Expense submission endpoint
  - [ ] 3.1 Update POST /api/bazar/expense route handler
    - Add `tripWeight` to request body type
    - Validate `tripWeight` using domain layer function
    - Convert `tripWeight` to Decimal for database storage
    - Include `tripWeight` in BazarExpense creation
    - Return `tripWeight` in response
    - _Requirements: 1.2, 1.3, 7.4, 7.5_
  - [ ]\* 3.2 Write property tests for expense submission
    - **Property 1: Trip weight assignment for Regular Bazar**
    - **Validates: Requirements 1.2**
    - **Property 2: Trip weight assignment for Instant Bazar**
    - **Validates: Requirements 1.3**
    - **Property 5: Non-negative amount acceptance**
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.4**
    - **Property 6: Negative amount rejection**
    - **Validates: Requirements 3.5**

- [ ] 4. API layer - Trip closure verification
  - [ ]\* 4.1 Write property tests for trip closure
    - **Property 3: Trip closure for Regular Bazar**
    - **Validates: Requirements 2.1, 2.3, 2.4, 2.5**
    - **Property 4: Trip closure for Instant Bazar**
    - **Validates: Requirements 2.2, 2.3, 2.4, 2.5**
    - Verify transaction atomicity for both trip types

- [ ] 5. API layer - Visit count calculation updates
  - [ ] 5.1 Update GET /api/bazar/history endpoint
    - Replace `_count: { id: true }` with `_sum: { tripWeight: true }`
    - Update response transformation to use `_sum.tripWeight`
    - Format visit count with one decimal place
    - _Requirements: 4.2, 10.1, 10.3_
  - [ ] 5.2 Update GET /api/members/[id] endpoint
    - Replace `_count: { id: true }` with `_sum: { tripWeight: true }`
    - Update response to use `_sum.tripWeight`
    - Format visit count with one decimal place
    - _Requirements: 4.2, 10.1, 10.2_
  - [ ] 5.3 Update POST /api/bazar/trip endpoint (assignee suggestion)
    - Update query to select `tripWeight` from `bazarExpenses`
    - Calculate `visitCount` using `reduce()` to sum trip weights
    - Pass decimal visit counts to `suggestAssignees()` function
    - _Requirements: 8.1, 8.2, 10.1, 10.5_
  - [ ] 5.4 Update GET /api/settlement/monthly-report endpoint
    - Replace `count()` with `aggregate()` using `_sum: { tripWeight: true }`
    - Update response to use `_sum.tripWeight`
    - Format visit count with one decimal place
    - _Requirements: 4.2, 9.1, 10.1, 10.4_
  - [ ]\* 5.5 Write property tests for visit count calculation
    - **Property 7: Visit count calculation**
    - **Validates: Requirements 4.2**
    - Test with mixed Regular and Instant expenses (e.g., 3 regular + 2 instant = 3.2)
    - **Property 10: Assignee suggestion with decimal visit counts**
    - **Validates: Requirements 8.1, 8.2, 8.3**

- [ ] 6. UI layer - ExpenseForm component
  - [ ] 6.1 Replace single submit button with two-button layout
    - Create vertical flex container with 0.75rem gap
    - Add "🛒 Regular Bazar" button (primary style, tripWeight 1.0)
    - Add "⚡ Instant Bazar" button (secondary style, tripWeight 0.1)
    - Both buttons: minHeight 44px, width 100%, fontSize 0.875rem
    - Update `handleSubmit()` to accept tripWeight parameter
    - Store selected trip weight in component state
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_
  - [ ] 6.2 Update confirmation screen
    - Add trip type display showing selected option
    - Show "🛒 Regular Bazar" or "⚡ Instant Bazar" based on selection
    - Update `submit()` function to include `tripWeight` in request body
    - _Requirements: 1.2, 1.3_

- [ ] 7. UI layer - Visit count display updates
  - [ ] 7.1 Update BazarClient component leaderboard
    - Format visit count with `toFixed(1)` for one decimal place
    - Add `fontVariantNumeric: 'tabular-nums'` for alignment
    - Display format: "X.Y trips"
    - _Requirements: 4.3, 4.4, 9.3, 9.4_
  - [ ] 7.2 Update member profile display
    - Format visit count with one decimal place
    - Add tabular-nums font variant
    - _Requirements: 4.3, 4.4, 9.2, 9.4_
  - [ ] 7.3 Update settlement monthly report display
    - Format visit count with one decimal place
    - Add tabular-nums font variant
    - _Requirements: 4.3, 4.4, 9.1, 9.4_

- [ ] 8. Checkpoint - Verify core functionality
  - Ensure database migration applied successfully
  - Ensure all API endpoints return correct visit counts
  - Ensure two-button layout renders correctly on mobile (390px width)
  - Test expense submission with both Regular and Instant options
  - Verify trip closure works for both submission types
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 9. UI layer - Expense history verification
  - [ ]\* 9.1 Write property test for expense history display
    - **Property 11: Expense history display uniformity**
    - **Validates: Requirements 5.1, 5.2, 5.3, 5.4**
    - Verify no trip_weight values displayed
    - Verify no type badges shown
    - Verify unified list format

- [ ] 10. Final verification and testing
  - [ ] 10.1 Verify visit count display format
    - Check all locations display "X.Y trips" format
    - Verify tabular-nums applied for alignment
    - Test with various decimal values (0.1, 3.2, 10.5)
    - _Requirements: 4.3, 4.4, 4.5_
  - [ ] 10.2 Verify mobile-first design compliance
    - Test on 390px viewport width
    - Verify buttons stack vertically
    - Verify minimum 44px touch targets
    - Verify no horizontal scrolling
    - _Requirements: 1.4, 1.5_
  - [ ]\* 10.3 Write property test for visit count display format
    - **Property 8: Visit count display format**
    - **Validates: Requirements 4.3, 4.4**
    - Test decimal formatting with one decimal place

- [ ] 11. Final checkpoint - Ensure all tests pass
  - Run all property tests and unit tests
  - Verify backward compatibility with existing data
  - Verify assignee suggestion algorithm works with decimal counts
  - Verify monthly settlement report displays correctly
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional property-based tests and can be skipped for faster MVP
- Each task references specific requirements for traceability
- The feature maintains backward compatibility through the default value of 1.0
- All existing BazarExpense records are automatically treated as Regular Bazar (weight 1.0)
- The two-button layout follows mobile-first design principles with vertical stacking
- Visit count calculations are updated across all endpoints to use SUM(trip_weight)
- Expense history display remains unchanged per requirements (no visual distinction)
- Checkpoints ensure incremental validation at key milestones

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1"] },
    { "id": 1, "tasks": ["2.1"] },
    { "id": 2, "tasks": ["2.2", "3.1"] },
    { "id": 3, "tasks": ["3.2", "4.1", "5.1", "5.2", "5.3", "5.4"] },
    { "id": 4, "tasks": ["5.5", "6.1"] },
    { "id": 5, "tasks": ["6.2", "7.1", "7.2", "7.3"] },
    { "id": 6, "tasks": ["9.1", "10.1", "10.2"] },
    { "id": 7, "tasks": ["10.3"] }
  ]
}
```
