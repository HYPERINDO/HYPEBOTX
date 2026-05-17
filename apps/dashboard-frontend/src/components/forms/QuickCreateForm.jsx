import { useState } from "react";

export default function QuickCreateForm({ fields, submitLabel, onSubmit }) {
  const [values, setValues] = useState(() => Object.fromEntries(fields.map((field) => [field.name, field.defaultValue || ""])));
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    try {
      await onSubmit(values);
      setValues(Object.fromEntries(fields.map((field) => [field.name, field.defaultValue || ""])));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="quick-form" onSubmit={submit}>
      {fields.map((field) => {
        if (field.type === "select") {
          return (
            <label key={field.name}>
              <span>{field.label}</span>
              <select value={values[field.name]} onChange={(event) => setValues({ ...values, [field.name]: event.target.value })} required={field.required}>
                {(field.options || []).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
          );
        }
        return (
          <label key={field.name}>
            <span>{field.label}</span>
            <input
              type={field.type || "text"}
              value={values[field.name]}
              placeholder={field.placeholder || ""}
              onChange={(event) => setValues({ ...values, [field.name]: event.target.value })}
              required={field.required}
            />
          </label>
        );
      })}
      <button className="primary-button" type="submit" disabled={busy}>{busy ? "Menyimpan..." : submitLabel}</button>
    </form>
  );
}
