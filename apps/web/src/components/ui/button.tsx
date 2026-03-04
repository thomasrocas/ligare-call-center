import React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '../../lib-utils'

const buttonVariants = cva('inline-flex items-center justify-center rounded-md text-sm font-medium px-4 py-2 transition-colors', {
  variants: {
    variant: {
      default: 'bg-black text-white hover:bg-zinc-800',
      secondary: 'bg-zinc-100 text-zinc-900 hover:bg-zinc-200'
    }
  },
  defaultVariants: { variant: 'default' }
})

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {}

export function Button({ className, variant, ...props }: ButtonProps) {
  return <button className={cn(buttonVariants({ variant }), className)} {...props} />
}
