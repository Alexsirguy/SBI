import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  Button,
  Card,
  Disclosure,
  Mark,
  Notice,
  Placeholder,
  RadioGroup,
  Scale,
  SelectField,
  StatusLine,
  TextArea,
  TextField,
} from "../index";

const html = (node: React.ReactNode) => renderToStaticMarkup(node);

describe("Button", () => {
  it("is a real button that never submits by accident, with its variant", () => {
    expect(html(<Button>Start lesson</Button>)).toBe(
      '<button type="button" class="sbi-button sbi-button--primary">Start lesson</button>',
    );
    expect(
      html(
        <Button variant="quiet" size="small" block type="submit">
          Send
        </Button>,
      ),
    ).toBe(
      '<button type="submit" class="sbi-button sbi-button--quiet sbi-button--small sbi-button--block">Send</button>',
    );
  });
});

describe("fields", () => {
  it("tie the label, hint and error to the control and mark it invalid", () => {
    const out = html(
      <TextField
        id="q"
        label="Your question"
        hint="Optional"
        error="Too short"
        defaultValue="hi"
      />,
    );
    expect(out).toContain('<label for="q" class="sbi-field__label">Your question</label>');
    expect(out).toContain('aria-describedby="q-hint q-error"');
    expect(out).toContain('aria-invalid="true"');
    expect(out).toContain('<p id="q-error" role="alert" class="sbi-field__error">Too short</p>');
  });

  it("leave out description and invalid state when there is nothing to say", () => {
    const out = html(<TextArea id="t" label="Details" />);
    expect(out).not.toContain("aria-describedby");
    expect(out).not.toContain("aria-invalid");
    expect(
      html(
        <SelectField id="s" label="What is wrong?">
          <option>One</option>
        </SelectField>,
      ),
    ).toContain('<select id="s" class="sbi-control"><option>One</option></select>');
  });
});

describe("RadioGroup and Scale", () => {
  it("use native radios in a fieldset with a legend", () => {
    const out = html(
      <RadioGroup
        legend="How deep?"
        name="depth"
        value="explore"
        onChange={() => undefined}
        options={[
          { value: "quick", label: "Quick" },
          { value: "explore", label: "Explore", hint: "Everyday explanation" },
        ]}
        look="segmented"
      />,
    );
    expect(out).toContain('<fieldset class="sbi-choice sbi-choice--segmented"><legend');
    expect(out).toContain('type="radio" name="depth" checked="" value="explore"');
    expect(out).toContain("(Everyday explanation)");
  });

  it("name every rating point in words as well as its number", () => {
    const out = html(
      <Scale
        legend="How helpful was it?"
        name="helpful"
        value={4}
        onChange={() => undefined}
        words={{ 1: "Not at all", 2: "A little", 3: "Somewhat", 4: "Mostly", 5: "Very" }}
      />,
    );
    expect(out.match(/type="radio"/g)).toHaveLength(5);
    expect(out).toContain('<span class="sbi-visually-hidden">4 </span>Mostly');
    expect(out).toContain('checked="" value="4"');
  });
});

describe("display components", () => {
  it("name a notice's kind in words and announce it only when asked", () => {
    expect(html(<Notice kind="safety">Do not try this.</Notice>)).toContain(
      '<strong class="sbi-notice__kind">Safety</strong>',
    );
    expect(html(<Notice kind="note">x</Notice>)).not.toContain("role=");
    expect(
      html(
        <Notice kind="error" live>
          Failed
        </Notice>,
      ),
    ).toContain('role="alert"');
  });

  it("hide placeholders from assistive technology and keep status polite", () => {
    expect(html(<Placeholder lines={2} />)).toBe(
      '<div class="sbi-placeholder" aria-hidden="true"><span class="sbi-placeholder__line"></span><span class="sbi-placeholder__line"></span></div>',
    );
    expect(html(<StatusLine>Lesson ready.</StatusLine>)).toBe(
      '<p role="status" class="sbi-status">Lesson ready.</p>',
    );
  });

  it("use native disclosure, a real mark for the highlighter, and a plain card", () => {
    expect(html(<Disclosure summary="Sources">List</Disclosure>)).toContain(
      '<details class="sbi-disclosure"><summary class="sbi-disclosure__summary">Sources</summary>',
    );
    expect(html(<Mark>The answer</Mark>)).toBe('<mark class="sbi-mark">The answer</mark>');
    expect(html(<Card className="extra">x</Card>)).toBe('<div class="sbi-card extra">x</div>');
  });
});
