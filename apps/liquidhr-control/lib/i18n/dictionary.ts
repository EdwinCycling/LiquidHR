import dictionary from '@/messages/nl/control.json'

export type ControlDictionary = typeof dictionary

export function getDictionary(): ControlDictionary {
  return dictionary
}
