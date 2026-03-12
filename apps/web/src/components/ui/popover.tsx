"use client"

import * as React from "react"
import { mergeProps } from "@base-ui-components/react/merge-props"
import { Popover as PopoverPrimitive } from "@base-ui-components/react/popover"

import { cn } from "#/lib/utils"

const Popover = PopoverPrimitive.Root

type PopoverTriggerProps = PopoverPrimitive.Trigger.Props & {
  asChild?: boolean
  children?: React.ReactNode
}

function PopoverTrigger({
  asChild,
  children,
  ...props
}: PopoverTriggerProps) {
  if (asChild) {
    if (!React.isValidElement(children)) {
      if (process.env.NODE_ENV !== "production") {
        console.warn(
          "[loveui] PopoverTrigger with `asChild` expects a single React element child."
        )
      }
      return null
    }

    const child = children as React.ReactElement

    return (
      <PopoverPrimitive.Trigger
        {...props}
        render={(triggerProps) => {
          const { ref: triggerRef, ...restTriggerProps } = triggerProps
          const { asChild: _childAsChild, ...restChildProps } =
            (child.props ?? {}) as Record<string, unknown>

          const childRef = (child as any).ref as
            | React.Ref<HTMLElement>
            | null
            | undefined

          const mergedProps = mergeProps(restTriggerProps, restChildProps)

          if (!mergedProps["data-slot"]) {
            mergedProps["data-slot"] = "popover-trigger"
          }

          mergedProps.ref = composeRefs(
            triggerRef as React.Ref<HTMLElement>,
            childRef ?? undefined
          )

          return React.cloneElement(child, mergedProps)
        }}
      />
    )
  }

  return <PopoverPrimitive.Trigger data-slot="popover-trigger" {...props} />
}

function PopoverPopup({
  children,
  className,
  side = "bottom",
  align = "center",
  sideOffset = 4,
  ...props
}: PopoverPrimitive.Popup.Props & {
  side?: PopoverPrimitive.Positioner.Props["side"]
  align?: PopoverPrimitive.Positioner.Props["align"]
  sideOffset?: PopoverPrimitive.Positioner.Props["sideOffset"]
}) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Positioner
        data-slot="popover-positioner"
        className="z-50"
        side={side}
        sideOffset={sideOffset}
        align={align}
      >
        <span className="relative flex origin-(--transform-origin) rounded-lg border bg-popover bg-clip-padding shadow-lg transition-[scale,opacity] before:pointer-events-none before:absolute before:inset-0 before:rounded-[calc(var(--radius-lg)-1px)] before:shadow-[0_1px_--theme(--color-black/4%)] has-data-starting-style:scale-98 has-data-starting-style:opacity-0 dark:bg-clip-border dark:before:shadow-[0_-1px_--theme(--color-white/8%)]">
          <PopoverPrimitive.Popup
            data-slot="popover-content"
            className={cn(
              "max-h-(--available-height) min-w-80 overflow-y-auto p-4",
              className
            )}
            {...props}
          >
            {children}
          </PopoverPrimitive.Popup>
        </span>
      </PopoverPrimitive.Positioner>
    </PopoverPrimitive.Portal>
  )
}

function PopoverClose({ ...props }: PopoverPrimitive.Close.Props) {
  return <PopoverPrimitive.Close data-slot="popover-close" {...props} />
}

function PopoverTitle({ className, ...props }: PopoverPrimitive.Title.Props) {
  return (
    <PopoverPrimitive.Title
      data-slot="popover-title"
      className={cn("text-lg leading-none font-semibold", className)}
      {...props}
    />
  )
}

function PopoverDescription({
  className,
  ...props
}: PopoverPrimitive.Description.Props) {
  return (
    <PopoverPrimitive.Description
      data-slot="popover-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

export {
  Popover,
  PopoverTrigger,
  PopoverPopup,
  PopoverPopup as PopoverContent,
  PopoverTitle,
  PopoverDescription,
  PopoverClose,
}

function composeRefs<T>(
  ...refs: Array<React.Ref<T> | undefined>
): (instance: T | null) => void {
  return (instance) => {
    for (const ref of refs) {
      if (!ref) continue
      if (typeof ref === "function") {
        ref(instance)
      } else {
        try {
          ;(ref as React.MutableRefObject<T | null>).current = instance
        } catch {
          // ignore assignment errors for immutable refs
        }
      }
    }
  }
}
