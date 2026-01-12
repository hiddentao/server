import { type DocumentNode, parse, visit } from "graphql"

/**
 * Extracts operation names that have the @auth directive
 * This runs at server startup time, no codegen needed
 */
export function extractAuthOperations(
  typeDefs: string | DocumentNode,
): string[] {
  const authOperations: string[] = []

  const ast = typeof typeDefs === "string" ? parse(typeDefs) : typeDefs

  visit(ast, {
    FieldDefinition: {
      enter(node, key, parent, path, ancestors) {
        // Find the parent ObjectTypeDefinition by looking at ancestors
        const parentType = ancestors.find(
          (ancestor) =>
            ancestor &&
            !Array.isArray(ancestor) &&
            typeof ancestor === "object" &&
            "kind" in ancestor &&
            ancestor.kind === "ObjectTypeDefinition",
        ) as any

        // Only look at Query and Mutation fields
        if (
          parentType &&
          parentType.name &&
          ["Query", "Mutation", "Subscription"].includes(parentType.name.value)
        ) {
          // Check if this field has the @auth directive
          const hasAuthDirective = node.directives?.some(
            (directive) => directive.name.value === "auth",
          )

          if (hasAuthDirective) {
            authOperations.push(node.name.value)
          }
        }
      },
    },
  })

  return authOperations
}

/**
 * Cache the extracted auth operations at startup
 */
export class AuthDirectiveHelper {
  private authOperations: string[] = []

  constructor(typeDefs: string | DocumentNode) {
    this.authOperations = extractAuthOperations(typeDefs)
  }

  /**
   * Check if an operation requires authentication
   */
  requiresAuth(operationName: string): boolean {
    return this.authOperations.includes(operationName)
  }

  /**
   * Get all auth-required operations
   */
  getAuthOperations(): string[] {
    return [...this.authOperations]
  }
}
