import { makeExecutableSchema } from "@graphql-tools/schema"
import { Elysia } from "elysia"
import { GraphQLError, type OperationDefinitionNode, parse } from "graphql"
import { createYoga } from "graphql-yoga"
import { serverConfig } from "../../shared/config/server"
import { AuthDirectiveHelper } from "../../shared/graphql/auth-extractor"
import { GraphQLErrorCode } from "../../shared/graphql/errors"
import { defaultResolvers } from "../../shared/graphql/resolvers"
import { typeDefs } from "../../shared/graphql/schema"
import { AuthService } from "../auth"
import { LOG_CATEGORIES } from "../lib/logger"
import type { ServerApp } from "../types"
import { createResolvers } from "./resolvers"

export const createGraphQLHandler = (serverApp: ServerApp) => {
  const logger = serverApp.createLogger(LOG_CATEGORIES.GRAPHQL)
  const authService = new AuthService(serverApp)

  // Create auth directive helper
  const authHelper = new AuthDirectiveHelper(typeDefs)
  logger.info(`Auth operations: ${authHelper.getAuthOperations().join(", ")}`)

  // Create executable schema
  const schema = makeExecutableSchema({
    typeDefs,
    resolvers: {
      ...defaultResolvers,
      ...createResolvers(serverApp),
    },
  })

  const yoga = createYoga({
    schema,
    cors: false, // Disable Yoga's CORS since Elysia handles it
    graphiql: true,
    maskedErrors: serverConfig.NODE_ENV === "production",
    plugins: [
      {
        onResultProcess: ({ result, setResult }) => {
          // Ensure GraphQL spec compliance: data field should be null when there are errors
          if (Array.isArray(result)) {
            // Handle batched queries
            const processedResults = result.map((r: any) => {
              if (r.errors && r.errors.length > 0 && r.data === undefined) {
                return { ...r, data: null }
              }
              return r
            })
            setResult(processedResults)
          } else {
            // Handle single query
            const singleResult = result as any
            if (
              singleResult.errors &&
              singleResult.errors.length > 0 &&
              singleResult.data === undefined
            ) {
              setResult({
                ...singleResult,
                data: null,
              })
            }
          }
        },
      },
    ],
    context: async ({ request, params }) => {
      // Debug request headers
      logger.debug(`Incoming request: ${request.method} ${request.url}`)
      logger.debug(
        `Authorization header: ${request.headers.get("Authorization")}`,
      )

      // GraphQL operations require POST, but allow GET for GraphiQL
      const isGraphQLOperation = request.method === "POST"
      const isGraphiQLRequest = request.method === "GET"

      if (!isGraphQLOperation && !isGraphiQLRequest) {
        throw new Error(
          `GraphQL endpoint only supports GET (GraphiQL) and POST requests, received ${request.method}`,
        )
      }

      // Extract operation name and check if any field requires auth
      let operationName: string | undefined
      let requiresAuth = false

      // Skip auth checks for GraphiQL GET requests
      if (isGraphiQLRequest) {
        operationName = "graphiql"
        requiresAuth = false
      } else if (params?.operationName) {
        operationName = params.operationName
        requiresAuth = authHelper.requiresAuth(operationName)
        logger.debug(`Operation name from params: ${operationName}`)
      } else if (params?.query) {
        // Use GraphQL's parse function to extract all field names
        try {
          const document = parse(params.query)
          const operation = document.definitions[0] as OperationDefinitionNode

          // Check all selections in the query
          const fieldNames: string[] = []
          for (const selection of operation.selectionSet.selections) {
            if (selection.kind === "Field" && selection.name?.value) {
              fieldNames.push(selection.name.value)
            }
          }

          // Use the first field name as the operation name for logging
          operationName = fieldNames[0]

          // Check if ANY field requires auth - if so, require auth for entire query
          requiresAuth = fieldNames.some((fieldName) =>
            authHelper.requiresAuth(fieldName),
          )

          logger.debug(`Operation name extracted from query: ${operationName}`)
          logger.debug(`Query fields: [${fieldNames.join(", ")}]`)
        } catch (error) {
          logger.error(
            `Failed to parse GraphQL query for operation name:`,
            error,
          )
          throw new Error("Invalid GraphQL query: unable to parse operation")
        }
      }

      if (!operationName) {
        logger.error("No operation name found in GraphQL request")
        throw new Error("Invalid GraphQL request: no operation name found")
      }

      logger.debug(`Operation requires auth: ${requiresAuth}`)

      let user: any = null

      // Always try to authenticate if Authorization header is present
      const authHeader = request.headers.get("Authorization")
      if (authHeader) {
        logger.debug(`Authorization header present, attempting authentication`)
        try {
          user = await authService.authenticateRequest(request)
          logger.debug(
            `User authenticated: ${user.id}${user.web3Wallet ? ` (${user.web3Wallet})` : ""}`,
          )
        } catch (error) {
          // If auth is required and authentication failed, throw error
          if (requiresAuth) {
            logger.debug(
              `Auth required for operation ${operationName} but authentication failed:`,
              error instanceof Error ? error.message : String(error),
            )
            throw error // Re-throw the GraphQLError from AuthService
          }
          // If auth is not required but token was invalid, just log it
          logger.debug(
            `Optional authentication failed for operation ${operationName}:`,
            error instanceof Error ? error.message : String(error),
          )
          user = null
        }
      } else if (requiresAuth) {
        // No auth header but auth is required
        logger.debug(
          `Auth required for operation ${operationName} but no Authorization header`,
        )
        throw new GraphQLError("Authentication required", {
          extensions: { code: GraphQLErrorCode.UNAUTHORIZED },
        })
      }

      return {
        serverApp,
        user,
        operationName,
        requiresAuth,
      }
    },
    logging: {
      debug: (...args) => logger.debug(args.join(" ")),
      info: (...args) => logger.info(args.join(" ")),
      warn: (...args) => logger.warn(args.join(" ")),
      error: (...args) => logger.error(args.join(" ")),
    },
  })

  return new Elysia()
    .get("/graphql", ({ request }) => yoga.fetch(request)) // For GraphiQL
    .post("/graphql", ({ request }) => yoga.fetch(request))
}
