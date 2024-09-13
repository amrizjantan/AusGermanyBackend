const { defineConfig } = require("turbowatch");

export default defineConfig({
  project: __dirname,
  triggers: [
    {
      expression: ["match", "*.js", "basename"],
      name: "build",
      onChange: async ({ spawn }) => {
        await spawn`node index.js`;
      },
    },
  ],
});
