import { Sidebar } from "@/components/basic/SideBar"

export const baseClasses = 'inline-flex items-center justify-center font-medium rounded transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed'
export const variantClasses = {
  primary: 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-cyan-500',
  secondary: 'bg-gray-200 text-gray-800 hover:bg-gray-300 focus:ring-gray-400',
  outline: 'border border-gray-300 bg-transparent text-gray-700 hover:bg-gray-100 focus:ring-gray-400',
  danger: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500',
  Navbar:'inline-flex items-center justify-center px-3 py-2 bg-transparent hover:bg-gray-100 hover:border-x hover:border-gray-300 transition-colors duration-200 text-gray-700 hover:text-gray-900 font-medium',
  Sidebar:"block px-3 py-2 rounded-md text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900"
}
export const sizeClasses = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-base',
  lg: 'px-6 py-3 text-lg',
}
export type ButtonVariant = keyof typeof variantClasses
export type ButtonSize = keyof typeof sizeClasses