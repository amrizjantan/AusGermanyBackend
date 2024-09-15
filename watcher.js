import { defineConfig } from "turbowatch";

export default defineConfig({
  project: __dirname,
  triggers: [
    {
      expression: ["match", "*.js", "basename"],
      name: "build",
      onChange: async ({ spawn }) => {
        await spawn`node --env-file=.env index.js`;
      },
    },
  ],
});
