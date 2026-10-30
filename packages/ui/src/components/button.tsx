import type { ComponentProps } from "react";

export interface ButtonProps extends ComponentProps<"button"> {
  /** Primary is the one main action on a screen; quiet is everything else. */
  variant?: "primary" | "quiet";
  size?: "normal" | "small";
  block?: boolean;
}

export function Button({
  variant = "primary",
  size = "normal",
  block = false,
  type = "button",
  className,
  ...props
}: ButtonProps) {
  const classes = [
    "sbi-button",
    `sbi-button--${variant}`,
    size === "small" ? "sbi-button--small" : "",
    block ? "sbi-button--block" : "",
    className ?? "",
  ];
  return <button type={type} className={classes.filter(Boolean).join(" ")} {...props} />;
}
