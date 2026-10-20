# Percy AI Report Utility

The Percy AI Review Report website will turn a completed Percy build’s existing AI analysis into one concise, actionable report—accessible through a direct link and available to download.

The purpose will not be to make customers inspect every snapshot again. It will help them quickly answer:
* What changed?
* Which changes look like bugs?
* Where did they happen?
* What should I review?

## Steps to Use the Utility

1. The team will complete its Percy build and snapshot comparisons.
2. The customer will run a command, providing authentication and the identifier for that Percy build.
3. The report generator will retrieve the build’s comparison results and the existing Percy AI Review Agent analysis.
4. It will organize those results into a consolidated report.
5. The command will return a direct report URL.
6. A reviewer will open that URL to see the build summary, review individual differences, and access baseline-versus-target comparisons.
7. The reviewer will be able to view the report.

> **Important:** We will package and present existing AI analysis—not propose a second AI engine that independently analyzes the screenshots again.

If generation takes time, the proposed experience will be to return a stable link immediately, show a processing state, and display the report at that same link when ready.

## What the Website Will Show

### A. Build Summary
At the top, it will show enough context for reviewers to understand what they are looking at:
* Percy project and build identifier.
* Baseline and target build/environment information, where available.
* Report generation time.
* A link to the original Percy build.

It will then show the core summary:

| Summary | What It Will Tell the Reviewer |
| :--- | :--- |
| **Total reported differences** | How many visual differences will be included in this report |
| **Likely bugs** | How many differences the existing AI analysis will classify as likely bugs |
| **Not bugs** | How many differences it will classify as not bugs |
| **Category breakdown** | How the differences will be distributed across the categories provided by the AI Review Agent |

We will avoid labeling every visual difference as a confirmed “defect.” A difference may be intentional, and a likely bug will be an AI classification—not a confirmed defect.

### B. Findings List
The main section will be a concise, filterable list of findings.

Each finding will contain:

| Field | Expected Content |
| :--- | :--- |
| **Page / snapshot** | The page or snapshot where the difference occurred |
| **Specific page URL** | The associated tested page URL, where available |
| **Category** | The category supplied by the Percy AI Review Agent |
| **Bug classification** | Likely bug / not a bug, as supplied by the agent |
| **AI description** | A short explanation of the visual difference |
| **Comparison link** | An action to open baseline and target together |

Useful filters will include:
* Bug classification
* Category
* Page or snapshot

### C. Comparison View
Each finding will provide a clear “View comparison” action that will open:
* Baseline capture — Prod
* Target capture — Stage

...together on one screen.

The important distinction will be that these must be the captured screenshots used in the Percy comparison, not merely links to today’s live production and staging pages. Live pages may change after the build and will no longer represent the reported difference.

The tested page URL will remain available separately for context.

Whether this comparison opens inside our website or links to an existing Percy comparison view will be an implementation decision. The requirement will be the same: one click to inspect both captures together.

## 3. Severity: What We Will—and Will Not—Promise

The product response will explicitly substitute bug classification because Percy does not currently assign severity.

Therefore, the agreed report will show:
* Likely bug
* Not a bug

It will not invent Critical / High / Medium / Low ratings or present bug classification as if it were severity.

If a finding has no available classification, the website will display “Not classified”, rather than silently treating it as “Not a bug.”
