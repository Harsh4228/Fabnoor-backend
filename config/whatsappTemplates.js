import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

/*
 * Generic WhatsApp template engine.
 *
 * Templates are fetched live from Meta, so any template approved in WhatsApp
 * Manager shows up in the admin panel automatically — no code change needed.
 * `analyzeTemplate` turns Meta's template definition into a list of input
 * fields the admin must fill, and `buildComponents` turns those filled values
 * back into the `components` payload Meta expects when sending.
 *
 * Supported: TEXT / IMAGE / VIDEO / DOCUMENT / LOCATION headers, positional
 * ({{1}}) and named ({{customer_name}}) variables, dynamic URL, copy-code,
 * catalog, quick-reply, flow, phone and static URL buttons, limited-time
 * offers and authentication (OTP) templates.
 * Not supported (detected and blocked, never sent broken): carousel and
 * multi-product (MPM) templates.
 */

const GRAPH = "https://graph.facebook.com/v19.0";
const CACHE_MS = 5 * 60 * 1000;
const MEDIA_FORMATS = ["IMAGE", "VIDEO", "DOCUMENT"];

let cache = { at: 0, templates: [] };

/* ── Fetch all APPROVED templates from Meta (with paging + cache) ── */
export const fetchApprovedTemplates = async ({ refresh = false } = {}) => {
  if (!refresh && cache.templates.length && Date.now() - cache.at < CACHE_MS) {
    return cache.templates;
  }

  const token = process.env.WHATSAPP_TOKEN;
  const wabaId = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;
  if (!token || !wabaId) {
    throw new Error("WHATSAPP_TOKEN or WHATSAPP_BUSINESS_ACCOUNT_ID missing in .env");
  }

  const templates = [];
  let url = `${GRAPH}/${wabaId}/message_templates`;
  let params = {
    status: "APPROVED",
    fields: "name,language,status,category,components,parameter_format",
    limit: 100,
  };

  while (url) {
    const { data } = await axios.get(url, {
      params,
      headers: { Authorization: `Bearer ${token}` },
    });
    templates.push(...(data.data || []));
    url = data.paging?.next || null;
    params = undefined; // `next` already carries the query string
  }

  cache = { at: Date.now(), templates };
  return templates;
};

export const findTemplate = async (name, language) => {
  const all = await fetchApprovedTemplates();
  const match = (list) =>
    list.find((t) => t.name === name && (!language || t.language === language));
  return match(all) || match(await fetchApprovedTemplates({ refresh: true })) || null;
};

/* ── Placeholder helpers ── */

// Unique placeholders in the order Meta expects them: positional ones sorted
// by number ({{1}}, {{2}}…), named ones in order of first appearance.
const extractVars = (text) => {
  const found = [];
  for (const m of (text || "").matchAll(/\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g)) {
    if (!found.includes(m[1])) found.push(m[1]);
  }
  const positional = found.every((v) => /^\d+$/.test(v));
  return positional ? found.sort((a, b) => Number(a) - Number(b)) : found;
};

const isNamed = (vars) => vars.some((v) => !/^\d+$/.test(v));

// Meta rejects text params containing newlines, tabs or >4 consecutive spaces.
const cleanParam = (value) =>
  String(value ?? "").replace(/[\n\t\r]+/g, " ").replace(/ {4,}/g, "   ").trim();

export const fillPlaceholders = (text, values) =>
  (text || "").replace(/\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g, (whole, key) =>
    values[key] !== undefined && values[key] !== "" ? values[key] : whole
  );

// Meta stores sample values in `example`; we show them as input hints.
const exampleFor = (component, vars) => {
  const ex = component.example || {};
  const named = ex.body_text_named_params || ex.header_text_named_params;
  if (named) return Object.fromEntries(named.map((p) => [p.param_name, p.example]));
  const positional = ex.body_text?.[0] || ex.header_text || [];
  return Object.fromEntries(vars.map((v, i) => [v, positional[i]]));
};

