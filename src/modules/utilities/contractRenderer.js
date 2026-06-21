'use strict';

// FR-078 — THROWAWAY reference renderer. Its only job is to PROVE the headless utilities
// contract carries everything a UI needs to render the chapter. This is NOT the product UI —
// it is deliberately minimal, with zero design investment. The real frontend is built
// separately against the contract (Claude design / full creative freedom).
//
// CONSTRAINT-008: semantic class names only, no inline styles. Tone -> visual lives in CSS via
// the `rc-tone-*` class; this renderer never emits a color. If rendering a real chapter needs a
// field the contract lacks, the fix is the schema/builder — never this file.

function esc(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

function renderFinding(f) {
  const measure = f.claim.measure
    ? ` <span class="rc-measure">${esc(f.claim.measure.value)} ${esc(f.claim.measure.unit)}</span>` : '';
  const comparison = f.claim.comparison
    ? ` <span class="rc-compare">(${esc(f.claim.comparison.direction)} ${esc(f.claim.comparison.basis)})</span>` : '';
  const fallback = f.fallbackAction
    ? ` <a class="rc-fallback" href="${esc(f.fallbackAction.value)}" target="_blank" rel="noopener noreferrer">${esc(f.fallbackAction.label)}</a>` : '';
  const copy = f.defaultCopy ? `<p class="rc-copy">${esc(f.defaultCopy)}</p>` : '';
  return `<li class="rc-finding rc-bucket-${esc(f.bucket)} rc-tone-${esc(f.tone)}" data-id="${esc(f.id)}">`
    + `<span class="rc-subject">${esc(f.claim.subject)}</span>${measure}${comparison}${fallback}${copy}`
    + `<span class="rc-prov">${esc(f.provenance.source)} · ${esc(f.provenance.asOf)}</span></li>`;
}

function renderUtilitiesFromContract(contract) {
  if (!contract || !Array.isArray(contract.findings)) return '';
  return `<section class="rc-chapter" data-chapter="${esc(contract.chapterId)}">`
    + `<ul class="rc-findings">${contract.findings.map(renderFinding).join('')}</ul></section>`;
}

module.exports = { renderUtilitiesFromContract };
