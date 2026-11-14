// The public sample case and the links to its public sources. Rosales v. Terrell is a real,
// public case; the timeline built on these sources lives in sample-case.ts.
export const DEMO_CASE = {
  id: "5CIR-25-30650",
  name: "Rosales v. Terrell",
  charge: "Civil-rights claim (traffic stop, 2022)",
  court: "U.S. Court of Appeals, Fifth Circuit",
};

const COMPLAINT =
  "https://ij.org/wp-content/uploads/2022/10/LA-Rosales-Traffic-Stop-Complaint.pdf#page=24";
const OPINION =
  "https://www.govinfo.gov/content/pkg/USCOURTS-ca5-25-30650/pdf/USCOURTS-ca5-25-30650-0.pdf#page=11";

export const sourceLinks = {
  complaint: COMPLAINT,
  opinion: OPINION,
  bodycam: "https://www.youtube.com/watch?v=Z6z35SUVpdQ&t=45s",
  dashcam: "https://www.youtube.com/watch?v=xqvFJ8yzDfw&t=45s",
} as const;
