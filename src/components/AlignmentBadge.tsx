import { ALIGNMENT_STATUS_LABELS } from '@/domain/labels'
import type { AlignmentStatus } from '@/domain/types'
import { cx } from './ui'

export const ALIGNMENT_TONE: Record<AlignmentStatus, string> = {
  aligned: 'bg-ok-fill',
  aligned_with_refinements: 'bg-info-fill',
  needs_discussion: 'bg-warn-fill',
  not_reviewed: 'bg-line-strong',
}

/** Owner alignment (a conversational outcome), shown distinctly from formal approval status. */
export function AlignmentBadge({ status, prefix }: { status: AlignmentStatus; prefix?: string }) {
  return (
    <span className={cx('inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11.5px] font-medium whitespace-nowrap', status === 'not_reviewed' ? 'border-line text-muted' : 'border-line-strong text-ink')}>
      <span className={cx('size-1.5 rounded-full', ALIGNMENT_TONE[status])} />
      {prefix && <span className="text-muted">{prefix}</span>}
      {ALIGNMENT_STATUS_LABELS[status]}
    </span>
  )
}
