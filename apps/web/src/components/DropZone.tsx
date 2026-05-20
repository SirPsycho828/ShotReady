import { useRef, useState, type DragEvent, type ChangeEvent } from "react";
import { Upload } from "lucide-react";

interface DropZoneProps {
  onFiles: (files: File[]) => void;
  disabled?: boolean;
}

const MAX_FILE_SIZE = 30 * 1024 * 1024;
const MAX_BATCH = 100;

function validateFiles(files: File[]): { valid: File[]; errors: string[] } {
  const errors: string[] = [];
  if (files.length > MAX_BATCH) {
    errors.push(`Maximum ${MAX_BATCH} files at a time`);
    return { valid: [], errors };
  }
  const valid: File[] = [];
  for (const f of files) {
    const ext = f.name.toLowerCase();
    if (!ext.endsWith(".jpg") && !ext.endsWith(".jpeg")) {
      errors.push(`${f.name}: Only JPEG files are supported`);
      continue;
    }
    if (f.size > MAX_FILE_SIZE) {
      errors.push(`${f.name} exceeds the 30 MB limit`);
      continue;
    }
    valid.push(f);
  }
  return { valid, errors };
}

export function DropZone({ onFiles, disabled }: DropZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  function handleFiles(fileList: FileList | null) {
    if (!fileList) return;
    const { valid, errors: errs } = validateFiles(Array.from(fileList));
    setErrors(errs);
    if (valid.length > 0) onFiles(valid);
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    if (!disabled) handleFiles(e.dataTransfer.files);
  }

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    handleFiles(e.target.files);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => !disabled && inputRef.current?.click()}
        className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-all duration-[var(--duration-fast)] ${
          dragging
            ? "border-ring bg-accent/5"
            : "border-border hover:border-muted-foreground"
        } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
      >
        <div className="w-12 h-12 rounded-lg bg-card border border-border mx-auto mb-3 flex items-center justify-center">
          <Upload className="text-muted-foreground" size={22} />
        </div>
        <p className="text-foreground font-500 text-sm">
          Drag photos here or click to browse
        </p>
        <p className="text-muted-foreground text-xs mt-1.5">
          JPEG files, max 30 MB each
        </p>
        <input
          ref={inputRef}
          type="file"
          accept=".jpg,.jpeg"
          multiple
          onChange={handleChange}
          className="hidden"
        />
      </div>
      {errors.length > 0 && (
        <div className="mt-3 space-y-1">
          {errors.map((err, i) => (
            <p key={i} className="text-destructive text-sm">
              {err}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
