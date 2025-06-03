import * as React from 'react'
import * as SwitchPrimitives from '@radix-ui/react-switch'

import { cn } from '@/lib/utils'

const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitives.Root
    className={cn(
      'peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-[#00ffcc] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00ffcc] focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-gradient-to-r data-[state=checked]:from-[#003d33] data-[state=checked]:to-[#002622] data-[state=checked]:border-[#00ffcc] data-[state=checked]:shadow-[0_0_10px_rgba(0,255,204,0.6)] data-[state=unchecked]:bg-gradient-to-r data-[state=unchecked]:from-[#2a2a2a] data-[state=unchecked]:to-[#1a1a1a] data-[state=unchecked]:border-[#00ffcc] data-[state=unchecked]:shadow-[0_0_6px_rgba(0,255,204,0.3)] hover:shadow-[0_0_10px_rgba(0,255,204,0.4)] transition-all duration-200',
      className
    )}
    {...props}
    ref={ref}
  >
    <SwitchPrimitives.Thumb
      className={cn(
        'pointer-events-none block h-5 w-5 rounded-full shadow-lg ring-0 transition-transform data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0 data-[state=checked]:bg-[#00ffcc] data-[state=checked]:shadow-[0_0_8px_rgba(0,255,204,0.8)] data-[state=unchecked]:bg-[#999] data-[state=unchecked]:shadow-[0_0_4px_rgba(153,153,153,0.5)]'
      )}
    />
  </SwitchPrimitives.Root>
))
Switch.displayName = SwitchPrimitives.Root.displayName

export { Switch }
