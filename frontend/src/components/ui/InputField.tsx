import { useState } from 'react'

interface InputFieldProps {
  /** Texto do label acima do campo */
  label: string
  /** Tipo do input (text, password, email) */
  type?: string
  /** Texto placeholder */
  placeholder: string
  /** Icone SVG renderizado a esquerda do campo */
  icon: React.ReactNode
  /** Elemento opcional a direita (ex: botao de mostrar senha) */
  rightElement?: React.ReactNode
  /** Elemento opcional ao lado direito do label (ex: "Esqueceu?") */
  labelRight?: React.ReactNode
}

/**
 * Campo de input estilizado com icone, estados de foco animados
 * e suporte a tema claro/escuro via CSS variables.
 *
 * @example
 * <InputField
 *   label="CPF"
 *   placeholder="000.000.000-00"
 *   icon={<CpfIcon />}
 * />
 */
export function InputField({
  label,
  type = 'text',
  placeholder,
  icon,
  rightElement,
  labelRight,
}: InputFieldProps) {
  const [focused, setFocused] = useState(false)

  return (
    <div>
      {/* Label + elemento opcional a direita */}
      <div className="flex items-center justify-between mb-2">
        <label className="text-[14px] font-medium" style={{ color: 'var(--text-primary)' }}>
          {label}
        </label>
        {labelRight}
      </div>

      {/* Container do input */}
      <div
        className={`login-input ${focused ? 'login-input--focused' : ''}`}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '1px',
          borderRadius: '8px',
          transition: 'all 0.2s ease',
        }}
      >
        {/* Icone */}
        <span className={`
          flex-shrink-0 login-input__icon
          ${focused ? 'login-input__icon--focused' : ''}
        `}>
          {icon}
        </span>

        {/* Campo de texto */}
        <input
          type={type}
          placeholder={placeholder}
          className="flex-1 bg-transparent outline-none text-[15px] min-w-0"
          style={{ color: 'var(--text-primary)' }}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />

        {/* Elemento a direita (ex: toggle de senha) */}
        {rightElement}
      </div>
    </div>
  )
}
