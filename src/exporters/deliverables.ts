import { alignmentStatusOf, latestAlignedDirection, latestAlignment } from '@/domain/alignment'
import { APPROVAL_LABELS, ALIGNMENT_STATUS_LABELS, CATEGORY_LABELS, HEARD_SECTION_LABELS, OPPORTUNITY_STATE_LABELS, OUTCOME_CATEGORY_LABELS, OUTCOME_STATE_LABELS } from '@/domain/labels'
import { evidenceFor, isOwnerEvidence } from '@/domain/traceability'
import { HEARD_SECTIONS, type AlignmentStatus, type ApprovalStatus, type HeardSection, type PointOfViewContent, type ProjectData, type Statement } from '@/domain/types'
import { isActiveFramework } from '@/domain/wording'

/**
 * The curated content shared by the Owner presentation, the Vision and
 * Principles document and the meeting summary. Pure and deterministic: it only
 * reads recorded project content, and every status is stated, never implied.
 */
export interface Quote {
  code: string
  text: string
  speaker: string
  owner: boolean
}

export interface DeliverablePrinciple {
  id: string
  code: string
  title: string
  statement: string
  intent: string
  category: string
  whyItMatters: string
  designImplications: string
  approval: ApprovalStatus
  approvalLabel: string
  alignment: AlignmentStatus
  alignmentLabel: string
  refinements: string
  opportunities: { code: string; title: string; description: string; state: string; inPresentation: boolean }[]
  outcomes: { code: string; statement: string; category: string; state: string; aspiration: boolean; possibleMeasures: string; inPresentation: boolean; progress: number }[]
  evidence: Quote[]
  evidenceCount: number
}

export interface DeliverableModel {
  project: { name: string; code: string; owner: string; isDemo: boolean }
  /** e.g. "Aligned direction DIR-03, recorded Nov 5, 2026" or "Working draft — not yet aligned with the Owner". */
  status: { aligned: boolean; label: string }
  terms: { vision: string; principle: string }
  vision: { code: string; statement: string; narrative: string; approvalLabel: string; alignmentLabel: string } | null
  visionAlternatives: { code: string; statement: string; narrative: string; approvalLabel: string }[]
  pointOfView: PointOfViewContent | null
  heard: { section: HeardSection; label: string; items: { title: string; narrative: string; quote: Quote | null }[] }[]
  principles: DeliverablePrinciple[]
  discussion: string[]
  openQuestions: string[]
}

const quote = (data: ProjectData, s: Statement): Quote => ({ code: s.code, text: s.originalText, speaker: s.speaker, owner: isOwnerEvidence(data, s) })

export function leadingVision(data: ProjectData) {
  const active = data.winThemes.filter((w) => isActiveFramework(w.status) && w.status !== 'not_adopted')
  return (
    active.find((w) => w.status === 'approved') ??
    active.find((w) => ['aligned', 'aligned_with_refinements'].includes(alignmentStatusOf(data, 'winTheme', w.id))) ??
    active.find((w) => w.status === 'in_review') ??
    active[0] ??
    null
  )
}

