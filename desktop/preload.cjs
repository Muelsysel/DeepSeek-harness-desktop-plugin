'use strict';

/**
 * dsh-desktop preload: a minimal, safe bridge. The dsh web UI runs
 * unmodified; this only marks the window as the desktop shell so any future
 * desktop-aware code can tell.
 */

const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('dshDesktop', {
  isDesktop: true,
  platform: process.platform,
  version: '0.1.0',
});
