import { MATERIAL_KINDS, type MaterialKind } from './Scene'

interface MaterialPickerProps {
  value: MaterialKind
  onChange: (value: MaterialKind) => void
}

const MaterialPicker = ({ value, onChange }: MaterialPickerProps) => (
  <div className="fixed top-4 right-4 z-20 rounded-xl border border-white/10 bg-black/80 p-2 shadow-xl backdrop-blur-xl">
    <label className="flex items-center gap-2 text-[11px] text-gray-400">
      <span>Material</span>
      <select
        value={value}
        onChange={e => onChange(e.target.value as MaterialKind)}
        className="rounded border border-white/10 bg-black/40 px-2 py-1 font-mono text-[11px] text-gray-100 focus:border-blue-400 focus:outline-none"
      >
        {MATERIAL_KINDS.map(k => (
          <option key={k.value} value={k.value}>
            {k.label}
          </option>
        ))}
      </select>
    </label>
  </div>
)

export default MaterialPicker
