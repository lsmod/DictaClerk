import * as React from 'react'
import * as CheckboxPrimitive from '@radix-ui/react-checkbox'
import { Check } from 'lucide-react'

import { cn } from '@/lib/utils'

const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, ...props }, ref) => (
  <CheckboxPrimitive.Root
    ref={ref}
    className={cn(
      'peer h-4 w-4 shrink-0 rounded-sm border-2 border-[#00ffcc] bg-gradient-to-br from-[#2a2a2a] to-[#1a1a1a] ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00ffcc] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-gradient-to-br data-[state=checked]:from-[#003d33] data-[state=checked]:to-[#002622] data-[state=checked]:text-[#00ffcc] data-[state=checked]:border-[#00ffcc] data-[state=checked]:shadow-[0_0_8px_rgba(0,255,204,0.6)] transition-all duration-200 hover:shadow-[0_0_8px_rgba(0,255,204,0.3)] data-[state=unchecked]:border-[#00ffcc] data-[state=unchecked]:shadow-[0_0_4px_rgba(0,255,204,0.2)]',
      className
    )}
    {...props}
  >
    <CheckboxPrimitive.Indicator
      className={cn('flex items-center justify-center text-current')}
    >
      <Check className="h-3 w-3" />
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
))
Checkbox.displayName = CheckboxPrimitive.Root.displayName

export { Checkbox }
