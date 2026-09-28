import { useEditor } from './editor'

/** الهدف المبدئي عند فتح نافذة محو العناصر: scene | product | img:<id> */
export const retouchIntent = { target: 'scene' }

export function openRetouch(target = 'scene') {
  retouchIntent.target = target
  useEditor.setState({ dialog: 'retouch' })
}
