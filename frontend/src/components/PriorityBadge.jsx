import { getPriorityColor } from '../utils/constants'

export default function PriorityBadge({ priority }) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getPriorityColor(priority)}`}
    >
      {priority}
    </span>
  )
}
