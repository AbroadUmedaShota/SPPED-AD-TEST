Closes #45

### Description

Implement functionality to read survey answers from a CSV file and display them in a modal when the 'Details' button is clicked on the speed-review page.

- Modified `reviewDetailModal.html` to create a container for the CSV data and enable vertical scrolling.
- Updated `speed-review.js` to fetch and parse the CSV file, generate an HTML table, and inject it into the modal.