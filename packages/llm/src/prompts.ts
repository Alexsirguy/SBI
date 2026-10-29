import type { ChatMessage } from "./provider";

export interface PromptVersion {
  id: string;
  version: string;
  system: string;
  template: string;
}

export interface PromptRegistry {
  register(prompt: PromptVersion): void;
  /** Latest version when `version` is omitted. */
  get(id: string, version?: string): PromptVersion;
  render(id: string, variables: Record<string, string>, version?: string): ChatMessage[];
}

// Versioned prompts let lessons record exactly which wording produced them.
export function createPromptRegistry(initial: PromptVersion[] = []): PromptRegistry {
  const store = new Map<string, PromptVersion[]>();
  const registry: PromptRegistry = { register, get, render };
  for (const prompt of initial) register(prompt);
  return registry;

  function register(prompt: PromptVersion): void {
    const versions = store.get(prompt.id) ?? [];
    if (versions.some((entry) => entry.version === prompt.version)) {
      throw new Error(`Duplicate prompt "${prompt.id}" version "${prompt.version}"`);
    }
    store.set(prompt.id, [...versions, prompt]);
  }

  function get(id: string, version?: string): PromptVersion {
    const versions = store.get(id);
    const found = version ? versions?.find((entry) => entry.version === version) : versions?.at(-1);
    if (!found) {
      throw new Error(`Unknown prompt "${id}"${version ? ` version "${version}"` : ""}`);
    }
    return found;
  }

  function render(id: string, variables: Record<string, string>, version?: string): ChatMessage[] {
    const prompt = get(id, version);
    return [
      { role: "system", content: prompt.system },
      { role: "user", content: fill(prompt.template, variables) },
    ];
  }

  function fill(template: string, variables: Record<string, string>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (match, name: string) => {
      const value = variables[name];
      if (value === undefined) throw new Error(`Missing prompt variable "${name}"`);
      return value;
    });
  }
}
