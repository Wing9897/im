export const MAX_HTTP_HEADERS = 10;
export const DEFAULT_MAX_CONTENT_CHARS = 32000;
export const MAX_MAX_CONTENT_CHARS = 100000;

export interface HeaderEntry {
  id: string;
  key: string;
  value: string;
}

export interface HttpFormFields {
  url: string;
  name: string;
  method: "GET" | "POST";
  authType: "none" | "bearer" | "basic";
  bearerToken: string;
  basicUsername: string;
  basicPassword: string;
  headers: HeaderEntry[];
  bodyType: "none" | "json" | "text" | "form";
  body: string;
  pollIntervalMinutes: number;
  maxContentChars: number;
}

export const INITIAL_HTTP_FORM: HttpFormFields = {
  url: "",
  name: "",
  method: "GET",
  authType: "none",
  bearerToken: "",
  basicUsername: "",
  basicPassword: "",
  headers: [{ id: "hdr_0", key: "", value: "" }],
  bodyType: "none",
  body: "",
  pollIntervalMinutes: 5,
  maxContentChars: DEFAULT_MAX_CONTENT_CHARS,
};
