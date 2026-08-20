import "@plantuml/core/viz-global.js";
import { renderToString } from "@plantuml/core";

if (location.pathname.endsWith(".puml")) {
  const sourceText = document.body.innerText;
  const lines = sourceText.split("\n");

  renderToString(
    lines,
    (svg) => {
      document.title = "PlantUML Preview (spike)";
      document.documentElement.innerHTML = "";
      const container = document.createElement("div");
      container.id = "plantuml-spike-result";
      container.innerHTML = svg;
      document.body ? document.body.appendChild(container) : document.documentElement.appendChild(container);
      if (!document.body) {
        const body = document.createElement("body");
        body.appendChild(container);
        document.documentElement.appendChild(body);
      }
    },
    (err) => {
      console.error("plantuml-spike render error:", err);
      const marker = document.createElement("div");
      marker.id = "plantuml-spike-error";
      marker.textContent = "RENDER_ERROR: " + err;
      document.documentElement.prepend(marker);
    }
  );
}
