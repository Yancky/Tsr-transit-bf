/**
 * Copyright 2018 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *     http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// If the loader is already loaded, just stop.
if (!self.define) {
  let registry = {};

  // Used for `eval` and `importScripts` where we can't get script URL by other means.
  // In both cases, it's safe to use a global var because those functions are synchronous.
  let nextDefineUri;

  const singleRequire = (uri, parentUri) => {
    uri = new URL(uri + ".js", parentUri).href;
    return registry[uri] || (
      
        new Promise(resolve => {
          if ("document" in self) {
            const script = document.createElement("script");
            script.src = uri;
            script.onload = resolve;
            document.head.appendChild(script);
          } else {
            nextDefineUri = uri;
            importScripts(uri);
            resolve();
          }
        })
      
      .then(() => {
        let promise = registry[uri];
        if (!promise) {
          throw new Error(`Module ${uri} didn’t register its module`);
        }
        return promise;
      })
    );
  };

  self.define = (depsNames, factory) => {
    const uri = nextDefineUri || ("document" in self ? document.currentScript.src : "") || location.href;
    if (registry[uri]) {
      // Module is already loading or loaded.
      return;
    }
    let exports = {};
    const require = depUri => singleRequire(depUri, uri);
    const specialDeps = {
      module: { uri },
      exports,
      require
    };
    registry[uri] = Promise.all(depsNames.map(
      depName => specialDeps[depName] || require(depName)
    )).then(deps => {
      factory(...deps);
      return exports;
    });
  };
}
define(['./workbox-7e5eb42b'], (function (workbox) { 'use strict';

  self.skipWaiting();
  workbox.clientsClaim();
  /**
   * The precacheAndRoute() method efficiently caches and responds to
   * requests for URLs in the manifest.
   * See https://goo.gl/S9QRab
   */
  workbox.precacheAndRoute([{
    "url": "registerSW.js",
    "revision": "1872c500de691dce40960bb85481de07"
  }, {
    "url": "pwa-maskable-512x512.png",
    "revision": "c2f03cdd611c50064522f2844fd65a81"
  }, {
    "url": "pwa-512x512.png",
    "revision": "c2f03cdd611c50064522f2844fd65a81"
  }, {
    "url": "pwa-192x192.png",
    "revision": "82b4031853ee773eaa7308b2612176a8"
  }, {
    "url": "index.html",
    "revision": "0033051856972e7d251bb8cc98205150"
  }, {
    "url": "icon.svg",
    "revision": "f5acbb8812031d22abcd9e16e6fcf567"
  }, {
    "url": "favicon.ico",
    "revision": "1c81368e91ec614a02d5342d9284562f"
  }, {
    "url": "apple-touch-icon.png",
    "revision": "4ff1ce6fb597529db8f4b8ab3e5306a6"
  }, {
    "url": "assets/index-BxvqccqG.css",
    "revision": null
  }, {
    "url": "assets/index-B68UND7h.js",
    "revision": null
  }, {
    "url": "apple-touch-icon.png",
    "revision": "4ff1ce6fb597529db8f4b8ab3e5306a6"
  }, {
    "url": "favicon.ico",
    "revision": "1c81368e91ec614a02d5342d9284562f"
  }, {
    "url": "icon.svg",
    "revision": "f5acbb8812031d22abcd9e16e6fcf567"
  }, {
    "url": "pwa-192x192.png",
    "revision": "82b4031853ee773eaa7308b2612176a8"
  }, {
    "url": "pwa-512x512.png",
    "revision": "c2f03cdd611c50064522f2844fd65a81"
  }, {
    "url": "pwa-maskable-512x512.png",
    "revision": "c2f03cdd611c50064522f2844fd65a81"
  }, {
    "url": "manifest.webmanifest",
    "revision": "b7f418d4ccc56f29b335e3e1731d368d"
  }], {});
  workbox.cleanupOutdatedCaches();
  workbox.registerRoute(new workbox.NavigationRoute(workbox.createHandlerBoundToURL("index.html")));

}));
