import node from "rollup-plugin-node-resolve";

export default {
  entry: "./src/index.js",
  format: "umd",
  moduleName: "canvasDragSelector",
  plugins: [node()],
  dest: "index.js"
};