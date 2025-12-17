### Implementation Proposal

To resolve this Issue, I will proceed with the implementation according to the following plan.

#### 1. **Pre-investigation Summary**
- **Current State**:
    - `02_dashboard/modals/surveyDetailsModal.html`: Label is "名刺データ化件数" (line 104).
    - `02_dashboard/src/surveyDetailsModal.js`: Displays `survey.bizcardCompletionCount` (line 323).
- **Goal**:
    - Change label to "名刺見込み件数".
    - Display `survey.bizcardRequest` instead of completion count. Note that `bizcardRequest` is already present in the survey data and logic (lines 282, 381 in bizcardSettings.js logic confirm usage, and line 215 in surveyDetailsModal.js preserves it).

**Files to be changed:**
- `02_dashboard/modals/surveyDetailsModal.html`
- `02_dashboard/src/surveyDetailsModal.js`

#### 2. **Contribution to Project Goals**
- Aligns the detailed view with the user's input in the settings, providing clarity on the *requested* volume rather than just the *completed* volume, which might be N/A or zero initially.

#### 3. **Overview of Changes**
- **HTML**: Update the label text.
- **JS**: Update the `populateSurveyDetails` function to map the text content of the target element to `survey.bizcardRequest`.

#### 4. **Specific Work Content for Each File**
- `02_dashboard/modals/surveyDetailsModal.html`:
    - Change `<label>` text from "名刺データ化件数" to "名刺見込み件数".
- `02_dashboard/src/surveyDetailsModal.js`:
    - In `populateSurveyDetails`, change `detail_bizcardCompletionCount_view.textContent` assignment.
    - It should display `${survey.bizcardRequest || 0}件` if enabled, otherwise 'N/A' (or keep existing logic for "utilize/not utilize" check).

#### 5. **Definition of Done**
- [ ] Label in Survey Details Modal says "名刺見込み件数".
- [ ] Value displayed matches the input form value (bizcardRequest).
- [ ] `GEMINI.md` workflow is followed.

---
If you approve, please reply to this comment with "Approve".