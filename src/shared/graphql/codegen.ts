import type { CodegenConfig } from "@graphql-codegen/cli"
import path from "path"

const schema = path.join(__dirname, "schema.ts")
const fragments = path.join(__dirname, "fragments.ts")
const queries = path.join(__dirname, "queries.ts")
const mutations = path.join(__dirname, "mutations.ts")
const types = path.join(__dirname, "generated", "types.ts")

const config: CodegenConfig = {
  schema,
  documents: [fragments, queries, mutations],
  generates: {
    [types]: {
      config: {
        useIndexSignature: true,
        allowEnumStringTypes: true,
        printFieldsOnNewLines: true,
        useTypeImports: true,
        scalars: {
          DateTime: "Date | string",
          JSON: "any",
          PositiveInt: "number",
          BigInt: "bigint | string",
        },
        contextType: "any", // Will be overridden in server
        avoidOptionals: {
          field: true,
          inputValue: false,
          object: false,
          defaultValue: false,
        },
      },
      plugins: ["typescript", "typescript-resolvers"],
    },
  },
}

export default config
