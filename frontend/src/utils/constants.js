export const TASK_STATUSES = [
  { value: 'To Do', label: 'To Do', color: 'bg-gray-100 text-gray-700' },
  { value: 'In Progress', label: 'In Progress', color: 'bg-blue-100 text-blue-700' },
  { value: 'Done', label: 'Done', color: 'bg-green-100 text-green-700' },
  { value: 'Blocked', label: 'Blocked', color: 'bg-red-100 text-red-700' },
]

export const TASK_PRIORITIES = [
  { value: 'Low', label: 'Low', color: 'bg-slate-100 text-slate-700' },
  { value: 'Medium', label: 'Medium', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'High', label: 'High', color: 'bg-orange-100 text-orange-800' },
  { value: 'Critical', label: 'Critical', color: 'bg-red-100 text-red-800' },
]

export const getStatusColor = (status) =>
  TASK_STATUSES.find((s) => s.value === status)?.color || 'bg-gray-100 text-gray-700'

export const getPriorityColor = (priority) =>
  TASK_PRIORITIES.find((p) => p.value === priority)?.color || 'bg-gray-100 text-gray-700'
