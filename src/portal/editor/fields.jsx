import { useEffect, useRef, useState } from "react";
import { callEditor } from "./api.js";

const MAX_IMAGE_SIDE = 2000;

// Shrinks big photos in the browser before upload; GIFs keep their animation
async function prepareImage(file) {
  if (file.type === "image/gif" || !/^image\/(jpeg|png|webp)$/.test(file.type)) return file;
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return file;
  const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(bitmap.width, bitmap.height));
  if (scale === 1 && file.size < 900_000) return file;

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const type = file.type === "image/png" ? "image/png" : "image/webp";
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, type, 0.86));
  return blob && blob.size < file.size ? blob : file;
}

function toBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function ImageInput({ field, value, onChange }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  async function upload(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setUploading(true);
    setError("");
    const prepared = await prepareImage(file);
    const result = await callEditor({ action: "upload", filename: file.name, data: await toBase64(prepared) });
    setUploading(false);
    if (result.error) setError(result.error);
    else onChange(result.data.url);
  }

  return (
    <>
      <div className="ed-image">
        <span className="ed-image-thumb">{value ? <img src={value} alt="" /> : <em>No image</em>}</span>
        <label className="ed-button ed-button-small">
          {uploading ? "Uploading…" : value ? "Replace" : "Add image"}
          <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={upload} disabled={uploading} hidden />
        </label>
        {value && field.optional && (
          <button type="button" className="ed-link-button" onClick={() => onChange("")}>
            Remove
          </button>
        )}
      </div>
      {error && <p className="ed-error">{error}</p>}
    </>
  );
}

// A repeating list (FAQ questions, cards, steps…): edit, reorder, add and delete items
function ListInput({ field, value, onChange, idPrefix }) {
  const items = Array.isArray(value) ? value : [];
  const [open, setOpen] = useState(-1);
  const max = field.max || 40;

  function update(index, key, itemValue) {
    onChange(items.map((item, i) => (i === index ? { ...item, [key]: itemValue } : item)));
  }

  function move(index, by) {
    const next = [...items];
    const [item] = next.splice(index, 1);
    next.splice(index + by, 0, item);
    onChange(next);
    setOpen(index + by);
  }

  function add() {
    const blank = Object.fromEntries(field.itemFields.map((f) => [f.key, f.default ?? ""]));
    onChange([...items, blank]);
    setOpen(items.length);
  }

  function remove(index) {
    onChange(items.filter((_, i) => i !== index));
    setOpen(-1);
  }

  const summary = (item) => {
    const first = field.itemFields.find((f) => ["text", "textarea"].includes(f.type) && item[f.key]);
    return first ? String(item[first.key]).slice(0, 60) : `${field.itemLabel || "Item"}`;
  };

  return (
    <div className="ed-list">
      {items.map((item, index) => (
        <div key={index} className={`ed-list-item${open === index ? " is-open" : ""}`}>
          <div className="ed-list-head">
            <button type="button" className="ed-list-title" onClick={() => setOpen(open === index ? -1 : index)} aria-expanded={open === index}>
              <span className="ed-list-no">{index + 1}</span>
              {summary(item)}
            </button>
            <button type="button" className="ed-mini" onClick={() => move(index, -1)} disabled={index === 0} aria-label="Move up">
              ↑
            </button>
            <button type="button" className="ed-mini" onClick={() => move(index, 1)} disabled={index === items.length - 1} aria-label="Move down">
              ↓
            </button>
            <button type="button" className="ed-mini ed-mini-danger" onClick={() => remove(index)} aria-label={`Delete ${field.itemLabel || "item"} ${index + 1}`}>
              ✕
            </button>
          </div>
          {open === index && (
            <div className="ed-list-body">
              {field.itemFields.map((sub) => (
                <FieldControl
                  key={sub.key}
                  field={sub}
                  idPrefix={`${idPrefix}-${index}`}
                  value={item[sub.key] ?? sub.default ?? ""}
                  onChange={(v) => update(index, sub.key, v)}
                  compact
                />
              ))}
            </div>
          )}
        </div>
      ))}
      {items.length < max && (
        <button type="button" className="ed-add" onClick={add}>
          + Add {(field.itemLabel || "item").toLowerCase()}
        </button>
      )}
    </div>
  );
}

export function FieldControl({ field, value, changed, onChange, onReset, onFocus, selected, idPrefix = "field", compact = false }) {
  const ref = useRef(null);
  const id = `${idPrefix}-${field.key}`.replace(/[^a-z0-9_-]/gi, "-");

  useEffect(() => {
    if (selected) ref.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [selected]);

  let control;
  if (field.type === "textarea") {
    control = <textarea id={id} rows={field.rows || 4} value={value} onChange={(e) => onChange(e.target.value)} onFocus={onFocus} />;
  } else if (field.type === "color") {
    control = (
      <div className="ed-color">
        <input type="color" value={/^#[0-9a-f]{6}$/i.test(value) ? value : "#000000"} onChange={(e) => onChange(e.target.value)} onFocus={onFocus} aria-label={`${field.label} picker`} />
        <input id={id} type="text" value={value} maxLength={7} spellCheck="false" onChange={(e) => onChange(e.target.value)} onFocus={onFocus} />
      </div>
    );
  } else if (field.type === "size") {
    control = (
      <div className="ed-size">
        <input id={id} type="range" min={field.min} max={field.max} step={field.step || 1} value={value} onChange={(e) => onChange(Number(e.target.value))} onFocus={onFocus} />
        <span className="ed-size-value">
          {value}
          {field.unit || ""}
        </span>
      </div>
    );
  } else if (field.type === "select") {
    control = (
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)} onFocus={onFocus}>
        {field.options.map(([option, label]) => (
          <option key={option} value={option}>
            {label}
          </option>
        ))}
      </select>
    );
  } else if (field.type === "image") {
    control = <ImageInput field={field} value={value} onChange={onChange} />;
  } else if (field.type === "list") {
    control = <ListInput field={field} value={value} onChange={onChange} idPrefix={id} />;
  } else {
    const inputType = { link: "url", email: "email", phone: "tel" }[field.type] || "text";
    control = <input id={id} type={inputType} value={value} onChange={(e) => onChange(e.target.value)} onFocus={onFocus} placeholder={field.placeholder || ""} />;
  }

  return (
    <div ref={ref} className={`ed-field${changed ? " is-changed" : ""}${selected ? " is-selected" : ""}${compact ? " is-compact" : ""}`}>
      <div className="ed-field-head">
        <label htmlFor={id}>{field.label}</label>
        {changed && onReset && (
          <button type="button" className="ed-reset" onClick={onReset} title="Go back to the original">
            Reset
          </button>
        )}
      </div>
      {control}
      {field.help && <p className="ed-help">{field.help}</p>}
    </div>
  );
}
