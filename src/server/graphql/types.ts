import type {
  Resolvers as GeneratedResolvers,
  ResolversParentTypes,
  ResolversTypes,
} from "../../shared/graphql/generated/types"
import type { AuthenticatedUser } from "../auth"
import type { ServerApp } from "../types"

export interface GraphQLContext {
  serverApp: ServerApp
  user?: AuthenticatedUser
  operationName?: string
  requiresAuth?: boolean
}

// Re-export with proper context
export type Resolvers = GeneratedResolvers<GraphQLContext>
export type QueryResolvers = GeneratedResolvers<GraphQLContext>["Query"]
export type MutationResolvers = GeneratedResolvers<GraphQLContext>["Mutation"]

// Re-export commonly used types
export type { ResolversTypes, ResolversParentTypes }
