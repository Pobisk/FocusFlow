import { cn } from '@/lib/utils'
import type { Sphere } from '@/lib/api'

interface SphereFilterProps {
  spheres: Sphere[]
  selected: string | null
  onSelect: (code: string | null) => void
}

/**
 * Переиспользуемый компонент фильтра по сферам.
 * Отображает кнопки: "Все" + коды сфер.
 */
export function SphereFilter({ spheres, selected, onSelect }: SphereFilterProps) {
  return (
    <div className="flex flex-wrap gap-2">
      <button
        onClick={() => onSelect(null)}
        className={cn(
          'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border',
          selected === null
            ? 'bg-primary text-primary-foreground border-primary'
            : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50',
        )}
      >
        Все
      </button>
      {spheres.map((sphere) => (
        <button
          key={sphere.id}
          onClick={() => onSelect(sphere.code)}
          className={cn(
            'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border',
            selected === sphere.code
              ? 'bg-primary text-primary-foreground border-primary'
              : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50',
          )}
        >
          {sphere.code}
        </button>
      ))}
    </div>
  )
}
