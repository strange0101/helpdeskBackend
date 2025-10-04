// src/middleware/ifMatch.js

export const parseIfMatch = (req) => {
  const raw = req.header('If-Match') || '';
  // accept forms: "v:3", v: "3", or just 3
  const matched = raw.match(/(\d+)/);
  if (!matched) return null;
  return parseInt(matched[1], 10);
};
