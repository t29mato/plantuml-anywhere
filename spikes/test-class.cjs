require("@plantuml/core/viz-global.js");
const { renderToString } = require("@plantuml/core");

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
    console.error("SUCCESS SVG_LENGTH=" + svg.length);
    require("fs").writeFileSync("class-diagram.svg", svg);
  },
  (err) => {
    console.error("ERROR:", err);
    process.exit(1);
  }
);
