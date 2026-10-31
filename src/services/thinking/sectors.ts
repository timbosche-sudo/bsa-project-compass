import type { Phase, Sector } from '@/domain/types'

/**
 * Sector awareness. These are contextual possibilities to ask about, not
 * mandatory stakeholder categories or design requirements. A perspective is
 * only raised as a likely gap when the evidence itself points to it; otherwise
 * it is offered as a question.
 */
export interface Perspective {
  id: string
  label: string
  /** Matches who a statement is attributed to. */
  attributed: RegExp
  /** Matches when a statement talks about this group. */
  mentioned: RegExp
  /** Typical for this sector — asked about when absent. Contextual perspectives are only raised when the evidence mentions them. */
  typical: boolean
}

const P = {
  patients: { id: 'patients', label: 'patients, families or caregivers', attributed: /\b(patient|caregiver|family|families|parent)s?\b/i, mentioned: /\b(patient|caregiver|famil(y|ies))s?\b/i },
  frontline: { id: 'frontline', label: 'frontline staff', attributed: /\b(technician|staff|nurse|pharmacist|operator|clinician|frontline|shift|lead)\b/i, mentioned: /\b(staff|technician|nurse|people who|team member|employee)s?\b/i },
  nightShift: { id: 'night_shift', label: 'night-shift staff', attributed: /\bnight[- ]shift\b/i, mentioned: /\bnight[- ]?shift|overnight\b/i },
  leadership: { id: 'leadership', label: 'executive leadership', attributed: /\b(chief|vp|vice president|executive|leadership|president|dean|provost|director)\b/i, mentioned: /\bleadership|executive\b/i },
  facilities: { id: 'facilities', label: 'facilities and maintenance', attributed: /\b(facilit|maintenance|engineer)/i, mentioned: /\bmaintenance|facilities\b/i },
  community: { id: 'community', label: 'community partners or neighbors', attributed: /\b(community|neighbou?r|partner|civic)s?\b/i, mentioned: /\b(community|neighbou?r|partner)s?\b/i },
  students: { id: 'students', label: 'students', attributed: /\bstudent/i, mentioned: /\bstudent/i },
  faculty: { id: 'faculty', label: 'faculty and teaching staff', attributed: /\b(faculty|professor|teacher|instructor|lecturer)/i, mentioned: /\b(faculty|teacher|instructor)/i },
  researchers: { id: 'researchers', label: 'researchers', attributed: /\b(researcher|scientist|principal investigator|lab manager)/i, mentioned: /\b(research(er)?s?|scientist)/i },
  safety: { id: 'safety', label: 'environmental health and safety', attributed: /\b(ehs|safety officer|environmental health)/i, mentioned: /\bhazard|safety\b/i },
}

const t = (p: Omit<Perspective, 'typical'>): Perspective => ({ ...p, typical: true })
const c = (p: Omit<Perspective, 'typical'>): Perspective => ({ ...p, typical: false })

export const SECTOR_PERSPECTIVES: Record<Sector, Perspective[]> = {
  healing: [t(P.frontline), t(P.leadership), t(P.facilities), c(P.patients), c(P.nightShift), c(P.community), c(P.safety)],
  learning: [t(P.students), t(P.faculty), t(P.leadership), t(P.facilities), c(P.community)],
  discovery: [t(P.researchers), t(P.leadership), t(P.facilities), t(P.safety), c(P.community), c(P.students)],
  other: [t(P.leadership), c(P.frontline), c(P.facilities), c(P.community)],
}

/** Lenses that tend to matter in each sector; used only to order observations, never to invent requirements. */
export const SECTOR_LENSES: Record<Sector, string[]> = {
  healing: ['care', 'continuity', 'safety', 'people', 'flow'],
  learning: ['learning', 'collaboration', 'growth', 'community'],
  discovery: ['discovery', 'collaboration', 'safety', 'growth'],
  other: [],
}

export const LATE_PHASES: Phase[] = ['construction_documents', 'construction', 'commissioning', 'occupancy']
