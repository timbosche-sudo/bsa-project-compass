import { FileSpreadsheet, FileText, Presentation, Scale, Table2 } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { useProject } from '@/app/project'
import { ExportButtons } from '@/components/ExportButtons'
import { useToast } from '@/components/Toast'
import { Badge, Button, Callout, Card, PageHeader, Select } from '@/components/ui'
import { reportReadiness } from '@/exporters/common'
import { deliverableModel } from '@/exporters/deliverables'
import { driverRegisterTable, traceabilityTable } from '@/exporters/tables'

export default function ReportsPage() {
  const { data, can } = useProject()
  const notify = useToast()
  const [busy, setBusy] = useState<string | null>(null)
  const [decisionId, setDecisionId] = useState(data.decisions[0]?.id ?? '')
  const readiness = reportReadiness(data)
  const t = data.project.terminology
  const model = deliverableModel(data)
  const [sessionId, setSessionId] = useState(data.workshops.find((w) => w.status === 'closed')?.id ?? data.workshops[0]?.id ?? '')
  const doc = async (which: 'vision' | 'synthesis', format: 'docx' | 'pdf') => {
    const [{ visionOutline, synthesisOutline }, { downloadOutline }] = await Promise.all([import('@/exporters/documents'), import('@/exporters/outline')])
    await downloadOutline(data, which === 'vision' ? visionOutline(data) : await synthesisOutline(data), format)
  }

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key)
    try {
      await fn()
      notify('ok', 'Export downloaded')
    } catch (e) {
      notify('error', `Export failed: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setBusy(null)
    }
  }

  if (!can('report.export')) return <Callout tone="warn">Your role cannot export reports.</Callout>

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports & Deliverables"
        description="Deliverables are built from recorded project content only — no fabricated charts, photography or metrics. Every document states whether the direction is a working draft or aligned with the Owner, and carries its provenance."
      />
      {data.project.isDemo && (
        <Callout tone="warn" title="Synthetic demonstration data">
          Every export from this project is watermarked as demonstrative and fictional.
        </Callout>
      )}
      <Callout tone={readiness.final ? 'ok' : 'info'} title={readiness.final ? 'Framework approved — reports will be titled as final' : 'Reports will be titled DRAFT'}>
        {readiness.issues.length > 0 && (
          <ul className="mt-1 list-disc pl-4">
            {readiness.issues.map((i) => (
              <li key={i}>{i}</li>
            ))}
          </ul>
        )}
        <p className="mt-1 text-[12px] text-muted">Final reports still require human review before distribution.</p>
      </Callout>
      <section aria-labelledby="deliverables" className="space-y-3">
        <h2 id="deliverables" className="text-[18px] font-black">
          Deliverables
        </h2>
        <p className="text-[13px] text-muted">{model.status.label}.</p>
        <div className="grid gap-4 lg:grid-cols-2">
          <ExportCard
            icon={<Presentation className="size-5" />}
            letter="1"
            title="Owner Alignment Presentation"
            format="PPTX · editable"
            description="The four-chapter story: What We Heard, What We Believe, What Will Guide Us, What Success Could Look Like, and questions for discussion. Native, editable text and shapes; evidence is in the speaker notes. Only reviewed items marked for the presentation are included."
          >
            <Button variant="primary" loading={busy === 'owner'} onClick={() => run('owner', async () => (await import('@/exporters/ownerDeck')).ownerDeck(data))}>
              Download PPTX
            </Button>
          </ExportCard>
          <ExportCard
            icon={<FileText className="size-5" />}
            letter="2"
            title={`${t.winTheme} and Principles Document`}
            format="DOCX · PDF"
            description={`The team’s reference for design: ${t.winTheme.toLowerCase()}, point of view, each principle with why it matters, design implications, opportunities, possible outcomes and key evidence.`}
          >
            <div className="flex flex-wrap gap-2">
              <Button variant="primary" loading={busy === 'vp-docx'} onClick={() => run('vp-docx', () => doc('vision', 'docx'))}>
                Download Word
              </Button>
              <Button loading={busy === 'vp-pdf'} onClick={() => run('vp-pdf', () => doc('vision', 'pdf'))}>
                Download PDF
              </Button>
            </div>
          </ExportCard>
          <ExportCard
            icon={<FileText className="size-5" />}
            letter="3"
            title="Internal Synthesis Report"
            format="PDF · DOCX · BSA only"
            description="For BSA’s internal use: key themes, the complete What We Heard, strategic tensions, interpretations, the recommended direction, alternatives considered, unresolved questions and alignment history."
          >
            <div className="flex flex-wrap gap-2">
              <Button variant="primary" loading={busy === 'syn-pdf'} onClick={() => run('syn-pdf', () => doc('synthesis', 'pdf'))}>
                Download PDF
              </Button>
              <Button loading={busy === 'syn-docx'} onClick={() => run('syn-docx', () => doc('synthesis', 'docx'))}>
                Download Word
              </Button>
            </div>
          </ExportCard>
          <ExportCard
            icon={<FileText className="size-5" />}
            letter="4"
            title="Workshop Summary"
            format="DOCX · PDF"
            description="A concise, editable summary of an alignment session: the direction, Owner responses and refinements, items not yet reviewed, remaining questions, opportunities and outcomes to validate."
          >
            {data.workshops.length ? (
              <div className="flex flex-wrap gap-2">
                <Select
                  aria-label="Workshop session"
                  className="w-auto max-w-[260px]"
                  value={sessionId}
                  onChange={(e) => setSessionId(e.target.value)}
                  options={data.workshops.map((w) => ({ value: w.id, label: `${w.code} ${w.title.slice(0, 40)}` }))}
                />
                <Button variant="primary" loading={busy === 'sum-docx'} onClick={() => run('sum-docx', async () => (await import('@/exporters/workshopPdf')).meetingSummaryDocx(data, sessionId))}>
                  Word
                </Button>
                <Button loading={busy === 'sum-pdf'} onClick={() => run('sum-pdf', async () => (await import('@/exporters/workshopPdf')).meetingSummaryPdf(data, sessionId))}>
                  PDF
                </Button>
              </div>
            ) : (
              <p className="text-[13px] text-muted">No workshop sessions yet.</p>
            )}
          </ExportCard>
        </div>
      </section>
      <section aria-labelledby="records" className="space-y-3">
        <h2 id="records" className="text-[18px] font-black">
          Records and data exports
        </h2>
        <div className="grid gap-4 lg:grid-cols-2">
          <ExportCard
            icon={<FileText className="size-5" />}
            letter="A"
            title="Project Alignment Report"
            format="PDF"
            description={`Project identity, executive narrative, ${t.winTheme}, ${t.guidingPrinciple}s, ${t.designDriver}s, evidence traceability, open questions, approval status, risks and opportunities.`}
          >
            <Button variant="primary" loading={busy === 'pdf'} onClick={() => run('pdf', async () => (await import('@/exporters/pdf')).alignmentReportPdf(data))}>
              Download PDF
            </Button>
          </ExportCard>
          <ExportCard
            icon={<Presentation className="size-5" />}
            letter="B"
            title={`${t.designDriver} Briefing`}
            format="PPTX"
            description={`For teams using the formal register: institutional context, ${t.winTheme.toLowerCase()}, principles, priority ${t.designDriver.toLowerCase()}s, measures, outstanding decisions and next steps.`}
          >
            <Button variant="primary" loading={busy === 'pptx'} onClick={() => run('pptx', async () => (await import('@/exporters/pptx')).alignmentDeck(data))}>
              Download PPTX
            </Button>
          </ExportCard>
          <ExportCard
            icon={<FileSpreadsheet className="size-5" />}
            letter="C"
            title={`${t.designDriver} Register`}
            format="CSV · XLSX"
            description="Every driver with targets, baselines, observed values, accountability, verification and completeness. Unknown values are written as unknown."
          >
            <ExportButtons build={() => driverRegisterTable(data)} kind="design-driver-register" sheet="Design Drivers" />
          </ExportCard>
          <ExportCard
            icon={<Table2 className="size-5" />}
            letter="D"
            title="Traceability Matrix"
            format="CSV · XLSX"
            description="Each statement traced through themes, principles, drivers and decisions, with derived links labelled."
          >
            <ExportButtons build={() => traceabilityTable(data)} kind="traceability-matrix" sheet="Traceability" />
          </ExportCard>
          <ExportCard
            icon={<Scale className="size-5" />}
            letter="E"
            title="Decision Record"
            format="PDF"
            description="Alternatives, mandatory requirements, Choosing by Advantages evaluation, cost, recommendation, approval and history."
          >
            {data.decisions.length ? (
              <div className="flex flex-wrap gap-2">
                <Select
                  aria-label="Decision"
                  className="w-auto max-w-[280px]"
                  value={decisionId}
                  onChange={(e) => setDecisionId(e.target.value)}
                  options={data.decisions.map((d) => ({ value: d.id, label: `${d.code} ${d.question.slice(0, 50)}` }))}
                />
                <Button
                  variant="primary"
                  loading={busy === 'dec'}
                  onClick={() =>
                    run('dec', async () => {
                      const dec = data.decisions.find((d) => d.id === decisionId)
                      if (dec) await (await import('@/exporters/pdf')).decisionRecordPdf(data, dec)
                    })
                  }
                >
                  Download PDF
                </Button>
              </div>
            ) : (
              <p className="text-[13px] text-muted">No decisions recorded.</p>
            )}
          </ExportCard>
        </div>
      </section>
    </div>
  )
}

function ExportCard({ icon, letter, title, format, description, children }: { icon: ReactNode; letter: string; title: string; format: string; description: string; children: ReactNode }) {
  return (
    <Card className="flex flex-col p-5">
      <div className="flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-accent-soft text-accent-strong">{icon}</div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[11px] text-muted">{letter}</span>
            <h2 className="text-[15px] font-semibold">{title}</h2>
            <Badge tone="outline">{format}</Badge>
          </div>
          <p className="mt-1 text-[13px] text-muted">{description}</p>
        </div>
      </div>
      <div className="mt-4 flex-1" />
      <div>{children}</div>
    </Card>
  )
}
