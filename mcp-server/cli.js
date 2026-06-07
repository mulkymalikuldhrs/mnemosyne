#!/usr/bin/env node
// mnemosyne MCP Server — CLI entry point
// This wrapper runs the compiled TypeScript from dist/
'use strict';

// Resolve the path relative to this script's location
const path = require('path');
const distPath = path.join(__dirname, 'dist', 'index.js');

try {
  require(distPath);
} catch (err) {
  if (err.code === 'MODULE_NOT_FOUND') {
    console.error('[mnemosyne-mcp] Error: Compiled output not found at ' + distPath);
    console.error('[mnemosyne-mcp] Run "npm run mcp:build" first to compile the MCP server.');
    process.exit(1);
  }
  throw err;
}
