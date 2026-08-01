export type IntakeFieldType =
  | "short_text"
  | "long_text"
  | "email"
  | "phone"
  | "number"
  | "date"
  | "dropdown"
  | "checkbox"
  | "file";

export interface IntakeField {
  id: string;
  type: IntakeFieldType;
  label: string;
  placeholder?: string;
  helpText?: string;
  required?: boolean;
  options?: string[];
}

export interface IntakeForm {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  slug: string;
  fields: IntakeField[];
  is_active: boolean;
  thank_you_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface IntakeFormResponse {
  id: string;
  form_id: string;
  submitter_name: string | null;
  submitter_email: string | null;
  answers: Record<string, unknown>;
  created_at: string;
}

export const FIELD_TYPE_LABELS: Record<IntakeFieldType, string> = {
  short_text: "Short text",
  long_text: "Long text",
  email: "Email",
  phone: "Phone",
  number: "Number",
  date: "Date",
  dropdown: "Dropdown",
  checkbox: "Checkbox",
  file: "File upload",
};

export const FIELD_TYPES = Object.keys(FIELD_TYPE_LABELS) as IntakeFieldType[];

export function slugifyForm(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 60);
}

export function newField(type: IntakeFieldType = "short_text"): IntakeField {
  return {
    id: crypto.randomUUID(),
    type,
    label: FIELD_TYPE_LABELS[type],
    required: false,
    options: type === "dropdown" ? ["Option 1", "Option 2"] : undefined,
  };
}