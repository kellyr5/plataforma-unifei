import { useState } from 'react'

interface InputFieldProps {
  label: string
  type?: string
  placeholder: string
  icon: React.ReactNode
  rightElement?: React.ReactNode
  labelRight?: React.ReactNode
  value?: string
  onChange?: (value: string) => void
}

export function InputField({
  label, type = 'text', placeholder, icon,
  rightElement, labelRight, value, onChange,
}: InputFieldProps) {
  const [focused, setFocused] = useState(false)

  return (
    <div>
      <div className="flex items-center justify-between" style={{ marginBottom: '8px' }}>
        <label className="font-medium" style={{ fontSize: '13px', color: 'var(--text-primary)' }}>
          {label}
        </label>
        {labelRight}
      </div>

      <div
        className={`login-input ${focused ? 'login-input--focused' : ''}`}
        style={{
          display: 'flex', alignItems: 'center', gap: '12px',
          padding: '4px 12px', borderRadius: '12px',
          transition: 'all 0.2s ease',
        }}
      >
        <span className={`flex-shrink-0 login-input__icon ${focused ? 'login-input__icon--focused' : ''}`}>
          {icon}
        </span>

        <input
          type={type}
          placeholder={placeholder}
          value={value}
          onChange={onChange ? (e) => onChange(e.target.value) : undefined}
          className="flex-1 bg-transparent outline-none min-w-0"
          style={{ fontSize: '14px', color: 'var(--text-primary)' }}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />

        {rightElement}
      </div>
    </div>
  )
}
