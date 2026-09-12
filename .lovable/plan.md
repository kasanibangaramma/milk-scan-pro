# Correct seven-column milk and amount mapping

## Changes
- Update image reading to require exactly seven table columns and map Day, Morning Milk, Morning Amount, Evening Milk, and Evening Amount by physical column position.
- Keep milk and amount values separate through validation and editing; uncertain values remain empty and are individually marked for checking.
- Preserve the existing mobile scan flow and results screen while adding editable amount fields and separate milk and amount totals.
- Verify the supplied two-row example produces Morning Amount 1080, Evening Amount 581, and Total Amount 1661.

## Technical details
- Expand scan row/cell types for columns 2, 4, 5, and 7.
- Reject non-seven-column responses and strengthen the extraction prompt against headers, fat values, and printed totals.
- Calculate totals only after all uncertain fields are corrected and confirmed.
