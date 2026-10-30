import { FileUp } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useProject } from '@/app/project'
import { useSession } from '@/app/session'
import { Dialog } from '@/components/Dialog'
import { Button, Callout, Field, Input, optionsFrom, Select, Textarea } from '@/components/ui'
import { CONFIDENCE_LABELS, CONFIDENTIALITY_LABELS, CRITICALITY_LABELS, SOURCE_TYPE_LABELS, STATEMENT_KIND_LABELS, TRANSCRIPTION_LABELS } from '@/domain/labels'
import { fileReferenceSchema, MAX_UPLOAD_BYTES } from '@/domain/schemas'
import { ALLOWED_MIME_TYPES } from '@/domain/types'
import type { Confidence, Confidentiality, Criticality, FileReference, Locator, Source, SourceType, Statement, StatementKind, TranscriptionStatus } from '@/domain/types'

export function formatBytes(n: number) {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

const today = () => new Date().toISOString().slice(0, 10)

export function SourceFormDialog({ open, onOpenChange, source, onSaved }: { open: boolean; onOpenChange: (o: boolean) => void; source?: Source; onSaved?: (id: string) => void }) {
  const { data, run, pending } = useProject()
  const { adapter } = useSession()
  const blank = {
    title: '',
    type: 'workshop_notes' as SourceType,
    author: '',
    organization: '',
    date: today(),
    confidentiality: 'internal' as Confidentiality,
    description: '',
    file: null as FileReference | null,
    possibleDuplicateOf: null as string | null,
  }
  const [form, setForm] = useState(blank)
  const [fileError, setFileError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setFileError(null)
    setForm(
      source
        ? { title: source.title, type: source.type, author: source.author, organization: source.organization, date: source.date, confidentiality: source.confidentiality, description: source.description, file: source.file, possibleDuplicateOf: source.possibleDuplicateOf }
        : blank,
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, source])

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }))

  const onFile = (file: File | undefined) => {
    setFileError(null)
    if (!file) return
    const ref = { name: file.name, mimeType: file.type, sizeBytes: file.size, storagePath: null }
    const parsed = fileReferenceSchema.safeParse(ref)
    if (!parsed.success) {
      setFileError(parsed.error.issues[0]?.message ?? 'Invalid file')
      return
    }
    // Demo mode records metadata only; contents are never read, stored or transmitted.
    set('file', parsed.data)
    if (!form.title) set('title', file.name.replace(/\.[^.]+$/, ''))
  }

  const save = async () => {
    const id = source
      ? await run({ type: 'source.update', id: source.id, patch: form }, 'Source updated')
      : await run({ type: 'source.create', source: form }, 'Source registered')
    if (id !== undefined) {
      onOpenChange(false)
      onSaved?.(id ?? source!.id)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      title={source ? `Edit ${source.code}` : 'Register a source'}
      description="Every source keeps its attribution, confidentiality classification and version."
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="primary" loading={pending} disabled={!form.title.trim() || !form.date} onClick={save}>
            {source ? 'Save changes' : 'Register source'}
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Title" required className="sm:col-span-2">
          {(id) => <Input id={id} value={form.title} onChange={(e) => set('title', e.target.value)} maxLength={200} />}
        </Field>
        <Field label="Source type">
          {(id) => <Select id={id} value={form.type} onChange={(e) => set('type', e.target.value as SourceType)} options={optionsFrom(SOURCE_TYPE_LABELS)} />}
        </Field>
        <Field label="Date" required>
          {(id) => <Input id={id} type="date" value={form.date} onChange={(e) => set('date', e.target.value)} />}
        </Field>
        <Field label="Author">
          {(id) => <Input id={id} value={form.author} onChange={(e) => set('author', e.target.value)} maxLength={200} />}
        </Field>
        <Field label="Organization">
          {(id) => <Input id={id} value={form.organization} onChange={(e) => set('organization', e.target.value)} maxLength={200} />}
        </Field>
        <Field label="Confidentiality" hint="Controls handling and whether AI assistance may process the content.">
          {(id) => <Select id={id} value={form.confidentiality} onChange={(e) => set('confidentiality', e.target.value as Confidentiality)} options={optionsFrom(CONFIDENTIALITY_LABELS)} />}
        </Field>
        <Field label="Possible duplicate of" hint="e.g. a second photograph of the same note">
          {(id) => (
            <Select
              id={id}
              value={form.possibleDuplicateOf ?? ''}
              onChange={(e) => set('possibleDuplicateOf', e.target.value || null)}
              options={[{ value: '', label: 'Not a duplicate' }, ...data.sources.filter((s) => s.id !== source?.id).map((s) => ({ value: s.id, label: `${s.code} — ${s.title}` }))]}
            />
          )}
        </Field>
        <Field label="Description" className="sm:col-span-2">
          {(id) => <Textarea id={id} value={form.description} onChange={(e) => set('description', e.target.value)} />}
        </Field>
        <div className="sm:col-span-2">
          <Field label="Original file" hint={`PDF, PowerPoint, Word, JPEG, PNG, HEIC or text · max ${formatBytes(MAX_UPLOAD_BYTES)}`} error={fileError}>
            {(id) => (
              <div className="flex flex-wrap items-center gap-3">
                <label htmlFor={id} className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border border-line-strong bg-surface px-3 text-[13px] font-medium hover:bg-sunken">
                  <FileUp className="size-4" /> Choose file
                </label>
                <input id={id} type="file" className="sr-only" accept={ALLOWED_MIME_TYPES.join(',')} onChange={(e) => onFile(e.target.files?.[0])} />
                {form.file ? (
                  <span className="text-[13px] text-ink-2">
                    {form.file.name} · {formatBytes(form.file.sizeBytes)}{' '}
                    <button className="ml-1 text-muted underline" onClick={() => set('file', null)}>
                      Remove
                    </button>
                  </span>
                ) : (
                  <span className="text-[13px] text-muted">No file attached</span>
                )}
              </div>
            )}
          </Field>
          {adapter.mode === 'demo' && (
            <div className="mt-3">
              <Callout tone="warn" title="Demo mode: metadata only">
                Only the file name, type and size are recorded. File contents are not read, stored or uploaded. Do not use real or confidential documents.
              </Callout>
            </div>
          )}
        </div>
      </div>
    </Dialog>
  )
}

