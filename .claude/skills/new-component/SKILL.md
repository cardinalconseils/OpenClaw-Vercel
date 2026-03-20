---
name: new-component
description: Scaffold a new React component following project shadcn/CVA conventions with cn() utility, data-slot attributes, and Tailwind CSS 4
---

# New Component Scaffold

Create React components matching the project's shadcn/ui v4 conventions.

## Conventions (from existing codebase)

1. **Function declarations** — not arrow functions, not `forwardRef`
2. **`cn()` utility** — import from `@/lib/utils` for class merging
3. **`data-slot` attributes** — every component root gets `data-slot="component-name"` for CSS targeting
4. **Props pattern** — extend `React.ComponentProps<"element">` with `&` for custom props
5. **Spread remaining props** — always pass `{...props}` to the root element
6. **Named exports** — export all sub-components at the bottom of the file
7. **No default exports** — matches shadcn convention
8. **File location** — UI primitives in `src/components/ui/`, feature components in `src/components/<feature>/`
9. **Tailwind CSS 4** — use modern Tailwind syntax, utility-first
10. **Variants** — use `class-variance-authority` (cva) for multi-variant components

## Template: UI Primitive

```tsx
import * as React from "react"

import { cn } from "@/lib/utils"

function ComponentName({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="component-name"
      className={cn(
        "base-classes-here",
        className
      )}
      {...props}
    />
  )
}

export { ComponentName }
```

## Template: Component with Variants (CVA)

```tsx
import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const componentVariants = cva(
  "base-classes-here",
  {
    variants: {
      variant: {
        default: "variant-default-classes",
        secondary: "variant-secondary-classes",
      },
      size: {
        default: "size-default-classes",
        sm: "size-sm-classes",
        lg: "size-lg-classes",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function ComponentName({
  className,
  variant,
  size,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof componentVariants>) {
  return (
    <div
      data-slot="component-name"
      className={cn(componentVariants({ variant, size }), className)}
      {...props}
    />
  )
}

export { ComponentName, componentVariants }
```

## Template: Compound Component (e.g., Card-like)

```tsx
import * as React from "react"

import { cn } from "@/lib/utils"

function Parent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="parent"
      className={cn("parent-classes", className)}
      {...props}
    />
  )
}

function Child({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="parent-child"
      className={cn("child-classes", className)}
      {...props}
    />
  )
}

export { Parent, Child }
```

## Checklist

- [ ] Uses `cn()` from `@/lib/utils`
- [ ] Has `data-slot` attribute on root element
- [ ] Extends `React.ComponentProps<>` for props
- [ ] Spreads `{...props}` on root element
- [ ] Named exports (no default export)
- [ ] File is kebab-case.tsx
- [ ] Placed in correct directory (`ui/` vs feature folder)
