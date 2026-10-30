import { driverCompleteness, driverDecisionIds, driverPrincipleIds, driverStatus, measurementState, MEASUREMENT_STATE_LABELS } from '@/domain/drivers'
import { APPROVAL_LABELS, DRIVER_STATUS_LABELS, PHASE_LABELS, REQUIREMENT_CLASS_LABELS, SOURCE_TYPE_LABELS, STATEMENT_KIND_LABELS, TARGET_STATUS_LABELS, TRANSCRIPTION_LABELS } from '@/domain/labels'
import { evidenceFor, traceRows } from '@/domain/traceability'
import type { ProjectData } from '@/domain/types'
import type { Table } from './common'

const person = (data: ProjectData, id: string | null) => (id ? (data.people.find((p) => p.id === id)?.name ?? 'Unknown') : '')

export function driverRegisterTable(data: ProjectData): Table {
  const code = (id: string, list: { id: string; code: string }[]) => list.find((x) => x.id === id)?.code ?? ''
  return {
    columns: [
      { key: 'code', label: 'ID', width: 8 },
      { key: 'title', label: 'Design Driver', width: 32 },
      { key: 'status', label: 'Status', width: 14 },
      { key: 'approval', label: 'Approval', width: 14 },
      { key: 'principles', label: 'Guiding Principles', width: 16 },
      { key: 'scope', label: 'Scope', width: 10 },
      { key: 'requirement', label: 'Requirement class', width: 16 },
      { key: 'ownerTerm', label: "Owner's original term", width: 26 },
      { key: 'description', label: 'Description', width: 40 },
      { key: 'outcome', label: 'Intended outcome', width: 32 },
      { key: 'kind', label: 'Measure type', width: 12 },
      { key: 'unit', label: 'Unit', width: 18 },
      { key: 'methodology', label: 'Measurement methodology', width: 32 },
      { key: 'baseline', label: 'Baseline', width: 12 },
      { key: 'target', label: 'Target', width: 12 },
      { key: 'targetStatus', label: 'Target status', width: 16 },
      { key: 'criteria', label: 'Acceptance criteria', width: 40 },
      { key: 'current', label: 'Current observed', width: 14 },
      { key: 'currentAsOf', label: 'Observed as of', width: 14 },
      { key: 'measurement', label: 'Measurement state', width: 22 },
      { key: 'owner', label: 'Accountable owner', width: 20 },
      { key: 'ownerOrg', label: 'Responsible organization', width: 22 },
      { key: 'phase', label: 'Phase', width: 18 },
      { key: 'targetDate', label: 'Target date', width: 12 },
      { key: 'validation', label: 'Validation method', width: 30 },
      { key: 'verification', label: 'Verification evidence', width: 40 },
      { key: 'verifiedBy', label: 'Verified by', width: 18 },
      { key: 'verifiedAt', label: 'Verified on', width: 12 },
      { key: 'risks', label: 'Risks', width: 30 },
      { key: 'dependencies', label: 'Dependencies', width: 14 },
      { key: 'decisions', label: 'Linked decisions', width: 14 },
      { key: 'evidence', label: 'Evidence statements', width: 22 },
      { key: 'completeness', label: 'Definition completeness', width: 12 },
      { key: 'version', label: 'Version', width: 8 },
    ],
    rows: data.drivers.map((d) => {
      const m = d.measure
      return {
        code: d.code,
        title: d.title,
        status: DRIVER_STATUS_LABELS[driverStatus(d)],
        approval: d.approvalStatus === 'approved' ? 'Approved' : `DRAFT — ${d.approvalStatus.replace('_', ' ')}`,
        principles: driverPrincipleIds(data, d.id).map((id) => code(id, data.principles)).join('; '),
        scope: d.scope === 'facility' ? 'Facility' : 'Delivery',
        requirement: REQUIREMENT_CLASS_LABELS[d.requirementClass],
        ownerTerm: d.ownerTerm,
        description: d.description,
        outcome: d.intendedOutcome,
        kind: m.kind === 'quantitative' ? 'Quantitative' : 'Qualitative',
        unit: m.unit,
        methodology: m.methodology,
        baseline: m.baseline ?? 'Unknown',
        target: m.kind === 'qualitative' ? 'n/a' : (m.target ?? 'Not set'),
        targetStatus: m.kind === 'qualitative' ? 'n/a' : TARGET_STATUS_LABELS[m.targetStatus],
        criteria: m.acceptanceCriteria,
        current: m.current ?? 'Not yet measured',
        currentAsOf: m.currentAsOf ?? '',
        measurement: MEASUREMENT_STATE_LABELS[measurementState(d)],
        owner: person(data, d.ownerPersonId) || 'Unassigned',
        ownerOrg: d.ownerOrganization,
        phase: PHASE_LABELS[d.phase],
        targetDate: d.targetDate ?? '',
        validation: d.validationMethod,
        verification: d.verification?.evidence ?? '',
        verifiedBy: person(data, d.verification?.reviewerId ?? null),
        verifiedAt: d.verification?.verifiedAt ?? '',
        risks: d.risks.join('; '),
        dependencies: d.dependencyIds.map((id) => code(id, data.drivers)).join('; '),
        decisions: driverDecisionIds(data, d.id).map((id) => code(id, data.decisions)).join('; '),
        evidence: evidenceFor(data, { type: 'driver', id: d.id }).direct.map((s) => s.code).join('; '),
        completeness: `${Math.round(driverCompleteness(data, d).ratio * 100)}%`,
        version: d.version,
      }
    }),
  }
}

