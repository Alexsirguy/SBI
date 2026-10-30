"use client";

import { type ReactNode, useId } from "react";

export interface Choice<T extends string> {
  value: T;
  label: ReactNode;
  hint?: ReactNode;
}

/** Native radios in a fieldset, so arrow keys and screen readers work as people expect. */
export function RadioGroup<T extends string>({
  legend,
  name,
  options,
  value,
  onChange,
  look = "list",
}: {
  legend: ReactNode;
  name: string;
  options: Choice<T>[];
  value: T | undefined;
  onChange: (value: T) => void;
  /** "segmented" lays short choices side by side, as for depth. */
  look?: "list" | "segmented";
}) {
  return (
    <fieldset className={`sbi-choice sbi-choice--${look}`}>
      <legend className="sbi-choice__legend">{legend}</legend>
      <div className="sbi-choice__options">
        {options.map((option) => (
          <label key={option.value} className="sbi-choice__option">
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
            />
            <span className="sbi-choice__text">
              {option.label}
              {option.hint ? <span className="sbi-choice__hint"> ({option.hint})</span> : null}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

const POINTS = [1, 2, 3, 4, 5] as const;

/** A 1-5 rating; every point is labelled in words, never only by number or colour. */
export function Scale({
  legend,
  name,
  value,
  onChange,
  words,
}: {
  legend: ReactNode;
  name: string;
  value: number | undefined;
  onChange: (value: number) => void;
  words: Record<(typeof POINTS)[number], string>;
}) {
  const idBase = useId();
  return (
    <fieldset className="sbi-scale">
      <legend className="sbi-choice__legend">{legend}</legend>
      <div className="sbi-scale__points">
        {POINTS.map((point) => (
          <label key={point} className="sbi-scale__point" htmlFor={`${idBase}-${point}`}>
            <input
              id={`${idBase}-${point}`}
              type="radio"
              name={name}
              value={point}
              checked={value === point}
              onChange={() => onChange(point)}
            />
            <span className="sbi-scale__number" aria-hidden="true">
              {point}
            </span>
            <span className="sbi-scale__word">
              <span className="sbi-visually-hidden">{point} </span>
              {words[point]}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
