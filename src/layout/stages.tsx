import { useProject } from '@/app/project'
import { StageLayout } from './StageLayout'

export function UnderstandStage() {
  return (
    <StageLayout
      stage={{
        number: '01',
        name: 'Understand',
        purpose: 'Listen carefully. Gather what the Owner and stakeholders said, find the recurring themes and tensions, and synthesize What We Heard.',
        steps: [
          { to: 'understand/evidence', label: 'Evidence', hint: 'Sources and verbatim statements' },
          { to: 'understand/themes', label: 'Themes' },
          { to: 'understand/questions', label: 'Critical Questions' },
          { to: 'understand/heard', label: 'What We Heard' },
        ],
        tasks: ['critical_questions', 'suggest_themes', 'suggest_relationships', 'find_missing_requirements'],
        modelOnly: ['Draft a What We Heard narrative from selected evidence', 'Summarize a long transcript into candidate statements', 'Detect sentiment and emphasis across interviews'],
      }}
    />
  )
}

export function InterpretStage() {
  const { data } = useProject()
  const t = data.project.terminology
  return (
    <StageLayout
      stage={{
        number: '02',
        name: 'Interpret',
        purpose: `Form a point of view. Shape the ${t.winTheme.toLowerCase()} and ${t.guidingPrinciple.toLowerCase()}s, and explore the design opportunities and outcomes they suggest.`,
        steps: [
          { to: 'interpret/point-of-view', label: 'Point of View' },
          { to: 'interpret/vision', label: t.winTheme },
          { to: 'interpret/principles', label: `${t.guidingPrinciple}s` },
          { to: 'interpret/opportunities', label: 'Design Opportunities' },
          { to: 'interpret/success', label: 'What Success Could Look Like' },
        ],
        tasks: ['principle_quality', 'critical_questions', 'validation_questions'],
        modelOnly: ['Propose alternative point-of-view directions', `Suggest ${t.winTheme.toLowerCase()} wording from the evidence`, 'Draft “why it matters” from linked statements'],
      }}
    />
  )
}

export function MoreStage() {
  return (
    <StageLayout
      stage={{
        name: 'More tools',
        purpose: 'Deeper views for teams that want them. Nothing here is required to reach alignment.',
        steps: [
          { to: 'more/from-vision-to-design', label: 'From Vision to Design' },
          { to: 'more/evidence-map', label: 'Evidence Map' },
        ],
      }}
    />
  )
}
