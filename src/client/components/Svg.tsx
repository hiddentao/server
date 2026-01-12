import type { SVGProps } from "react"
import { cn } from "../utils/cn"

export interface SvgProps extends SVGProps<SVGSVGElement> {
  size?: number | string
  className?: string
}

/**
 * Base SVG wrapper component with consistent styling and sizing
 */
export function Svg({
  size = 24,
  className,
  viewBox = "0 0 24 24",
  fill = "currentColor",
  ...props
}: SvgProps) {
  const sizeStyles =
    typeof size === "number"
      ? { width: size, height: size }
      : { width: size, height: size }

  return (
    <svg
      viewBox={viewBox}
      fill={fill}
      className={cn("flex-shrink-0", className)}
      style={sizeStyles}
      {...props}
    />
  )
}
