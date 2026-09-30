# Milk Scan Pro

Build a Mobile Milk Amount Scanner with Accurate Column-Based Calculation

Build a mobile-first web application that scans a milk-record sheet using a smartphone camera and calculates the Morning total and Evening total separately.

The application must prioritize calculation accuracy over visual effects or extra features.

1. EXACT PURPOSE OF THE APPLICATION

I have a monthly milk-record sheet.

The month is divided into two possible pages:

First-half page: Days 1 to 15

Second-half page: Days 16 to 30 or 31

The user will scan ONLY ONE page at a time.

The user can scan either:

the page containing days 1–15, OR

the page containing days 16–30/31

The application must calculate the totals from whichever single page is scanned.

The user does NOT need to scan both pages.

2. THE MOST IMPORTANT CALCULATION RULE

The scanned page contains a table with multiple columns.

The application must identify:

3rd column → MORNING

Last column → EVENING

The application must calculate:

Morning Total = sum of all valid daily values in the 3rd column

Evening Total = sum of all valid daily values in the last column

These two totals must always be calculated separately.

CRITICAL:

DO NOT simply detect all numbers in the image and add them together.

DO NOT use the order in which OCR returns numbers.

DO NOT assume that the first numbers detected by OCR are Morning values.

The application must determine the physical position of the columns in the table and then extract values based on their column position.

3. EXAMPLE OF THE REQUIRED LOGIC

Suppose the table has 5 columns:

DayColumn 2Column 3Column 4Column 51...5.5...6.02...4.0...5.53...6.0...4.5

In this example:

Column 3 = Morning

Column 5 = Evening because it is the last column

Therefore:

Morning Total = 5.5 + 4.0 + 6.0

Evening Total = 6.0 + 5.5 + 4.5

Values in Column 2 and Column 4 must NOT be included.

This is only an example. The actual application must determine the columns from the scanned table.

4. SCANNING

The home screen should have a large button:

📷 Scan Milk Page

Also provide:

🖼️ Choose Image

The user can either:

Take a photograph using the phone camera, or

Select an existing image from the phone.

The application must work properly on mobile phones.

5. MOBILE-FIRST REQUIREMENT

The application MUST be designed primarily for smartphones.

The complete workflow should work on a mobile phone:

Open website → Scan page → Process image → Review values → Calculate totals

Use:

Responsive design

Large buttons

Touch-friendly controls

Large readable text

Simple interface

Mobile camera support

Image upload support

Do not make the desktop version the priority.

6. IMAGE QUALITY

Before extracting values, process the image when necessary.

Support:

Perspective correction

Rotation/skew correction

Cropping

Contrast improvement

Noise reduction

Table detection

Row detection

Column detection

If the image is too blurry or incomplete, do NOT produce a potentially incorrect result.

Instead show:

"The page could not be read clearly. Please retake the photo with the complete table visible and good lighting."

7. OCR REQUIREMENT

Use position-aware OCR.

The OCR system must preserve the approximate location of every detected value:

X coordinate

Y coordinate

Width

Height

OCR confidence where available

The application must use these positions to understand the table.

The system should identify:

The table boundary

The rows

The columns

The third column

The last column

Then extract only the values belonging to those columns.

8. DO NOT USE SIMPLE NUMBER SUMMATION

Do NOT implement this logic:

Image → OCR → Find every number → Add every number

That approach is NOT acceptable.

Instead use:

Image → Table detection → Row/column detection → Position-aware OCR → Identify 3rd column → Identify last column → Extract values → Validate → User verification → Calculate

This distinction is extremely important.

9. DAY/ROW DETECTION

The application should identify the daily rows from the page.

For the first-half page, expected days are:

1–15

For the second-half page, expected days are:

16–30

or

16–31

depending on the month.

The application should NOT require the user to manually select "first half" or "second half".

It should process whichever page is scanned.

The day number is used for identifying the row only.

Never include the day number itself in the calculation.

10. MORNING VALUE EXTRACTION

For every valid daily row:

Locate the row.

Locate the table's third column.

Find the numerical value inside that cell.

Assign it to Morning.

Do not take values from neighboring columns.

Then calculate:

Morning Total = sum of all extracted Morning values

11. EVENING VALUE EXTRACTION

For every valid daily row:

Locate the row.

Locate the table's last column.

Find the numerical value inside that cell.

Assign it to Evening.

Do not take values from neighboring columns.

Then calculate:

Evening Total = sum of all extracted Evening values

12. IMPORTANT: "LAST COLUMN" MEANS THE ACTUAL TABLE'S LAST COLUMN

The application must determine the actual last column of the detected table.

It must NOT mean:

last number detected by OCR

last number on the page

last number in OCR reading order

It means:

the rightmost/actual final column of the detected table.

Likewise, the Morning column means:

the third column of the detected table from left to right.

13. PREVENT WRONG VALUES

The application must prevent common OCR errors.

Examples:

0 incorrectly recognized as 8

1 incorrectly recognized as 7

5 incorrectly recognized as 6

Missing decimal point

Incorrect decimal point

Two values merged together

One value detected twice

Value taken from neighboring column

Header value included

Day number included

Printed total included

Do not silently accept low-confidence or structurally suspicious values.

14. DUPLICATE DETECTION

If OCR detects the same number more than once in approximately the same location, treat it as a duplicate and do not add it twice.

Each table cell should contribute at most one value.

15. IGNORE NON-DAILY VALUES

Do NOT include:

Day numbers

Serial numbers

Customer/member numbers

