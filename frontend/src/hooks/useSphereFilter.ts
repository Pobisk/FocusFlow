import { useState, useCallback } from 'react'

/**
 * Хук для управления фильтром по сферам.
 * Возвращает выбранный sphere_id (null = все) и функции управления.
 */
export function useSphereFilter() {
  const [selectedSphereId, setSelectedSphereId] = useState<string | null>(null)

  const toggleSphere = useCallback((sphereId: string) => {
    setSelectedSphereId((prev) => (prev === sphereId ? null : sphereId))
  }, [])

  const resetSphere = useCallback(() => {
    setSelectedSphereId(null)
  }, [])

  return {
    selectedSphereId,
    setSelectedSphereId,
    toggleSphere,
    resetSphere,
  }
}
