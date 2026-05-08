# ShotReady — Implementation Kickoff

You are building **ShotReady** from a complete PRD (Product Requirements Document) that has been decomposed into focused, implementation-ready files. This prompt is your guide to turning that PRD into a working application.

## Your Role

You are the lead developer. The PRD files in `docs/planning/` contain everything you need: architecture decisions, business logic, data models, API designs, UI specifications, and domain rules. These files were written for a mid-to-senior developer — they tell you *what* to build and *why*, not *how* to write every line.

## Step 1: Read the Full PRD

Before writing a single line of code, read every PRD file in order. This is critical — the files build on each other and contain cross-references.

1. Read `docs/planning/00_README.md`
2. Read `docs/planning/01_Auth.md`
3. Read `docs/planning/02_Database_Schema.md`
4. Read `docs/planning/03_Cloud_Functions.md`
5. Read `docs/planning/04_UI_Design_System.md`
6. Read `docs/planning/05_Offline_Strategy.md`
7. Read `docs/planning/06_Photographer_Onboarding.md`
8. Read `docs/planning/07_Service_Packages.md`
9. Read `docs/planning/08_Dashboard_Job_List.md`
10. Read `docs/planning/09_Schedule_Calendar.md`
11. Read `docs/planning/10_Booking_State_Machine.md`
12. Read `docs/planning/11_Agent_Booking.md`
13. Read `docs/planning/12_Route_Optimization.md`
14. Read `docs/planning/13_Shoot_Day_Field_Mode.md`
15. Read `docs/planning/14_Web_Companion.md`
16. Read `docs/planning/15_Photo_Processing.md`
17. Read `docs/planning/16_Proofing_Gallery.md`
18. Read `docs/planning/17_Delivery_MLS_Export.md`
19. Read `docs/planning/18_Invoicing_Payments.md`
20. Read `docs/planning/19_Notifications.md`
21. Read `docs/planning/20_Agent_Web_Shell.md`
22. Read `docs/planning/21_Future_Features.md`

Take notes on:
- The tech stack and architectural decisions (do NOT substitute frameworks or libraries)
- Data models and relationships between entities
- Dependencies between features (what must be built before what)
- Any "Gaps & Assumptions" sections — these flag areas where you may need to make judgment calls

## Step 2: Project Setup

After reading all PRD files:

1. Initialize the project with the tech stack specified in the README file
2. Set up the development environment, linting, and basic project structure
3. Create the database schema / data models as specified
4. Set up authentication if the project requires it
5. Commit this foundation before building any features

## Step 3: Build in Order

The PRD files are numbered by build sequence — **follow this order**. Each file lists its dependencies on other files.

**Foundation (build first):**
- `docs/planning/00_README.md`
- `docs/planning/01_Auth.md`
- `docs/planning/02_Database_Schema.md`
- `docs/planning/03_Cloud_Functions.md`
- `docs/planning/04_UI_Design_System.md`

**Features (build in numbered order):**
- `docs/planning/05_Offline_Strategy.md`
- `docs/planning/06_Photographer_Onboarding.md`
- `docs/planning/07_Service_Packages.md`
- `docs/planning/08_Dashboard_Job_List.md`
- `docs/planning/09_Schedule_Calendar.md`
- `docs/planning/10_Booking_State_Machine.md`
- `docs/planning/11_Agent_Booking.md`
- `docs/planning/12_Route_Optimization.md`
- `docs/planning/13_Shoot_Day_Field_Mode.md`
- `docs/planning/14_Web_Companion.md`
- `docs/planning/15_Photo_Processing.md`
- `docs/planning/16_Proofing_Gallery.md`
- `docs/planning/17_Delivery_MLS_Export.md`
- `docs/planning/18_Invoicing_Payments.md`
- `docs/planning/19_Notifications.md`
- `docs/planning/20_Agent_Web_Shell.md`

**Deferred (skip for now):**
- `docs/planning/21_Future_Features.md`

These are explicitly post-MVP. Do not implement them.

For each feature file:
1. Re-read the specific PRD file before implementing
2. Build the data layer first (models, database operations)
3. Build the API/service layer next
4. Build the UI last
5. Test the feature before moving to the next file
6. Commit after each feature is complete

## Implementation Rules

- **Follow the PRD exactly.** The PRD captures specific business logic, domain rules, and architectural decisions made during extensive product planning. Do not override these unless you find a genuine technical impossibility.
- **Respect the tech stack.** Do not substitute frameworks, libraries, or databases. The tech stack was chosen deliberately.
- **Use suggested defaults.** When a PRD file says "default" or suggests a reasonable value for something underspecified, use it unless you have a strong technical reason not to.
- **Flag concerns, don't guess.** If something in the PRD is ambiguous or seems wrong, flag it and ask rather than silently making a different choice.
- **Keep files focused.** Mirror the PRD's modular structure in your code — one feature area per module/directory.
- **No gold-plating.** Build what the PRD specifies. Don't add extra features, over-engineer abstractions, or optimize prematurely.

## Get Started

Begin by reading `docs/planning/00_README.md`. Once you've read all 22 PRD files, set up the project and start building.
