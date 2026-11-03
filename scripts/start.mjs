// APP_ORIGIN is our runtime setting, not the removed adapter-node ORIGIN option.
process.env.APP_ORIGIN ||=
  process.env.RENDER_EXTERNAL_URL || `http://127.0.0.1:${process.env.PORT || '3000'}`;
await import('../build/index.js');
