export interface SystemSettings {
  companyName: string;
  supportEmail: string;
  timeZone: string;
  dateFormat: string;
  theme: string;
  enableAiSuggestions: boolean;
  autoCreateTickets: boolean;
  requireApproval: boolean;
  showDirectory: boolean;
  enableAssetSuggestions: boolean;
  defaultCategory: string;
  defaultPriority: string;
  primaryColor: string;
}

export const defaultSettings: SystemSettings = {
  autoCreateTickets: true,
  companyName: "Internal IT Support",
  dateFormat: "DD MMM YYYY (01 Jan 2024)",
  defaultCategory: "General",
  defaultPriority: "Medium",
  enableAiSuggestions: true,
  enableAssetSuggestions: true,
  primaryColor: "Indigo (Default)",
  requireApproval: false,
  showDirectory: true,
  supportEmail: "it-support@company.local",
  theme: "Light (Default)",
  timeZone: "(UTC+7) Bangkok, Jakarta",
};

export const timeZoneOptions = [
  "(UTC+7) Bangkok, Jakarta",
  "(UTC+0) London, Dublin",
  "(UTC-5) New York, Toronto",
  "(UTC-8) San Francisco, Los Angeles",
  "(UTC+8) Singapore, Hong Kong",
  "(UTC+9) Tokyo, Seoul",
];

export const dateFormatOptions = [
  "DD MMM YYYY (01 Jan 2024)",
  "YYYY-MM-DD (2024-01-01)",
  "MM/DD/YYYY (01/01/2024)",
  "DD/MM/YYYY (01/01/2024)",
];

export const themeOptions = ["Light (Default)", "System", "Dark"];

export const categoryOptions = [
  "General",
  "Technical Issue",
  "Account & Access",
  "Hardware",
  "Billing",
  "Feature Request",
];

export const priorityOptions = ["Low", "Medium", "High", "Urgent"];

export const colorOptions = [
  { label: "Indigo (Default)", value: "#3158ed" },
  { label: "Blue", value: "#2563eb" },
  { label: "Violet", value: "#7c3aed" },
  { label: "Emerald", value: "#059669" },
  { label: "Rose", value: "#e11d48" },
];