Headers

Column labels

Other columns

Printed totals

Subtotals

Numbers outside the table

Only the daily values inside:

3rd column

and

last column

are relevant to the calculation.

16. VERIFICATION SCREEN

After OCR extraction, DO NOT immediately display the final total.

First show a verification table.

Example:

DayMorningEvening15.56.024.05.536.04.5.........155.06.0

For the second page:

DayMorningEvening16......17...............30/31......

The user must be able to edit an incorrectly recognized value.

Each value should have an easy:

✏️ Edit

option.

17. USER CONFIRMATION

After reviewing the extracted values, provide:

✓ Confirm & Calculate

Only after the user confirms should the application calculate the final totals.

This provides an additional layer of protection against OCR mistakes.

18. CALCULATION

After confirmation:

Morning Total

Add ONLY the confirmed Morning values.

Evening Total

Add ONLY the confirmed Evening values.

Grand Total

Also calculate:

Grand Total = Morning Total + Evening Total

The application must maintain decimal precision and must not incorrectly round values.

19. RESULTS SCREEN

Display a very clear result.

Example:

Milk Calculation Result

Morning Total

82.50

Evening Total

79.25

Grand Total

161.75

Also display:

Rows detected: 15

or the appropriate number of rows for the scanned page.

Provide:

🗑️ Clear Scan

and

📷 Scan Another Page

20. NO PERMANENT STORAGE

This is a strict requirement.

The scanned page must NOT be permanently stored.

The extracted values must NOT be permanently stored.

Do NOT create a database for scan history.

Do NOT save scanned images to permanent storage.

Do NOT save OCR results permanently.

Do NOT create a history of previous scans.

The scan should only exist temporarily while the current calculation is being performed.

When the user clicks:

🗑️ Clear Scan

clear:

Image

OCR data

Extracted values

Calculated totals

Temporary state

When the user starts a new scan, the previous scan data must also be cleared.

21. NO LOGIN REQUIRED

Do not require an account or login just to scan and calculate.

The core functionality should be immediately accessible from the home screen.

22. ERROR HANDLING

If the table cannot be detected:

"Could not identify the table. Please retake the photo with the complete page visible."

If the third column cannot be identified:

"Could not identify the Morning column. Please retake the photo clearly."

If the last column cannot be identified:

"Could not identify the Evening column. Please retake the photo clearly."

If individual values are uncertain:

"Some values could not be read confidently. Please verify the highlighted values."

The application must prefer asking the user to verify rather than generating an incorrect total.

23. EMPTY CELLS

If a daily Morning or Evening cell is blank or unreadable, do not automatically assume a value unless the application's logic can reliably determine that it represents no entry.

Flag the cell for user verification.

For example:

Day 7 — Morning: Needs verification

The user can then enter the correct value.

24. FIRST-HALF AND SECOND-HALF SUPPORT

The application must independently support:

Page 1

Days:

1, 2, 3, ... 15

Page 2

Days:

16, 17, 18, ... 30

or

16, 17, 18, ... 31

The user can scan either page independently.

Do not require both pages.

Do not combine the two pages unless the user separately scans them in a future session.

25. TECHNOLOGY

Build this as a modern mobile-first responsive web application / PWA.

Recommended stack:

React

TypeScript

Vite

Tailwind CSS or clean modern CSS

Use an OCR/table extraction solution capable of providing text plus positional information.

The architecture must preserve the spatial relationship between detected numbers and their table cells.

26. SIMPLE USER FLOW

The final application should follow this exact flow:

HOME

🥛 Milk Amount Scanner

"Scan your milk record page to calculate Morning and Evening totals."

📷 Scan Milk Page

or

🖼️ Choose Image

↓

SCAN

Capture the page.

↓

PROCESSING

Detecting table...

Detecting rows...

Detecting columns...

Reading Morning values...

Reading Evening values...

Validating values...

↓

VERIFY

Show:

Day | Morning | Evening

Allow corrections.

↓

CALCULATE

User taps:

✓ Confirm & Calculate

↓

RESULT

Show:

Morning Total

Evening Total

Grand Total

↓

CLEAR

User taps:

🗑️ Clear Scan

All temporary scan information is removed.

27. THREE NON-NEGOTIABLE REQUIREMENTS

The application will be considered successful only if these three requirements are satisfied:

REQUIREMENT 1 — CORRECT TOTAL

Correctly calculate:

Morning = 3rd column

Evening = last column

and show them separately.

REQUIREMENT 2 — CORRECT CALCULATION

Never simply add all OCR-detected numbers.

Use table structure, row position and column position to ensure only the correct values are calculated.

Provide a verification step before the final result.

REQUIREMENT 3 — MOBILE USE

The complete application must be usable from a smartphone, including:

Camera → Scan → OCR → Verify → Calculate → Result

28. FINAL DEVELOPMENT PRIORITY

If there is a conflict between features, prioritize them in this exact order:

Correct identification of the 3rd column

Correct identification of the last column

Correct extraction of daily values

Correct Morning and Evening calculations

Verification/editing

No permanent storage

Mobile camera usability

Clean and simple UI

Do not add unnecessary features that could complicate the core calculation.

The core purpose is:

SCAN ONE PAGE → IDENTIFY TABLE → READ 3RD COLUMN AS MORNING → READ LAST COLUMN AS EVENING → VERIFY → CALCULATE SEPARATELY → DISPLAY TOTALS → CLEAR DATA

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/808cba79-b30a-44d4-b06c-8ecd34135d6d).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
