import { describe, it, expect } from "vitest";
import viteConfig from "../web/vite.config";

/**
 * Build verification test — validates that the Vite build configuration
 * produces the expected vendor chunk assignments for caching optimization.
 *
 * The project is pinned to Vite 6.4.3; manualChunks remains a Rollup function.
 * We test it by calling the function with representative module IDs.
 *
 */
describe("Vite build chunk splitting configuration", () => {
  const buildConfig = viteConfig.build;
  const rollupOptions = buildConfig?.rollupOptions;
  const outputConfig = rollupOptions?.output;

  // Normalize output to a single object (Rollup allows array or object)
  const output = Array.isArray(outputConfig)
    ? outputConfig[0]
    : outputConfig;

  const manualChunks = output?.manualChunks as unknown as
    | ((id: string) => string | undefined)
    | undefined;

  it("should define manualChunks as a function", () => {
    expect(manualChunks).toBeDefined();
    expect(typeof manualChunks).toBe("function");
  });

  it("should assign react, react-dom, and react-router-dom to vendor-react chunk", () => {
    expect(manualChunks!("/project/node_modules/react/index.js")).toBe("vendor-react");
    expect(manualChunks!("/project/node_modules/react-dom/client.js")).toBe("vendor-react");
    expect(manualChunks!("/project/node_modules/react-router-dom/index.js")).toBe("vendor-react");
  });

  it("should assign leaflet and react-leaflet to vendor-leaflet chunk", () => {
    expect(manualChunks!("/project/node_modules/leaflet/dist/leaflet.js")).toBe("vendor-leaflet");
    expect(manualChunks!("/project/node_modules/react-leaflet/lib/index.js")).toBe("vendor-leaflet");
  });

  it("should keep vendor chunks separate from each other", () => {
    // react modules should NOT go to vendor-leaflet
    expect(manualChunks!("/project/node_modules/react/index.js")).not.toBe("vendor-leaflet");
    // leaflet modules should NOT go to vendor-react
    expect(manualChunks!("/project/node_modules/leaflet/dist/leaflet.js")).not.toBe("vendor-react");
  });

  it("should not assign app-specific modules to any vendor chunk", () => {
    expect(manualChunks!("/project/src/App.tsx")).toBeUndefined();
    expect(manualChunks!("/project/src/components/MyComponent.tsx")).toBeUndefined();
  });

  it("should not publish source maps in production builds", () => {
    expect(buildConfig?.sourcemap).toBe(false);
  });

  it("should set chunkSizeWarningLimit to accommodate vendor chunks", () => {
    expect(buildConfig?.chunkSizeWarningLimit).toBeGreaterThanOrEqual(500);
  });
});
