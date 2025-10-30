### Implementation Proposal

To resolve this Issue, I will proceed with the implementation according to the following plan.

#### 1. **Pre-investigation Summary**
- The user has requested to add two new calendar views: a yearly view and a vertical list view. The requirements have been captured in the issue description and the `admin_requirements.md` file has been updated accordingly. The core logic will be implemented in `calendar-management.js`, with structural changes in `calendar-management.html` and styling in `admin-style.css`.

**Files to be changed:**
- `03_admin/calendar-management.html`
- `03_admin/src/calendar-management.js`
- `03_admin/src/admin-style.css`

#### 2. **Contribution to Project Goals**
- This change will enhance the usability of the calendar management page by providing users with different perspectives on the schedule, improving both long-term planning (Yearly View) and accessibility on smaller screens (Vertical View).

#### 3. **Overview of Changes**
- **UI:** Add three icon-based tabs to switch between Monthly, Vertical, and Yearly calendar views.
- **Yearly View:** Create a 12-month grid. Days will be color-coded based on whether they have surveys or are assigned. Clicking a day will switch to the monthly view of that date and open the details panel.
- **Vertical View:** Create a single-column, scrollable list of days, reusing the content logic from the existing monthly view to ensure consistency.

#### 4. **Specific Work Content for Each File**
- `03_admin/calendar-management.html`:
    - Add a `div` for the view-switcher tabs containing three `button` elements with Material Icons.
    - Add two new `div` containers, one for the yearly calendar (`#yearly-calendar-view`) and one for the vertical calendar (`#vertical-calendar-view`), both initially hidden.
- `03_admin/src/calendar-management.js`:
    - Add logic to handle tab switching, showing/hiding the appropriate view container.
    - Create a `renderYearlyCalendar()` function to generate and style the 12-month view. Implement the click-to-navigate functionality.
    - Create a `renderVerticalCalendar()` function to generate the list-based view.
    - Modify the `init()` function to set up the new views and event listeners.
- `03_admin/src/admin-style.css`:
    - Add CSS rules for the view-switcher tabs (active/inactive states).
    - Add styles for the yearly view grid, months, and days.
    - Add styles for the vertical view to ensure it's scrollable and readable.

#### 5. **Definition of Done**
- [ ] All necessary code changes have been implemented.
- [ ] New tests have been added to cover the changes. (Note: No test framework exists, will verify manually).
- [ ] All existing and new tests pass.
- [ ] The documentation has been updated to reflect the changes.
- [ ] The implementation has been manually verified.

---
If you approve, please reply to this comment with "Approve".