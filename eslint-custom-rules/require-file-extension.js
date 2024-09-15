export default {
  meta: {
    type: "problem",
    docs: {
      description: "Require file extensions in import statements",
      category: "Possible Errors",
      recommended: false,
    },
    schema: [], // No options
  },
  create(context) {
    return {
      ImportDeclaration(node) {
        const sourceValue = node.source.value;

        if (
          sourceValue.startsWith(".") &&
          !/\.[a-zA-Z0-9]+$/.test(sourceValue)
        ) {
          context.report({
            node,
            message:
              "Relative import statements must include a file extension (e.g., '.js').",
          });
        }
      },
    };
  },
};
