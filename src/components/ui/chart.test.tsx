import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ChartStyle, type ChartConfig } from "@/components/ui/chart";

describe("ChartStyle sanitization", () => {
  it("sanitizes malicious key/color payloads before injecting CSS", () => {
    const config: ChartConfig = {
      safe_series: { color: "#123abc" },
      "evil}body{background:red/*": { color: "red; } body { display:block;" },
      "another';}@media all{": {
        theme: {
          light: "rgb(10, 20, 30)",
          dark: "var(--safe-token)",
        },
      },
      clean_but_bad_color: { color: "url(javascript:alert(1))" },
    };

    const { container } = render(<ChartStyle id={'chart-1"]}body{color:red/*'} config={config} />);

    const cssOutput = container.querySelector("style")?.innerHTML;

    expect(cssOutput).toBeTruthy();
    expect(cssOutput).toContain('[data-chart="chart-1bodycolorred"]');
    expect(cssOutput).toContain("--color-safe_series: #123abc;");
    expect(cssOutput).not.toContain("--color-evilbodybackgroundred:");
    expect(cssOutput).toContain("--color-anothermediaall: rgb(10, 20, 30);");

    expect(cssOutput).not.toContain("url(javascript:");
    expect(cssOutput).not.toContain("display:block");
    expect(cssOutput).not.toContain("@media all");
    expect(cssOutput).not.toContain("body{");
    expect(cssOutput).not.toContain("};");
  });
});
