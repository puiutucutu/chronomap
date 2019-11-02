import commonjs from "rollup-plugin-commonjs";
import babel from "rollup-plugin-babel";
import resolve from "rollup-plugin-node-resolve";
import serve from "rollup-plugin-serve";
import pkg from "./package.json";

const babelPlugin = [
  babel({
    exclude: "node_modules/**"
  })
];

module.exports = [
  {
    external: ["leaflet"],
    input: "src/index.js",
    output: [
      { file: `development/${pkg.module}`, format: "esm", sourcemap: true }
    ],
    plugins: [
      ...babelPlugin,
      resolve(),
      commonjs(),
      serve({
        contentBase: ["development"]
      })
    ]
  },
  {
    external: ["leaflet", "vis-timeline"],
    input: "src/index.js",
    output: {
      file: `development/${pkg.browser}`,
      format: "umd",
      name: "chronoMap",
      sourcemap: true,
      globals: {
        "leaflet": "L",
        "vis-timeline": "vis"
      }
    },
    plugins: [...babelPlugin, resolve(), commonjs()]
  }
];
