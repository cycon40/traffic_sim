const SVG_TEMPLATES = {
  sedan: () => `
    <svg viewBox="0 0 64 32" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <g stroke="#0f172a" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round">
        <path class="vehicle-body" fill="currentColor" d="M6 8 L18 2 H46 L58 8 L62 16 L58 24 L46 30 H18 L6 24 L2 16 Z" />
        <path class="vehicle-trim" fill="var(--vehicle-trim-fill, rgba(15,23,42,0.12))" d="M8 8 H56 L59 16 L56 24 H8 L5 16 Z" />
        <rect class="vehicle-glass" fill="var(--vehicle-glass, #cbd5f5)" x="22" y="7" width="20" height="10" rx="2.5" />
        <path class="vehicle-detail" fill="none" d="M16 8 L24 8 M40 8 L48 8 M16 24 L24 24 M40 24 L48 24" />
        <circle class="vehicle-light" fill="var(--vehicle-light, #fef08a)" cx="13" cy="10" r="2" />
        <circle class="vehicle-light" fill="var(--vehicle-light, #fef08a)" cx="51" cy="10" r="2" />
        <circle class="vehicle-light" fill="var(--vehicle-light, #fde68a)" cx="13" cy="22" r="2" />
        <circle class="vehicle-light" fill="var(--vehicle-light, #fde68a)" cx="51" cy="22" r="2" />
      </g>
    </svg>
  `,
  van: () => `
    <svg viewBox="0 0 64 34" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <g stroke="#0f172a" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round">
        <path class="vehicle-body" fill="currentColor" d="M4 9 L30 3 H50 L60 9 L60 25 L4 31 Z" />
        <path class="vehicle-trim" fill="var(--vehicle-trim-fill, rgba(15,23,42,0.12))" d="M8 11 H56 V23 H8 Z" />
        <path class="vehicle-glass" fill="var(--vehicle-glass, #cbd5f5)" d="M32 9 H54 V18 H32 Z" />
        <path class="vehicle-glass" fill="var(--vehicle-glass, #cbd5f5)" d="M10 12 H28 V20 H10 Z" />
        <path class="vehicle-detail" fill="none" d="M14 13 V19 M46 11 V21" />
        <circle class="vehicle-light" fill="var(--vehicle-light, #fef08a)" cx="11" cy="13" r="2.2" />
        <circle class="vehicle-light" fill="var(--vehicle-light, #fde68a)" cx="11" cy="21" r="2.2" />
        <circle class="vehicle-light" fill="var(--vehicle-light, #fef08a)" cx="57" cy="13" r="2.2" />
        <circle class="vehicle-light" fill="var(--vehicle-light, #fde68a)" cx="57" cy="21" r="2.2" />
      </g>
    </svg>
  `,
  truck: () => `
    <svg viewBox="0 0 76 36" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <g stroke="#0f172a" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round">
        <rect class="vehicle-body" fill="currentColor" x="4" y="8" width="46" height="20" rx="3" />
        <path class="vehicle-cab" fill="currentColor" d="M50 10 H68 L72 14 V26 H50 Z" />
        <rect class="vehicle-glass" fill="var(--vehicle-glass, #cbd5f5)" x="56" y="14" width="10" height="6" rx="1.5" />
        <path class="vehicle-detail" fill="none" d="M10 10 V26 M22 10 V26 M34 10 V26" />
        <circle class="vehicle-light" fill="var(--vehicle-light, #fde68a)" cx="8" cy="12" r="2" />
        <circle class="vehicle-light" fill="var(--vehicle-light, #fef08a)" cx="70" cy="20" r="2.2" />
      </g>
    </svg>
  `,
  semi: () => `
    <svg viewBox="0 0 110 40" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <g stroke="#0f172a" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round">
        <rect class="vehicle-trailer" fill="currentColor" x="12" y="8" width="68" height="24" rx="3" />
        <path class="vehicle-cab" fill="currentColor" d="M80 11 H96 L102 16 V28 H80 Z" />
        <rect class="vehicle-glass" fill="var(--vehicle-glass, #cbd5f5)" x="86" y="16" width="10" height="6" rx="1.5" />
        <path class="vehicle-detail" fill="none" d="M24 10 V32 M40 10 V32 M56 10 V32" />
        <circle class="vehicle-light" fill="var(--vehicle-light, #fde68a)" cx="16" cy="12" r="2" />
        <circle class="vehicle-light" fill="var(--vehicle-light, #fef08a)" cx="100" cy="22" r="2.2" />
      </g>
    </svg>
  `,
  default: () => `
    <svg viewBox="0 0 48 30" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <g stroke="#0f172a" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round">
        <rect class="vehicle-body" fill="currentColor" x="4" y="6" width="40" height="18" rx="6" />
        <rect class="vehicle-glass" fill="var(--vehicle-glass, #cbd5f5)" x="16" y="9" width="16" height="12" rx="3" />
        <path class="vehicle-detail" fill="none" d="M10 9 H18 M30 9 H38 M10 21 H18 M30 21 H38" />
      </g>
    </svg>
  `,
};

const SHAPE_ALIASES = {
  car: "sedan",
  sedan: "sedan",
  coupe: "sedan",
  van: "van",
  lorry: "van",
  truck: "truck",
  rigid: "truck",
  semi_truck: "semi",
  semi: "semi",
};

function resolveShape(shape) {
  const key = (shape || "").toLowerCase();
  return SHAPE_ALIASES[key] || key || "default";
}

export function getVehicleIconMarkup(shape) {
  const resolved = resolveShape(shape);
  const builder = SVG_TEMPLATES[resolved] || SVG_TEMPLATES.default;
  return builder().trim();
}

export function getLegendIconMarkup(shape) {
  return getVehicleIconMarkup(shape);
}
