import "@plantuml/core/viz-global.js";
import { renderToString } from "@plantuml/core";

const puml = [
  "@startuml",
  "class Animal {",
  "  +name: String",
  "  +makeSound()",
  "}",
  "class Dog {",
  "  +bark()",
  "}",
  "class Engine {",
  "  +horsepower: int",
  "}",
  "Animal <|-- Dog",
  "Dog *-- Engine",
  "@enduml",
];

renderToString(
  puml,
  (svg) => {
    console.log("SUCCESS");
    console.log("SVG_LENGTH:", svg.length);
    process.stdout.write(svg);
  },
  (err) => {
    console.log("ERROR:", err);
    process.exit(1);
  }
);