export function traceabilityTable(data: ProjectData): Table {
  const principleStatus = (id: string) => {
    const p = data.principles.find((x) => x.id === id)
    return p ? APPROVAL_LABELS[p.status] : ''
  }
  return {
    columns: [
      { key: 'statement', label: 'Statement ID', width: 10 },
      { key: 'text', label: 'Original wording', width: 50 },
      { key: 'kind', label: 'Type', width: 14 },
      { key: 'criticality', label: 'Criticality', width: 10 },
      { key: 'transcription', label: 'Transcription', width: 14 },
      { key: 'source', label: 'Source ID', width: 10 },
      { key: 'sourceTitle', label: 'Source', width: 34 },
      { key: 'sourceType', label: 'Source type', width: 20 },
      { key: 'locator', label: 'Page / slide / photo', width: 14 },
      { key: 'themes', label: 'Themes', width: 26 },
      { key: 'principles', label: 'Guiding Principles', width: 30 },
      { key: 'drivers', label: 'Design Drivers', width: 30 },
      { key: 'decisions', label: 'Decisions', width: 14 },
      { key: 'pending', label: 'Links awaiting review', width: 12 },
    ],
    rows: traceRows(data).map((r) => ({
      statement: r.statementCode,
      text: r.statementText,
      kind: STATEMENT_KIND_LABELS[r.kind],
      criticality: r.criticality,
      transcription: TRANSCRIPTION_LABELS[r.transcription],
      source: r.sourceCode,
      sourceTitle: r.sourceTitle,
      sourceType: SOURCE_TYPE_LABELS[r.sourceType as keyof typeof SOURCE_TYPE_LABELS] ?? r.sourceType,
      locator: r.locator,
      themes: r.themes.map((t) => `${t.code} ${t.title}`).join('; '),
      principles: r.principles.map((p) => `${p.code} ${p.title}${p.via === 'theme' ? ' (via theme)' : ''} [${principleStatus(p.id)}]`).join('; '),
      drivers: r.drivers.map((d) => `${d.code} ${d.title}${d.via === 'principle' ? ' (via principle)' : ''}`).join('; '),
      decisions: r.decisions.map((d) => d.code).join('; '),
      pending: r.relationships.filter((x) => x.status === 'proposed').length,
    })),
  }
}
