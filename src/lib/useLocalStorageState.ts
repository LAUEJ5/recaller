import type { Dispatch, SetStateAction } from 'react'
import { useEffect, useState } from 'react'

export function useLocalStorageState<T>(
  key: string,
  initialValue: T,
): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key)
      if (raw == null) return initialValue
      return JSON.parse(raw) as T
    } catch {
      return initialValue
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value))
    } catch {
      // ignore quota / privacy mode
    }
  }, [key, value])

  return [value, setValue]
}

