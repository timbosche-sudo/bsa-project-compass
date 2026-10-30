import { APPROVAL_LABELS, CONFIDENCE_LABELS, CONFIDENTIALITY_LABELS, CRITICALITY_LABELS, DECISION_STATUS_LABELS, DRIVER_STATUS_LABELS, STATEMENT_KIND_LABELS, TARGET_STATUS_LABELS, THEME_STATUS_LABELS, TRANSCRIPTION_LABELS } from '@/domain/labels'
import type { ApprovalStatus, Confidence, Confidentiality, Criticality, DecisionStatus, DriverStatus, Origin, StatementKind, TargetStatus, ThemeStatus, TranscriptionStatus } from '@/domain/types'
import { Badge, type Tone } from './ui'

export const APPROVAL_TONE: Record<ApprovalStatus, Tone> = { proposed: 'outline', in_review: 'info', needs_refinement: 'warn', approved: 'ok', not_adopted: 'danger', superseded: 'neutral' }
const DRIVER_TONE: Record<DriverStatus, Tone> = {
  proposed: 'outline',
  under_review: 'info',
  approved: 'accent',
  in_progress: 'accent',
  at_risk: 'risk',
  verified: 'ok',
  not_achieved: 'danger',
  superseded: 'neutral',
}
const DECISION_TONE: Record<DecisionStatus, Tone> = { framing: 'outline', evaluating: 'info', recommended: 'warn', approved: 'ok', deferred: 'neutral' }

export const ApprovalBadge = ({ status }: { status: ApprovalStatus }) => (
  <Badge tone={APPROVAL_TONE[status]} dot>
    {APPROVAL_LABELS[status]}
  </Badge>
)
export const DriverStatusBadge = ({ status }: { status: DriverStatus }) => (
  <Badge tone={DRIVER_TONE[status]} dot>
    {DRIVER_STATUS_LABELS[status]}
  </Badge>
)
export const DecisionBadge = ({ status }: { status: DecisionStatus }) => (
  <Badge tone={DECISION_TONE[status]} dot>
    {status === 'recommended' ? 'Awaiting approval' : DECISION_STATUS_LABELS[status]}
  </Badge>
)
export const ThemeBadge = ({ status }: { status: ThemeStatus }) => (
  <Badge tone={status === 'promoted' ? 'ok' : status === 'candidate' ? 'info' : status === 'archived' ? 'neutral' : 'outline'}>{THEME_STATUS_LABELS[status]}</Badge>
)
export const TargetBadge = ({ status }: { status: TargetStatus }) => (
  <Badge tone={status === 'approved' ? 'ok' : status === 'proposed' ? 'warn' : 'outline'}>Target: {TARGET_STATUS_LABELS[status]}</Badge>
)
export const KindBadge = ({ kind }: { kind: StatementKind }) => (
  <Badge tone={kind === 'nonnegotiable' ? 'danger' : kind === 'requirement' ? 'inverse' : kind === 'question' ? 'info' : 'neutral'}>{STATEMENT_KIND_LABELS[kind]}</Badge>
)
export const CriticalityBadge = ({ level }: { level: Criticality }) =>
  level === 'normal' ? null : <Badge tone={level === 'critical' ? 'danger' : 'warn'}>{CRITICALITY_LABELS[level]}</Badge>

export const ConfidenceBadge = ({ level }: { level: Confidence }) => (
  <Badge tone={level === 'high' ? 'ok' : level === 'medium' ? 'warn' : 'risk'} title="Evidence confidence">
    {CONFIDENCE_LABELS[level]} confidence
  </Badge>
)
export const TranscriptionBadge = ({ status }: { status: TranscriptionStatus }) =>
  status === 'not_applicable' ? null : <Badge tone={status === 'verified' ? 'ok' : status === 'uncertain' ? 'warn' : 'outline'}>Transcription: {TRANSCRIPTION_LABELS[status]}</Badge>

export const ConfidentialityBadge = ({ level }: { level: Confidentiality }) => (
  <Badge tone={level === 'restricted' ? 'danger' : level === 'confidential' ? 'warn' : level === 'internal' ? 'neutral' : 'outline'}>{CONFIDENTIALITY_LABELS[level]}</Badge>
)

/** Distinguishes direct evidence, AI interpretation, rules, and human conclusions. */
export const OriginBadge = ({ origin }: { origin: Origin | 'external' }) => {
  if (origin === 'ai') return <Badge tone="ai">AI suggestion</Badge>
  if (origin === 'rules') return <Badge tone="ai">Rule-based suggestion</Badge>
  if (origin === 'external') return <Badge tone="info">External research</Badge>
  return <Badge tone="neutral">Human</Badge>
}
