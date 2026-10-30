import { Download } from 'lucide-react'
import { useState } from 'react'
import { useProject } from '@/app/project'
import { downloadBlob, exportFilename, provenanceLines, type Table } from '@/exporters/common'
import { toCsv } from '@/exporters/csv'
import { useToast } from './Toast'
import { Button } from './ui'

export function ExportButtons({ build, kind, sheet }: { build: () => Table; kind: string; sheet: string }) {
  const { data, can } = useProject()
  const notify = useToast()
  const [busy, setBusy] = useState<'csv' | 'xlsx' | null>(null)
  if (!can('report.export')) return null
  const run = async (fmt: 'csv' | 'xlsx') => {
    setBusy(fmt)
    try {
      const table = build()
      const prov = provenanceLines(data)
      const blob = fmt === 'csv' ? new Blob([toCsv(table, prov)], { type: 'text/csv;charset=utf-8' }) : await (await import('@/exporters/xlsx')).toXlsx(table, sheet, prov)
      const name = exportFilename(data, kind, fmt)
      downloadBlob(blob, name)
      notify('ok', `Exported ${name}`)
    } catch (e) {
      notify('error', `Export failed: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setBusy(null)
    }
  }
  return (
    <div className="flex gap-1.5">
      <Button size="sm" icon={<Download className="size-3.5" />} loading={busy === 'csv'} onClick={() => run('csv')}>
        CSV
      </Button>
      <Button size="sm" icon={<Download className="size-3.5" />} loading={busy === 'xlsx'} onClick={() => run('xlsx')}>
        XLSX
      </Button>
    </div>
  )
}
