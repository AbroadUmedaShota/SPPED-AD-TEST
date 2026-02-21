### Implementation Proposal

To resolve this Issue, I will proceed with the implementation according to the following plan.

#### 1. **Pre-investigation Summary**
- Confirmed `graph-page.js` handles list entry formatting in `collectListEntries` and `renderChartSummaryTable`.
- Current implementation displays raw URLs or paths.
- `answerId` exists in the data and can be parsed for sequence numbers.

**Files to be changed:**
- `02_dashboard/src/graph-page.js`

#### 2. **Contribution to Project Goals**
- Standardizes file naming for exported/displayed images, improving data management and readability.

#### 3. **Overview of Changes**
- Formatting image links as `[surveyId]_[answerIdSeq]_[questionId]_[type].png`.

#### 4. **Specific Work Content for Each File**
- `02_dashboard/src/graph-page.js`:
    - Modify `collectListEntries` to include `answerId` and question metadata.
    - Modify `renderChartSummaryTable` to generate the new filename format for links.

#### 5. **Definition of Done**
- [ ] Code changes implemented in `graph-page.js`.
- [ ] Manual verification confirms correct filename format in the UI.
- [ ] No regression in other chart types.

---
If you approve, please reply to this comment with "Approve".