const LOCATOR_KINDS: { value: Locator['kind']; label: string }[] = [
  { value: 'none', label: 'No locator' },
  { value: 'page', label: 'Page' },
  { value: 'slide', label: 'Slide' },
  { value: 'photo', label: 'Photograph' },
  { value: 'section', label: 'Section' },
]

export function StatementFormDialog({ open, onOpenChange, source, statement }: { open: boolean; onOpenChange: (o: boolean) => void; source: Source; statement?: Statement }) {
  const { run, pending } = useProject()
  const isPhoto = source.type === 'photograph'
  const [form, setForm] = useState({
    originalText: '',
    locator: { kind: (isPhoto ? 'photo' : 'none') as Locator['kind'], value: '' },
    speaker: '',
    kind: 'aspiration' as StatementKind,
    criticality: 'normal' as Criticality,
    confidence: 'high' as Confidence,
    transcriptionStatus: (isPhoto ? 'unverified' : 'not_applicable') as TranscriptionStatus,
    uncertainWords: '',
    interpretation: '',
  })
  useEffect(() => {
    if (!open) return
    if (statement) {
      setForm({
        originalText: statement.originalText,
        locator: { kind: statement.locator.kind, value: statement.locator.value },
        speaker: statement.speaker,
        kind: statement.kind,
        criticality: statement.criticality,
        confidence: statement.confidence,
        transcriptionStatus: statement.transcriptionStatus,
        uncertainWords: statement.uncertainWords.join(', '),
        interpretation: statement.interpretation,
      })
    } else {
      setForm((f) => ({ ...f, originalText: '', interpretation: '', uncertainWords: '', speaker: '' }))
    }
  }, [open, statement])
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }))

  const save = async () => {
    const locator = statement?.locator.region && form.locator.kind === statement.locator.kind ? { ...form.locator, region: statement.locator.region } : form.locator
    const ok = statement
      ? await run({ type: 'statement.updateMeta', id: statement.id, patch: { locator, speaker: form.speaker, kind: form.kind, criticality: form.criticality, confidence: form.confidence, interpretation: form.interpretation } }, 'Statement updated')
      : await run(
          {
            type: 'statement.create',
            statement: {
              sourceId: source.id,
              originalText: form.originalText,
              locator,
              speaker: form.speaker,
              kind: form.kind,
              criticality: form.criticality,
              confidence: form.confidence,
              transcriptionStatus: form.transcriptionStatus,
              uncertainWords: splitWords(form.uncertainWords),
              interpretation: form.interpretation,
            },
          },
          'Statement recorded',
        )
    if (ok !== undefined) onOpenChange(false)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      title={statement ? `Edit ${statement.code} metadata` : `Record a statement from ${source.code}`}
      description={statement ? 'Original wording can only be changed through an attributed transcription correction.' : 'Enter the wording exactly as it appears in the source.'}
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="primary" loading={pending} disabled={!form.originalText.trim()} onClick={save}>
            {statement ? 'Save' : 'Record statement'}
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Original wording (verbatim)" required className="sm:col-span-2" hint={statement ? 'Locked — use “Correct transcription” to change it with a recorded reason.' : 'Do not paraphrase. Use the Interpretation field for meaning.'}>
          {(id) => <Textarea id={id} value={form.originalText} readOnly={!!statement} onChange={(e) => set('originalText', e.target.value)} rows={3} maxLength={4000} className="font-medium" />}
        </Field>
        <Field label="Locator type">
          {(id) => <Select id={id} value={form.locator.kind} onChange={(e) => set('locator', { ...form.locator, kind: e.target.value as Locator['kind'] })} options={LOCATOR_KINDS} />}
        </Field>
        <Field label="Page / slide / photo reference">
          {(id) => <Input id={id} value={form.locator.value} disabled={form.locator.kind === 'none'} onChange={(e) => set('locator', { ...form.locator, value: e.target.value })} maxLength={80} />}
        </Field>
        <Field label="Speaker or attribution">
          {(id) => <Input id={id} value={form.speaker} onChange={(e) => set('speaker', e.target.value)} maxLength={200} />}
        </Field>
        <Field label="Statement type" hint="Distinguish mandatory requirements from aspirations.">
          {(id) => <Select id={id} value={form.kind} onChange={(e) => set('kind', e.target.value as StatementKind)} options={optionsFrom(STATEMENT_KIND_LABELS)} />}
        </Field>
        <Field label="Criticality" hint="Explicit importance — repetition alone never raises it.">
          {(id) => <Select id={id} value={form.criticality} onChange={(e) => set('criticality', e.target.value as Criticality)} options={optionsFrom(CRITICALITY_LABELS)} />}
        </Field>
        <Field label="Confidence in this evidence">
          {(id) => <Select id={id} value={form.confidence} onChange={(e) => set('confidence', e.target.value as Confidence)} options={optionsFrom(CONFIDENCE_LABELS)} />}
        </Field>
        {!statement && (
          <>
            <Field label="Transcription status">
              {(id) => <Select id={id} value={form.transcriptionStatus} onChange={(e) => set('transcriptionStatus', e.target.value as TranscriptionStatus)} options={optionsFrom(TRANSCRIPTION_LABELS, ['not_applicable', 'unverified', 'uncertain'])} />}
            </Field>
            <Field label="Uncertain words" hint="Comma-separated words you could not read with confidence.">
              {(id) => <Input id={id} value={form.uncertainWords} onChange={(e) => set('uncertainWords', e.target.value)} />}
            </Field>
          </>
        )}
        <Field label="Interpretation (optional, kept separate)" className="sm:col-span-2" hint="Your reading of what the statement means. Never replaces the original wording.">
          {(id) => <Textarea id={id} value={form.interpretation} onChange={(e) => set('interpretation', e.target.value)} rows={2} />}
        </Field>
      </div>
    </Dialog>
  )
}