/* ── Turn a Meta template into the list of inputs the admin must fill ── */
export const analyzeTemplate = (tpl) => {
  const components = tpl.components || [];
  const get = (type) => components.find((c) => c.type === type);
  const header = get("HEADER");
  const body = get("BODY");
  const footer = get("FOOTER");
  const buttons = get("BUTTONS")?.buttons || [];
  const lto = get("LIMITED_TIME_OFFER");

  const fields = [];
  let unsupported = null;

  if (get("CAROUSEL")) unsupported = "Carousel templates";
  if (buttons.some((b) => b.type === "MPM")) unsupported = "Multi-product (MPM) templates";

  const isAuth = tpl.category === "AUTHENTICATION";

  // Header
  if (header?.format === "TEXT") {
    const vars = extractVars(header.text);
    const ex = exampleFor(header, vars);
    vars.forEach((v) =>
      fields.push({
        key: `header:${v}`, group: "Header", kind: "text", placeholder: v,
        label: `Header {{${v}}}`, example: ex[v], personalizable: true, required: true,
      })
    );
  } else if (MEDIA_FORMATS.includes(header?.format)) {
    fields.push({
      key: "header_media", group: "Header", kind: "media",
      mediaType: header.format.toLowerCase(),
      label: `Header ${header.format.toLowerCase()}`, required: true,
      defaultValue: header.format === "IMAGE" ? process.env.WHATSAPP_HEADER_IMAGE_URL || "" : "",
    });
  } else if (header?.format === "LOCATION") {
    fields.push({ key: "header_location", group: "Header", kind: "location", label: "Header location", required: true });
  }

  // Body
  const bodyVars = extractVars(body?.text);
  if (isAuth) {
    // OTP templates: Meta's fixed body has one {{1}} = the code, and the
    // copy-code / one-tap button repeats the same code.
    fields.push({ key: "otp_code", group: "Body", kind: "text", label: "Verification code", required: true, personalizable: false });
  } else {
    const ex = body ? exampleFor(body, bodyVars) : {};
    bodyVars.forEach((v) =>
      fields.push({
        key: `body:${v}`, group: "Body", kind: "text", placeholder: v,
        label: `Body {{${v}}}`, example: ex[v], personalizable: true, required: true,
      })
    );
  }

  // Limited-time offer
  if (lto?.limited_time_offer?.has_expiration) {
    fields.push({ key: "lto_expiry", group: "Offer", kind: "datetime", label: "Offer expires at", required: true });
  }

  // Buttons — `index` must be the button's position in the template
  if (!isAuth) {
    buttons.forEach((b, i) => {
      if (b.type === "URL" && /\{\{.*\}\}/.test(b.url || "")) {
        fields.push({
          key: `btn:${i}`, group: "Buttons", kind: "text", personalizable: true, required: true,
          label: `"${b.text}" link ending`, hint: b.url, example: b.example?.[0],
        });
      } else if (b.type === "COPY_CODE") {
        fields.push({ key: `btn:${i}`, group: "Buttons", kind: "text", label: "Coupon code", example: b.example?.[0], personalizable: true, required: true });
      } else if (b.type === "CATALOG") {
        fields.push({ key: `btn:${i}`, group: "Buttons", kind: "text", label: "Thumbnail product retailer ID (optional)", required: false });
      }
      // QUICK_REPLY, PHONE_NUMBER, static URL, FLOW, VOICE_CALL: nothing to fill
    });
  }

  return {
    id: `${tpl.name}::${tpl.language}`,
    name: tpl.name,
    language: tpl.language,
    category: tpl.category,
    parameterFormat: tpl.parameter_format || (isNamed(bodyVars) ? "NAMED" : "POSITIONAL"),
    supported: !unsupported,
    unsupportedReason: unsupported ? `${unsupported} are not supported yet` : null,
    preview: {
      header: header
        ? { format: header.format, text: header.text || "" }
        : null,
      body: body?.text || "",
      footer: footer?.text || "",
      limitedTimeOffer: lto?.limited_time_offer?.text || "",
      buttons: buttons.map((b) => ({ type: b.type, text: b.text })),
    },
    fields,
  };
};

/* ── Resolve one admin-entered value for a specific contact ──
 * A text value is { source: "fixed" | "name" | "mobile" | "column", value,
 * column, fallback }, so one broadcast can send "Hi Rahul, 20% off in Surat"
 * / "Hi Priya, 10% off in Pune" etc. "column" reads contact.fields[column],
 * i.e. an extra Excel column or a customer field from the database.
 */
const resolveValue = (input, contact) => {
  if (input == null) return "";
  if (typeof input !== "object") return cleanParam(input);
  if (input.source === "name") return cleanParam(contact?.name || input.fallback || "Customer");
  if (input.source === "mobile") return cleanParam(contact?.mobile || "");
  if (input.source === "column") {
    return cleanParam(contact?.fields?.[input.column]) || cleanParam(input.fallback);
  }
  return cleanParam(input.value);
};

/* ── Per-contact check: Meta rejects empty variables, so a contact whose
 * column is blank (and has no fallback) is skipped with a clear reason. ── */
export const missingContactValue = (analysis, params = {}, contact = {}) => {
  for (const f of analysis.fields) {
    if (f.kind !== "text" || !f.required) continue;
    const v = params[f.key];
    if (v?.source === "column" && !resolveValue(v, contact)) {
      return `No value for "${v.column}" (${f.label})`;
    }
  }
  return null;
};

