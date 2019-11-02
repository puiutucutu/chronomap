# chronomap

Provides functionality for syncing and interacting with a `leaflet` map and a `vis-timeline`. 

![screenshot](screenshots/screenshot.png)

## Docs

* https://puiutucutu.github.io/chronomap/

## Features

* sync leaflet marker layers with timeline groups
* synced layer toggling
* pan to timeline item on marker click
* pan map to marker on timeline item click
* hooks for manually panning timeline and map to marker
* does not bundle `leaflet` or `vis-timeline` dependencies making for a light build

## Use

### Browser

Import `chronomap.umd.js` and access it via the snake case `chronoMap` window global.

Since `leaflet` and `vis-timeline` are depenencies, they must be loaded before `chronoMap` so that the globals `L` and `vis` exist in the browser's namespace.

The snippet below clarifies this - see the full example at `./examples/browser/index.html`.

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>Chronomap - Browser UMD Example</title>
    <!-- Not Required -->
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/tachyons@4.11.1/css/tachyons.min.css"/>
    <!-- Required -->
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/leaflet@1.5.1/dist/leaflet.css"/>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/vis-timeline@6.1.0/dist/vis-timeline-graph2d.min.css"/>
    <script src="https://cdn.jsdelivr.net/npm/leaflet@1.5.1/dist/leaflet.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/vis-timeline@6.1.0/dist/vis-timeline-graph2d.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/chronomap@0.3.0/dist/chronomap.umd.js"></script>
  </head>
[...]
```

### Node

Only one export is provided via `./dist/chronomap.ejs.js`.  

See `./examples/node` for a standalone example.

#### Install

```
npm install chronomap
```

#### Importing and Usage

Similar to the `umd` build, the `ejs` build requires `leaflet` and `vis-timeline` to be imported seperately.

After importing `Chronomap`, your bundling tool is responsible for bundling the `leaflet` and `vis-timeline` dependencies.

```
import L from "leaflet";
import { Chronomap } from "chronomap";
[...]
```

Inside `chronomap.ejs.js`, the required imports from `vis-timeline` will be provided by your bundler.

```js
// inside `chronomap.ejs.js`
import { DataSet, Timeline } from 'vis-timeline';
```

### Development

```
npm run start
```

Outputs a bundled build in the `./development/dist` folder and serves the `./development/index.html` file locally. 

## Todo

- [ ] add tests 
- [x] reduce bundle size by making `leaflet` and `vis-timeline` external requirements
- [ ] extract functionality to interop with other mapping libraries
