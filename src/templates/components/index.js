'use strict';
const { renderKeyTakeaway }              = require('./keyTakeaway');
const { badgeClass, renderBadge, renderInlineBadge } = require('./badge');
const { renderBucket, renderBuckets }   = require('./buckets');
const { renderChecklist }               = require('./checklist');
const { renderDestCard, renderDestSection } = require('./destCard');
const { renderFooter }                  = require('./footer');
const { renderChapterCard }             = require('./chapterCard');

module.exports = {
  renderKeyTakeaway,
  badgeClass, renderBadge, renderInlineBadge,
  renderBucket, renderBuckets,
  renderChecklist,
  renderDestCard, renderDestSection,
  renderFooter,
  renderChapterCard,
};
