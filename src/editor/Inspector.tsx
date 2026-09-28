import { Layers, Palette, SlidersHorizontal } from 'lucide-react'
import { TabBar } from '../ui/kit'
import { useEditor, type InspectorTab } from '../store/editor'
import { ElementsTab } from './tabs/ElementsTab'
import { DesignTab } from './tabs/DesignTab'
import { PropsTab } from './tabs/PropsTab'

export function Inspector() {
  const tab = useEditor((s) => s.tab)
  const hasSel = useEditor((s) => !!s.selection)
  return (
    <aside className="inspector">
      <TabBar<InspectorTab>
        value={tab}
        tabs={[
          { value: 'elements', label: 'العناصر', icon: <Layers size={17} /> },
          { value: 'design', label: 'التصميم', icon: <Palette size={17} /> },
          { value: 'props', label: hasSel ? 'الخصائص ●' : 'الخصائص', icon: <SlidersHorizontal size={17} /> },
        ]}
        onChange={(v) => useEditor.setState({ tab: v })}
      />
      <div className="insp-scroll" key={tab}>
        {tab === 'elements' && <ElementsTab />}
        {tab === 'design' && <DesignTab />}
        {tab === 'props' && <PropsTab />}
      </div>
    </aside>
  )
}
