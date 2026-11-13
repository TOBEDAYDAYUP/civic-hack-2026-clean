/**
 * Editorial context for the selected, manually curated Council summaries.
 * These are prompts for investigation, not verified project outcomes.
 * Keys follow data/decisions.ts IDs.
 */
export type RecordContext = {
  significance: string;
  followUpQuestions: readonly string[];
};

export const recordContext: Record<number, RecordContext> = {
  0: {
    significance:
      'Coordinating roadworks, TTC closures and major events could make travel disruption easier to plan around. This decision does not confirm that any closure schedule has changed.',
    followUpQuestions: [
      'Have the City and TTC published a coordinated closure plan?',
      'Which routes, dates or neighbourhoods would be covered?',
    ],
  },
  1: {
    significance:
      'A working group could clarify transport options for Humber Bay Shores, but examining a proposal is not approval to build the Park Lawn GO station.',
    followUpQuestions: [
      'Has the intergovernmental working group reported findings?',
      'Is there a funded project, timeline or further decision?',
    ],
  },
  2: {
    significance:
      'Comparing planned development with transit capacity can inform future housing and infrastructure decisions. The summary does not prove transit service was expanded.',
    followUpQuestions: [
      'Which future planning reports include transit-capacity analysis?',
      'Do those reports identify specific funding or service commitments?',
    ],
  },
  3: {
    significance:
      'Exploring supportive housing and youth needs could influence future services. The summary does not establish that a particular housing project has been approved or built.',
    followUpQuestions: [
      'What did staff recommend after exploring these options?',
      'Are any funded housing projects or implementation dates identified?',
    ],
  },
  4: {
    significance:
      'Transit-oriented community planning may enable future housing, but a status report is not proof of an individual project’s planning approval, permit issuance or construction start.',
    followUpQuestions: [
      'Which specific projects or phases does the report discuss?',
      'What planning and permit milestones can be confirmed for each one?',
    ],
  },
  5: {
    significance:
      'Changes to road-work coordination and reporting may affect how construction is managed. A Council rule change alone does not establish that a housing development has started.',
    followUpQuestions: [
      'Which rules have taken effect and when?',
      'Are any affected projects and their construction milestones documented?',
    ],
  },
  6: {
    significance:
      'Property tax ratios can affect how a municipal tax burden is distributed. The short summary does not identify the impact on a particular resident’s bill.',
    followUpQuestions: [
      'What are the approved rates and effective dates?',
      'Which published budget documents explain the impact on each property class?',
    ],
  },
  7: {
    significance:
      'The operating and capital budgets set financial priorities, but an adopted plan is not proof that each project has been completed or that all funds were spent.',
    followUpQuestions: [
      'Which capital projects received approved funding?',
      'What delivery reports track actual spending and completion?',
    ],
  },
  8: {
    significance:
      'A capital budget increase can support planning for a future library branch, but the summary does not confirm a building opening date.',
    followUpQuestions: [
      'What is the updated capital budget and project scope?',
      'Has the City published construction and opening milestones?',
    ],
  },
  9: {
    significance:
      'Interim bus-priority lanes could affect how travel space is allocated on the named streets. Authorization does not by itself confirm installation is complete.',
    followUpQuestions: [
      'Have the interim lanes been installed on each street section?',
      'Is there an evaluation or updated implementation schedule?',
    ],
  },
  10: {
    significance:
      'A rental renovation licensing bylaw can change requirements for certain renovations. The decision should not be interpreted as a confirmed change affecting every renter.',
    followUpQuestions: [
      'What properties and types of renovation are covered?',
      'When do the rules apply, and what official tenant guidance is available?',
    ],
  },
  11: {
    significance:
      'Planning policy for major streets may allow more kinds of homes in eligible areas. Permission under policy is not proof that a specific development obtained a permit or began construction.',
    followUpQuestions: [
      'Which streets and property types are eligible?',
      'Are there corresponding project-level approvals or building permits?',
    ],
  },
  12: {
    significance:
      'An asset management plan describes needs and the condition of municipal infrastructure, but identified needs are not the same as funded or completed work.',
    followUpQuestions: [
      'Which assets are flagged for follow-up investment?',
      'Which priorities are funded and have public delivery dates?',
    ],
  },
  13: {
    significance:
      'The budget shows intended spending priorities. Compare approved allocations with subsequent reporting before drawing conclusions about delivered services.',
    followUpQuestions: [
      'Which budget lines correspond to the issue you are researching?',
      'Where does the City publish actual spending or project progress?',
    ],
  },
};
