### Summary
Currently, the information entered in the new survey modal (e.g., survey name, display title) is discarded when the user proceeds to the survey creation page. This requires the user to re-enter the same information, leading to a poor user experience.

### Proposal
To improve this workflow, this task will implement a feature to pass the data entered in the modal to the `surveyCreation.html` page using URL query parameters.

### Scope of Work
- **`02_dashboard/src/main.js`**: Modify the event listener for the modal's "Create" button. It will be updated to read the values from the modal's input fields and append them as query parameters to the redirection URL.
- **`02_dashboard/src/surveyCreation.js`**: This script (will be created if not present) will be responsible for parsing the query parameters from the URL upon page load. It will then populate the corresponding form fields on the `surveyCreation.html` page with the received data.