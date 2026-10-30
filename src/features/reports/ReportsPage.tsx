import { FileSpreadsheet, FileText, Presentation, Scale, Table2 } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { useProject } from '@/app/project'
import { ExportButtons } from '@/components/ExportButtons'
import { useToast } from '@/components/Toast'
import { Badge, Button, Callout, Card, PageHeader, Select } from '@/components/ui'
import { reportReadiness } from '@/exporters/common'
import { driverRegisterTable, traceabilityTable } from '@/exporters/tables'

export default function ReportsPage() {
  const { data, can } = useProject()
  const notify = useToast()
  const [busy, setBusy] = useState<string | null>(null)
  const [decisionId, setDecisionId] = useState(data.decisions[0]?.id ?? '')
  const readiness = reportReadiness(data)
  const t = data.project.terminology

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
        eyebrow="Communicate"
        title="Reports & Exports"
        description="Exports contain recorded project content only: no fabricated charts, photography or metrics. Approved material is distinguished from drafts in every document, and each export carries its provenance."
      />
      {data.project.isDemo && <Callout tone="warn" title="Synthetic demonstration data">Every export from this project is watermarked as demonstrative and fictional.</Callout>}
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
      <div className="grid gap-4 lg:grid-cols-2">
        <ExportCard icon={<FileText className="size-5" />} letter="A" title="Project Alignment Report" format="PDF" description={`Project identity, executive narrative, ${t.winTheme}, ${t.guidingPrinciple}s, ${t.designDriver}s, evidence traceability, open questions, approval status, risks and opportunities.`}>
          <Button variant="primary" loading={busy === 'pdf'} onClick={() => run('pdf', async () => (await import('@/exporters/pdf')).alignmentReportPdf(data))}>
            Download PDF
          </Button>
        </ExportCard>
        <ExportCard icon={<Presentation className="size-5" />} letter="B" title="Project Alignment Presentation" format="PPTX" description="Title, institutional context, ambition, Win Theme, principles, priority drivers, measures of success, outstanding decisions and next steps.">
          <Button variant="primary" loading={busy === 'pptx'} onClick={() => run('pptx', async () => (await import('@/exporters/pptx')).alignmentDeck(data))}>
            Download PPTX
          </Button>
        </ExportCard>
        <ExportCard icon={<FileSpreadsheet className="size-5" />} letter="C" title={`${t.designDriver} Register`} format="CSV · XLSX" description="Every driver with targets, baselines, observed values, accountability, verification and completeness. Unknown values are written as unknown.">
          <ExportButtons build={() => driverRegisterTable(data)} kind="design-driver-register" sheet="Design Drivers" />
        </ExportCard>
        <ExportCard icon={<Table2 className="size-5" />} letter="D" title="Traceability Matrix" format="CSV · XLSX" description="Each statement traced through themes, principles, drivers and decisions, with derived links labelled.">
          <ExportButtons build={() => traceabilityTable(data)} kind="traceability-matrix" sheet="Traceability" />
        </ExportCard>
        <ExportCard icon={<Scale className="size-5" />} letter="E" title="Decision Record" format="PDF" description="Alternatives, mandatory requirements, Choosing by Advantages evaluation, cost, recommendation, approval and history.">
          {data.decisions.length ? (
            <div className="flex flex-wrap gap-2">
              <Select aria-label="Decision" className="w-auto max-w-[280px]" value={decisionId} onChange={(e) => setDecisionId(e.target.value)} options={data.decisions.map((d) => ({ value: d.id, label: `${d.code} ${d.question.slice(0, 50)}` }))} />
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