export function deliverableModel(data: ProjectData, opts: { presentationOnly?: boolean } = {}): DeliverableModel {
  const p = data.project
  const t = p.terminology
  const aligned = latestAlignedDirection(data)
  const vision = leadingVision(data)
  const principles = [...data.principles].sort((a, b) => a.order - b.order).filter((x) => isActiveFramework(x.status) && x.status !== 'not_adopted')
  const keep = (inPresentation: boolean) => !opts.presentationOnly || inPresentation

  return {
    project: { name: p.name, code: p.code, owner: p.owner.name, isDemo: p.isDemo },
    status: aligned
      ? { aligned: true, label: `Aligned direction ${aligned.code}, recorded ${aligned.at.slice(0, 10)}${principles.some((x) => changedSince(aligned, x)) ? ' — with changes made since' : ''}` }
      : { aligned: false, label: 'Working draft — not yet aligned with the Owner' },
    terms: { vision: t.winTheme, principle: t.guidingPrinciple },
    vision: vision
      ? {
          code: vision.code,
          statement: vision.statement,
          narrative: vision.narrative,
          approvalLabel: APPROVAL_LABELS[vision.status],
          alignmentLabel: ALIGNMENT_STATUS_LABELS[alignmentStatusOf(data, 'winTheme', vision.id)],
        }
      : null,
    visionAlternatives: data.winThemes
      .filter((w) => w.id !== vision?.id && isActiveFramework(w.status) && w.status !== 'not_adopted')
      .map((w) => ({ code: w.code, statement: w.statement, narrative: w.narrative, approvalLabel: APPROVAL_LABELS[w.status] })),
    pointOfView: data.pointOfView,
    heard: HEARD_SECTIONS.map((section) => ({
      section,
      label: HEARD_SECTION_LABELS[section],
      items: data.heard
        .filter((h) => h.section === section && h.reviewed && keep(h.inPresentation))
        .sort((a, b) => a.order - b.order)
        .map((h) => {
          const s = h.evidence.filter((e) => e.type === 'statement').map((e) => data.statements.find((x) => x.id === e.id)).find((x): x is Statement => !!x)
          return { title: h.title, narrative: h.narrative, quote: s ? quote(data, s) : null }
        }),
    })).filter((s) => s.items.length > 0),
    principles: principles.map((x) => {
      const ev = evidenceFor(data, { type: 'principle', id: x.id })
      const ordered = [...ev.direct, ...ev.viaThemes]
      const r = latestAlignment(data, 'principle', x.id)
      return {
        id: x.id,
        code: x.code,
        title: x.title,
        statement: x.statement,
        intent: x.intent,
        category: CATEGORY_LABELS[x.category],
        whyItMatters: x.whyItMatters ?? '',
        designImplications: x.designImplications ?? '',
        approval: x.status,
        approvalLabel: APPROVAL_LABELS[x.status],
        alignment: r?.status ?? 'not_reviewed',
        alignmentLabel: ALIGNMENT_STATUS_LABELS[r?.status ?? 'not_reviewed'],
        refinements: r?.refinements ?? '',
        opportunities: data.opportunities
          .filter((o) => o.principleIds.includes(x.id) && keep(o.inPresentation))
          .sort((a, b) => a.order - b.order)
          .map((o) => ({ code: o.code, title: o.title, description: o.description, state: OPPORTUNITY_STATE_LABELS[o.state], inPresentation: o.inPresentation })),
        outcomes: data.outcomes
          .filter((o) => o.principleId === x.id && keep(o.inPresentation))
          .sort((a, b) => a.order - b.order)
          .map((o) => ({
            code: o.code,
            statement: o.statement,
            category: OUTCOME_CATEGORY_LABELS[o.category],
            state: OUTCOME_STATE_LABELS[o.state],
            aspiration: o.aspiration,
            possibleMeasures: o.possibleMeasures,
            inPresentation: o.inPresentation,
            progress: o.evidenceOfProgress.length,
          })),
        evidence: ordered.slice(0, 3).map((s) => quote(data, s)),
        evidenceCount: ev.all.length,
      }
    }),
    discussion: [
      `Does this ${t.winTheme.toLowerCase()} describe what you want this project to be?`,
      `Which ${t.guidingPrinciple.toLowerCase()}s feel right — and which need refining?`,
      'What is missing, or what would you say differently?',
    ],
    openQuestions: data.questions.filter((q) => q.status === 'open').map((q) => q.question),
  }
}

function changedSince(aligned: NonNullable<ReturnType<typeof latestAlignedDirection>>, p: { id: string; title: string; statement: string }) {
  const then = aligned.content.principles.find((x) => x.id === p.id)
  return !then || then.title !== p.title || then.statement !== p.statement
}
