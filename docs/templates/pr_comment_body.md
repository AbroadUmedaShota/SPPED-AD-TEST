### Self-Review Report

I have conducted a self-review and confirmed that the implementation aligns with the project's standards and the requirements of the Issue. All standard checks, including diff confirmation, convention adherence, and documentation updates, have been successfully passed.

---

### Quality Gate Assessment

- **Computational Complexity:** O(N) where N is the number of invoice sheets (usually 1-2). Negligible performance impact.
- **Security:** No security implications.
- **Scalability:** Handles multiple pages gracefully.

---

### Design Trade-offs

- **Direct DOM Manipulation:** Temporarily modifying styles directly (`sheet.style.marginBottom`) is necessary because `html2pdf` captures the live DOM. This is a standard workaround for library limitations regarding page breaks and margins.

---
Please review and approve the merge.