/* ── Check every required field has a value before sending anything ── */
export const validateParams = (analysis, params = {}) => {
  if (!analysis.supported) return analysis.unsupportedReason;
  for (const f of analysis.fields) {
    if (!f.required) continue;
    const v = params[f.key];
    if (f.kind === "location") {
      if (v?.latitude === undefined || v?.latitude === "" || v?.longitude === undefined || v?.longitude === "") {
        return `${f.label}: latitude and longitude are required`;
      }
    } else if (f.kind === "media" || f.kind === "datetime") {
      const val = rawValue(v);
      if (!val) return `${f.label} is required`;
      if (f.kind === "datetime" && Number.isNaN(new Date(val).getTime())) return `${f.label} is not a valid date`;
      if (f.kind === "media" && !/^https?:\/\//i.test(val)) return `${f.label} must be a public http(s) link`;
    } else {
      const source = typeof v === "object" ? v?.source : "fixed";
      const value = typeof v === "object" ? v?.value : v;
      if (source === "fixed" && !cleanParam(value)) return `${f.label} is required`;
      if (source === "column" && !v.column) return `${f.label}: choose a column`;
    }
  }
  return null;
};

const rawValue = (v) => (typeof v === "object" && v !== null ? v.value : v);

/* ── Build the Meta `components` payload for one contact ── */
export const buildComponents = (tpl, params = {}, contact = {}) => {
  const components = tpl.components || [];
  const get = (type) => components.find((c) => c.type === type);
  const header = get("HEADER");
  const body = get("BODY");
  const buttons = get("BUTTONS")?.buttons || [];
  const lto = get("LIMITED_TIME_OFFER");
  const isAuth = tpl.category === "AUTHENTICATION";
  const out = [];

  const textParams = (vars, prefix) => {
    const named = isNamed(vars);
    return vars.map((v) => ({
      type: "text",
      ...(named ? { parameter_name: v } : {}),
      text: resolveValue(params[`${prefix}:${v}`], contact),
    }));
  };

  // Header
  if (header?.format === "TEXT") {
    const vars = extractVars(header.text);
    if (vars.length) out.push({ type: "header", parameters: textParams(vars, "header") });
  } else if (MEDIA_FORMATS.includes(header?.format)) {
    const t = header.format.toLowerCase();
    const link = rawValue(params.header_media);
    const media = { link };
    if (t === "document") {
      media.filename = params.header_media?.filename || link.split("/").pop().split("?")[0] || "document.pdf";
    }
    out.push({ type: "header", parameters: [{ type: t, [t]: media }] });
  } else if (header?.format === "LOCATION") {
    const loc = params.header_location || {};
    out.push({
      type: "header",
      parameters: [{
        type: "location",
        location: {
          latitude: String(loc.latitude),
          longitude: String(loc.longitude),
          name: cleanParam(loc.name),
          address: cleanParam(loc.address),
        },
      }],
    });
  }

  // Body
  if (isAuth) {
    const code = resolveValue(params.otp_code, contact);
    out.push({ type: "body", parameters: [{ type: "text", text: code }] });
    // Copy-code and one-tap OTP buttons are both sent as a url button at index 0
    const otpIdx = buttons.findIndex((b) => b.type === "OTP");
    if (otpIdx !== -1) {
      out.push({ type: "button", sub_type: "url", index: String(otpIdx), parameters: [{ type: "text", text: code }] });
    }
    return out;
  }

  const bodyVars = extractVars(body?.text);
  if (bodyVars.length) out.push({ type: "body", parameters: textParams(bodyVars, "body") });

  // Limited-time offer
  if (lto?.limited_time_offer?.has_expiration) {
    const ms = new Date(rawValue(params.lto_expiry)).getTime();
    out.push({
      type: "limited_time_offer",
      parameters: [{ type: "limited_time_offer", limited_time_offer: { expiration_time_ms: ms } }],
    });
  }

  // Buttons
  buttons.forEach((b, i) => {
    const index = String(i);
    const val = params[`btn:${i}`];
    if (b.type === "URL" && /\{\{.*\}\}/.test(b.url || "")) {
      out.push({ type: "button", sub_type: "url", index, parameters: [{ type: "text", text: resolveValue(val, contact) }] });
    } else if (b.type === "COPY_CODE") {
      out.push({ type: "button", sub_type: "copy_code", index, parameters: [{ type: "coupon_code", coupon_code: resolveValue(val, contact) }] });
    } else if (b.type === "CATALOG") {
      const id = resolveValue(val, contact);
      out.push({
        type: "button", sub_type: "catalog", index,
        parameters: [{ type: "action", action: id ? { thumbnail_product_retailer_id: id } : {} }],
      });
    }
  });

  return out;
};

/* ── Plain-text version of what the customer receives (for chat history) ── */
export const renderTemplateText = (tpl, params = {}, contact = {}) => {
  const components = tpl.components || [];
  const get = (type) => components.find((c) => c.type === type);
  const header = get("HEADER");
  const body = get("BODY");
  const footer = get("FOOTER");

  const valuesFor = (prefix, text) =>
    Object.fromEntries(extractVars(text).map((v) => [v, resolveValue(params[`${prefix}:${v}`], contact)]));

  const parts = [];
  if (header?.format === "TEXT") parts.push(fillPlaceholders(header.text, valuesFor("header", header.text)));
  else if (header?.format) parts.push(`[${header.format.toLowerCase()}]`);

  if (tpl.category === "AUTHENTICATION") {
    const code = resolveValue(params.otp_code, contact);
    parts.push(fillPlaceholders(body?.text, { 1: code }));
  } else if (body) {
    parts.push(fillPlaceholders(body.text, valuesFor("body", body.text)));
  }
  if (footer?.text) parts.push(footer.text);
  return parts.filter(Boolean).join("\n");
};
