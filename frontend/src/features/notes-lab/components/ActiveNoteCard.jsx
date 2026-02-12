import { Card, RenderHighlighted, SectionTitle } from './ui'

export default function ActiveNoteCard({ selectedNote, highlightedText }) {
  return (
    <Card className="notes-active-note-card">
      <SectionTitle
        title={`Active Note: ${selectedNote.note_id}`}
        sub="Highlighted spans show extracted evidence for fields like targets, performance, and plan."
      />
      <div className="notes-active-note-body">
        <RenderHighlighted text={highlightedText} />
      </div>
    </Card>
  )
}