export function splitWords(s: string) {
  return s
    .split(',')
    .map((w) => w.trim())
    .filter(Boolean)
}

export function CorrectTranscriptionDialog({ open, onOpenChange, statement }: { open: boolean; onOpenChange: (o: boolean) => void; statement: Statement }) {
  const { run, pending } = useProject()
  const [text, setText] = useState(statement.originalText)
  const [uncertain, setUncertain] = useState(statement.uncertainWords.join(', '))
  const [note, setNote] = useState('')
  useEffect(() => {
    if (open) {
      setText(statement.originalText)
      setUncertain(statement.uncertainWords.join(', '))
      setNote('')
    }
  }, [open, statement])
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Correct transcription — ${statement.code}`}
      description="The previous wording is preserved in the revision history with your name and reason."
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="primary"
            loading={pending}
            disabled={!text.trim() || !note.trim()}
            onClick={async () => {
              const ok = await run({ type: 'statement.correctTranscription', id: statement.id, text, note, uncertainWords: splitWords(uncertain) }, 'Transcription corrected')
              if (ok !== undefined) onOpenChange(false)
            }}
          >
            Save correction
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="rounded-md bg-sunken px-3 py-2 text-[13px]">
          <span className="eyebrow mr-2">Current</span>“{statement.originalText}”
        </div>
        <Field label="Corrected transcription" required>
          {(id) => <Textarea id={id} value={text} onChange={(e) => setText(e.target.value)} rows={3} />}
        </Field>
        <Field label="Words still uncertain" hint="Comma-separated. Leave empty when every word is confirmed.">
          {(id) => <Input id={id} value={uncertain} onChange={(e) => setUncertain(e.target.value)} />}
        </Field>
        <Field label="Reason for correction" required>
          {(id) => <Input id={id} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Confirmed with workshop facilitator" maxLength={500} />}
        </Field>
      </div>
    </Dialog>
  )
}
