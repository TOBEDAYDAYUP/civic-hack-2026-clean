export type Decision = {
  id: number;
  topic: 'Transportation'|'Housing'|'Infrastructure'|'Budget'|'News';
  title: string;
  summary: string;
  date: string;
  area: string;
  sortDate: string;
  status: 'Council adopted';
};

export const decisions: Decision[] = [
  ['Transportation','Coordinating transit closures with city construction','Council asked city and TTC officials to coordinate planned transit closures with construction and major events.','JUL 29–30, 2026','City-wide','2026-07-30'],
  ['Transportation','A request to advance Park Lawn GO transit','Council requested an intergovernmental working group to examine transit improvements in Humber Bay Shores.','JUL 29–30, 2026','Etobicoke–Lakeshore','2026-07-30'],
  ['Transportation','Connecting new development with transit capacity','Council requested that future planning reports consider when transit infrastructure can serve growth.','JUL 29–30, 2026','City-wide','2026-07-30'],
  ['Housing','Advancing supportive housing and homelessness services','Council asked staff to explore support for supportive housing and include youth in service planning.','JUL 29–30, 2026','City-wide','2026-07-30'],
  ['Housing','Planning homes around transit stations','Council adopted an amended status report on several transit-oriented community proposals.','APR 22–23, 2026','Multiple Toronto locations','2026-04-23'],
  ['Infrastructure','Changing road-disruption rules and fees','Council adopted measures concerning road work reporting, eligible housing projects and transit signal priority.','APR 22–23, 2026','City-wide','2026-04-23'],
  ['Budget','Toronto’s 2026 property tax decision','Council adopted 2026 property tax ratios and related measures, with conditions linked to the final budget.','FEB 10, 2026','City-wide','2026-02-10'],
  ['Budget','Toronto’s 2026 budget and ten-year capital plan','The City’s 2026 budget is adopted and includes a ten-year capital plan.','FEB 10, 2026','City-wide','2026-02-10'],
  ['News','Funding for a future Saint Lawrence library branch','Council approved a capital budget increase funded by community benefits for the relocated Saint Lawrence library branch.','OCT 8–9, 2025','Toronto Centre','2025-10-09'],
  ['Transportation','Priority bus lanes for Queens Quay East','Council authorized interim bus-priority lanes on sections of Queens Quay East, Parliament Street and Front Street West.','MAR 26–27, 2025','Spadina–Fort York','2025-03-27'],
  ['Housing','A new chapter in protecting Toronto renters','Council adopted a Rental Renovation Licence Bylaw with amendments in November 2024. Read the decision and the steps it set out.','NOV 14, 2024','City-wide','2024-11-14'],
  ['Housing','More housing options along major streets','Toronto’s official demonstration plans explain the housing forms enabled by its June 2024 major streets decision.','JUN 2024','Eligible major streets','2024-06-01'],
  ['Infrastructure','Planning the future of Toronto’s public infrastructure','Council adopted the 2024 Corporate Asset Management Plan, describing the condition and lifecycle needs of city assets.','MAY 22, 2024','City-wide','2024-05-22'],
  ['Budget','Where Toronto’s 2024 budget put public money','Explore the approved operating budget and the ten-year capital plan through the City’s own budget documents.','2024','City-wide','2024-02-01']
].map((r, id) => ({id, topic:r[0], title:r[1], summary:r[2], date:r[3], area:r[4], sortDate:r[5], status:'Council adopted'})) as Decision[];
