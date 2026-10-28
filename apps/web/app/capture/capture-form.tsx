"use client";

import { useId, useState } from "react";
import {
  ACCEPTED_EXTENSIONS,
  ACCEPTED_FORMATS_LABEL,
  MAX_UPLOAD_LABEL,
  formatBytes,
  validateSelection,
} from "./limits";

export function CaptureForm() {
  const cameraId = useId();
  const uploadId = useId();
  const problemId = useId();
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileSize, setFileSize] = useState<number | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  function choose(input: HTMLInputElement) {
    const selected = input.files?.[0];
    if (!selected) {
      return;
    }
    const issue = validateSelection(selected);
    setProblem(issue);
    setReady(issue === null);
    setFileName(selected.name);
    setFileSize(issue === null ? selected.size : null);
  }

  return (
    <form aria-label="Photo capture" onSubmit={(event) => event.preventDefault()}>
      <div>
        <label htmlFor={cameraId}>Take a photo</label>
        <input
          id={cameraId}
          name="camera"
          type="file"
          aria-invalid={problem ? true : undefined}
          aria-describedby={problem ? problemId : undefined}
          accept="image/*"
          capture="environment"
          onChange={(event) => choose(event.currentTarget)}
        />
      </div>
      <div>
        <label htmlFor={uploadId}>Upload a photo</label>
        <input
          id={uploadId}
          name="upload"
          type="file"
          aria-invalid={problem ? true : undefined}
          aria-describedby={problem ? problemId : undefined}
          accept={ACCEPTED_EXTENSIONS}
          onChange={(event) => choose(event.currentTarget)}
        />
      </div>
      <p>
        Accepted formats: {ACCEPTED_FORMATS_LABEL}. Maximum size: {MAX_UPLOAD_LABEL}.
      </p>
      <div role="alert" id={problemId}>
        {problem}
      </div>
      <div role="status">
        {!problem && fileName ? (
          <p>
            Selected {fileName}
            {fileSize === null ? "" : ` (${formatBytes(fileSize)})`}.
          </p>
        ) : null}
      </div>
      <button type="submit" disabled={!ready}>
        Upload photo
      </button>
    </form>
  );
}
