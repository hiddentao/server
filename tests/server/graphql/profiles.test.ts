import { afterAll, beforeAll, beforeEach, describe, expect, it } from "bun:test"
import { createTestJWT } from "../../helpers/auth"
import {
  createTestUser,
  createTestUserAuth,
  createTestUserProfile,
  createTestUserWithProfile,
  setupTestDatabase,
} from "../../helpers/database"
import { testLogger } from "../../helpers/logger"
import {
  makeRequest,
  startTestServer,
  waitForServer,
} from "../../helpers/server"
import "../../setup"

describe("GraphQL Profiles", () => {
  let testServer: any
  let authToken: string
  let testUserId: number

  beforeAll(async () => {
    testServer = await startTestServer()
    await waitForServer(testServer.url)
  })

  beforeEach(async () => {
    await setupTestDatabase()

    const user = await createTestUser({
      web3Wallet: "0x1234567890123456789012345678901234567890",
    })
    testUserId = user.id

    authToken = await createTestJWT(user.id)
  })

  afterAll(async () => {
    if (testServer) {
      await testServer.shutdown()
    }
  })

  describe("createProfile", () => {
    it("should create a new profile", async () => {
      // Create phone auth for user (required for createProfile)
      await createTestUserAuth({
        userId: testUserId,
        authType: "PHONE",
        authIdentifier: "+6591234567",
      })

      const response = await makeRequest(`${testServer.url}/graphql`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          query: `
            mutation CreateProfile($username: String!, $ageRange: AgeRange, $occupation: String) {
              createProfile(username: $username, ageRange: $ageRange, occupation: $occupation) {
                id
                username
                ageRange
                occupation
                city
              }
            }
          `,
          variables: {
            username: "newuser123",
            ageRange: "AGE_25_34",
            occupation: "Software Engineer",
          },
        }),
      })

      const body = await response.json()
      expect(response.status).toBe(200)

      if (body.errors) {
        testLogger.error("createProfile failed:", body.errors)
        throw new Error(body.errors[0].message)
      }

      expect(body.data.createProfile).toBeDefined()
      expect(body.data.createProfile.username).toBe("newuser123")
      expect(body.data.createProfile.ageRange).toBe("AGE_25_34")
      expect(body.data.createProfile.occupation).toBe("Software Engineer")
      expect(body.data.createProfile.city).toBe("singapore")
    })

    it("should reject duplicate usernames", async () => {
      await createTestUserProfile({
        userId: testUserId,
        username: "existinguser",
      })

      const otherUser = await createTestUser({
        web3Wallet: "0xaabbccdd00000000000000000000000000000000",
      })

      // Add phone auth for the other user
      await createTestUserAuth({
        userId: otherUser.id,
        authType: "PHONE",
        authIdentifier: "+6598765432",
      })

      const otherToken = await createTestJWT(otherUser.id)

      const response = await makeRequest(`${testServer.url}/graphql`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${otherToken}`,
        },
        body: JSON.stringify({
          query: `
            mutation CreateProfile($username: String!) {
              createProfile(username: $username) {
                id
                username
              }
            }
          `,
          variables: {
            username: "existinguser",
          },
        }),
      })

      const body = await response.json()
      expect(response.status).toBe(200)
      expect(body.errors).toBeDefined()
      expect(body.errors[0].message.toLowerCase()).toContain("username")
    })
  })

  describe("getMyProfile", () => {
    it("should return current user profile", async () => {
      await createTestUserProfile({
        userId: testUserId,
        username: "testprofileuser",
        ageRange: "25-34",
        occupation: "Designer",
      })

      const response = await makeRequest(`${testServer.url}/graphql`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          query: `
            query GetMyProfile {
              getMyProfile {
                id
                username
                ageRange
                occupation
                city
              }
            }
          `,
        }),
      })

      const body = await response.json()
      expect(response.status).toBe(200)

      if (body.errors) {
        testLogger.error("getMyProfile failed:", body.errors)
        throw new Error(body.errors[0].message)
      }

      expect(body.data.getMyProfile).toBeDefined()
      expect(body.data.getMyProfile.username).toBe("testprofileuser")
      expect(body.data.getMyProfile.ageRange).toBe("AGE_25_34")
      expect(body.data.getMyProfile.occupation).toBe("Designer")
    })

    it("should return null for user without profile", async () => {
      const response = await makeRequest(`${testServer.url}/graphql`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          query: `
            query GetMyProfile {
              getMyProfile {
                id
                username
              }
            }
          `,
        }),
      })

      const body = await response.json()
      expect(response.status).toBe(200)

      if (body.errors) {
        testLogger.error("getMyProfile failed:", body.errors)
        throw new Error(body.errors[0].message)
      }

      expect(body.data.getMyProfile).toBeNull()
    })
  })

  describe("getProfileByUsername", () => {
    it("should return profile by username", async () => {
      await createTestUserWithProfile({
        username: "lookupuser",
        web3Wallet: "0xaabbccdd00000000000000000000000000000000",
      })

      const response = await makeRequest(`${testServer.url}/graphql`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          query: `
            query GetProfileByUsername($username: String!) {
              getProfileByUsername(username: $username) {
                id
                username
                city
              }
            }
          `,
          variables: {
            username: "lookupuser",
          },
        }),
      })

      const body = await response.json()
      expect(response.status).toBe(200)

      if (body.errors) {
        testLogger.error("getProfileByUsername failed:", body.errors)
        throw new Error(body.errors[0].message)
      }

      expect(body.data.getProfileByUsername).toBeDefined()
      expect(body.data.getProfileByUsername.username).toBe("lookupuser")
    })

    it("should return null for non-existent username", async () => {
      const response = await makeRequest(`${testServer.url}/graphql`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          query: `
            query GetProfileByUsername($username: String!) {
              getProfileByUsername(username: $username) {
                id
              }
            }
          `,
          variables: {
            username: "nonexistentuser",
          },
        }),
      })

      const body = await response.json()
      expect(response.status).toBe(200)
      expect(body.data.getProfileByUsername).toBeNull()
    })
  })

  describe("updateProfile", () => {
    it("should update profile fields", async () => {
      await createTestUserProfile({
        userId: testUserId,
        username: "updateuser",
        occupation: "Old Occupation",
      })

      const response = await makeRequest(`${testServer.url}/graphql`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          query: `
            mutation UpdateProfile($input: UpdateProfileInput!) {
              updateProfile(input: $input) {
                id
                username
                occupation
                ageRange
              }
            }
          `,
          variables: {
            input: {
              occupation: "New Occupation",
              ageRange: "AGE_35_44",
            },
          },
        }),
      })

      const body = await response.json()
      expect(response.status).toBe(200)

      if (body.errors) {
        testLogger.error("updateProfile failed:", body.errors)
        throw new Error(body.errors[0].message)
      }

      expect(body.data.updateProfile).toBeDefined()
      expect(body.data.updateProfile.username).toBe("updateuser")
      expect(body.data.updateProfile.occupation).toBe("New Occupation")
      expect(body.data.updateProfile.ageRange).toBe("AGE_35_44")
    })
  })

  describe("Authentication", () => {
    it("should reject unauthenticated requests", async () => {
      const response = await makeRequest(`${testServer.url}/graphql`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: `
            query GetMyProfile {
              getMyProfile {
                id
              }
            }
          `,
        }),
      })

      const body = await response.json()
      expect(response.status).toBe(200)
      expect(body.errors).toBeDefined()
      expect(body.errors[0].extensions?.code).toBe("UNAUTHORIZED")
    })
  })
})
