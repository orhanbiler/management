"use client"

import * as React from "react"
import * as SwitchPrimitives from "@radix-ui/react-switch"
import { cn } from "@/lib/utils"

interface AnimatedSwitchProps
  extends React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root> {
  variant?: "default" | "success" | "warning" | "danger"
}

const AnimatedSwitch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  AnimatedSwitchProps
>(({ className, variant = "default", ...props }, ref) => {
  const variantStyles = {
    default: {
      track: "data-[state=checked]:bg-primary",
      glow: "data-[state=checked]:shadow-[0_0_12px_rgba(var(--primary-rgb,212,160,60),0.5)]",
    },
    success: {
      track: "data-[state=checked]:bg-emerald-500",
      glow: "data-[state=checked]:shadow-[0_0_12px_rgba(16,185,129,0.5)]",
    },
    warning: {
      track: "data-[state=checked]:bg-amber-500",
      glow: "data-[state=checked]:shadow-[0_0_12px_rgba(245,158,11,0.5)]",
    },
    danger: {
      track: "data-[state=checked]:bg-red-500",
      glow: "data-[state=checked]:shadow-[0_0_12px_rgba(239,68,68,0.5)]",
    },
  }

  const styles = variantStyles[variant]

  return (
    <SwitchPrimitives.Root
      className={cn(
        // Base styles
        "peer inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full",
        "border-2 border-transparent transition-all duration-300 ease-out",
        // Unchecked state
        "bg-muted",
        // Focus styles
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        // Disabled styles
        "disabled:cursor-not-allowed disabled:opacity-50",
        // Checked state with glow
        styles.track,
        styles.glow,
        // Hover effect
        "hover:bg-muted/80 data-[state=checked]:hover:opacity-90",
        className
      )}
      {...props}
      ref={ref}
    >
      <SwitchPrimitives.Thumb
        className={cn(
          // Base thumb styles
          "pointer-events-none block h-5 w-5 rounded-full bg-background shadow-lg ring-0",
          // Animation
          "transition-all duration-300 ease-out",
          // Unchecked position
          "translate-x-0.5",
          // Checked position with scale bounce
          "data-[state=checked]:translate-x-[22px]",
          // Bounce effect on toggle
          "data-[state=checked]:scale-110",
          // Add inner shadow for depth
          "shadow-[0_2px_4px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.1)]",
          // Subtle rotation on toggle
          "data-[state=checked]:rotate-[360deg]"
        )}
      />
    </SwitchPrimitives.Root>
  )
})
AnimatedSwitch.displayName = "AnimatedSwitch"

// Fancy switch with icons inside
interface FancySwitchProps extends AnimatedSwitchProps {
  iconOn?: React.ReactNode
  iconOff?: React.ReactNode
}

const FancySwitch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  FancySwitchProps
>(({ className, variant = "default", iconOn, iconOff, ...props }, ref) => {
  const variantStyles = {
    default: {
      track: "data-[state=checked]:bg-primary",
      glow: "data-[state=checked]:shadow-[0_0_16px_rgba(var(--primary-rgb,212,160,60),0.4)]",
    },
    success: {
      track: "data-[state=checked]:bg-emerald-500",
      glow: "data-[state=checked]:shadow-[0_0_16px_rgba(16,185,129,0.4)]",
    },
    warning: {
      track: "data-[state=checked]:bg-amber-500",
      glow: "data-[state=checked]:shadow-[0_0_16px_rgba(245,158,11,0.4)]",
    },
    danger: {
      track: "data-[state=checked]:bg-rose-500",
      glow: "data-[state=checked]:shadow-[0_0_16px_rgba(244,63,94,0.4)]",
    },
  }

  const styles = variantStyles[variant]

  return (
    <SwitchPrimitives.Root
      className={cn(
        // Base styles - smaller size
        "group peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full",
        "border-2 border-transparent transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]",
        // Unchecked state
        "bg-muted/80",
        // Focus styles
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        // Disabled styles
        "disabled:cursor-not-allowed disabled:opacity-50",
        // Checked state with glow
        styles.track,
        styles.glow,
        // Hover effect - subtle scale
        "hover:scale-[1.02] active:scale-[0.98]",
        className
      )}
      {...props}
      ref={ref}
    >
      {/* Background icons - only show if provided */}
      {(iconOn || iconOff) && (
        <span className="absolute inset-0 flex items-center justify-between px-1 pointer-events-none">
          <span className="text-primary-foreground/50 transition-opacity duration-300 group-data-[state=unchecked]:opacity-0 group-data-[state=checked]:opacity-100 text-[8px]">
            {iconOn}
          </span>
          <span className="text-muted-foreground/50 transition-opacity duration-300 group-data-[state=checked]:opacity-0 group-data-[state=unchecked]:opacity-100 text-[8px]">
            {iconOff}
          </span>
        </span>
      )}
      
      <SwitchPrimitives.Thumb
        className={cn(
          // Base thumb styles - smaller
          "pointer-events-none block h-4 w-4 rounded-full bg-background",
          "shadow-[0_2px_6px_rgba(0,0,0,0.15)]",
          // Animation - spring physics feel
          "transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]",
          // Unchecked position
          "translate-x-0.5",
          // Checked position
          "data-[state=checked]:translate-x-[22px]",
          // Scale bounce on toggle
          "group-active:w-5",
          // Gradient overlay for shine effect
          "relative overflow-hidden",
          "before:absolute before:inset-0 before:rounded-full",
          "before:bg-gradient-to-b before:from-white/20 before:to-transparent"
        )}
      />
    </SwitchPrimitives.Root>
  )
})
FancySwitch.displayName = "FancySwitch"

// Liquid/Morphing switch
const LiquidSwitch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  AnimatedSwitchProps
>(({ className, variant = "default", ...props }, ref) => {
  const variantStyles = {
    default: "data-[state=checked]:bg-primary",
    success: "data-[state=checked]:bg-emerald-500",
    warning: "data-[state=checked]:bg-amber-500",
    danger: "data-[state=checked]:bg-rose-500",
  }

  return (
    <SwitchPrimitives.Root
      className={cn(
        // Base styles
        "group peer inline-flex h-8 w-14 shrink-0 cursor-pointer items-center rounded-full",
        "border-2 border-transparent",
        // Smooth color transition
        "transition-colors duration-500 ease-out",
        // Unchecked state
        "bg-muted",
        // Focus styles
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        // Disabled styles
        "disabled:cursor-not-allowed disabled:opacity-50",
        // Checked state
        variantStyles[variant],
        className
      )}
      {...props}
      ref={ref}
    >
      <SwitchPrimitives.Thumb
        className={cn(
          // Base thumb styles
          "pointer-events-none block h-6 w-6 rounded-full bg-background",
          "shadow-md",
          // Complex spring animation
          "transition-all duration-700 ease-[cubic-bezier(0.68,-0.6,0.32,1.6)]",
          // Position
          "translate-x-0.5 data-[state=checked]:translate-x-[26px]",
          // Squish effect during transition
          "group-active:scale-y-90 group-active:scale-x-110",
          // Wobble effect
          "data-[state=checked]:animate-[wobble_0.5s_ease-out]"
        )}
      />
    </SwitchPrimitives.Root>
  )
})
LiquidSwitch.displayName = "LiquidSwitch"

export { AnimatedSwitch, FancySwitch, LiquidSwitch }

