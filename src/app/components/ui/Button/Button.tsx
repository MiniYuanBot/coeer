import React from 'react'
import { Icon } from '../Icon'
import { baseClasses, variantClasses, sizeClasses, ButtonVariant, ButtonSize } from './ButtonStyles'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize                     
  loading?: boolean                           
  children: React.ReactNode
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  children,
  className = '',
  disabled,
  ...props
}: ButtonProps) {
  const combinedClassName = `${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`

  return (
    <button
      className={combinedClassName}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <span className="flex items-center">
          <Icon name="loading" className="animate-spin -ml-1 mr-2 h-4 w-4 text-current" />
          Loading
        </span>
      ) : children}
    </button>
  )
}