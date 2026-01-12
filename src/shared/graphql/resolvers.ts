// Recommended by: https://the-guild.dev/graphql/scalars/docs/scalars/big-int
import "json-bigint-patch"

import {
  GraphQLBigInt,
  GraphQLDateTime,
  GraphQLJSON,
  GraphQLPositiveInt,
} from "graphql-scalars"

export const defaultResolvers = {
  // Scalar resolvers
  BigInt: GraphQLBigInt,
  DateTime: GraphQLDateTime,
  JSON: GraphQLJSON,
  PositiveInt: GraphQLPositiveInt,
}
