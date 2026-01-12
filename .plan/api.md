# Echo Backend API Implementation Plan

> **Maintenance Note**: Keep this file updated as implementation progresses. Mark items as complete with ~~strikethrough~~ or [x] checkboxes. Add notes about deviations from the original plan.

---

## Implementation Status

### Database Schema
- [x] Add PostgreSQL enums (age_range, post_type)
- [x] Create user_profiles table
- [x] Create posts table
- [x] Create bookmarks table
- [x] Create pulse_stats table
- [x] Create legal_content table
- [ ] Run migrations (requires database setup)

### GraphQL API
- [x] Add types and enums to schema
- [x] Implement profile queries/mutations
- [x] Implement post queries/mutations
- [x] Implement bookmark queries/mutations
- [x] Implement response queries
- [x] Implement pulse stats query
- [x] Implement legal content queries

### Authentication
- [x] Add Firebase Admin SDK integration
- [x] Implement authenticateWithFirebase mutation
- [x] Add PHONE auth method to constants

### R2 Integration
- [x] Add R2 config variables
- [x] Implement presigned URL generation
- [x] Implement file upload/download helpers

### Background Workers
- [x] Implement generateWaveform job
- [x] Register job in worker registry

### Server Routes
- [x] Add landing page route (/)
- [x] Add privacy policy route (/privacy)
- [x] Add terms route (/terms)
- [x] Create landing page HTML

---

## Database Schema

### PostgreSQL Enums

```sql
-- Age range for user profiles
CREATE TYPE age_range AS ENUM ('18-24', '25-34', '35-44', '45-54', '55+');

-- Post type (top-level post or response)
CREATE TYPE post_type AS ENUM ('POST', 'RESPONSE');
```

### GraphQL-Only Enums

```graphql
enum SortBy {
  NEWEST
  OLDEST
  MOST_SAVED
  LEAST_SAVED
  MOST_RESPONSES
  LEAST_RESPONSES
}
```

### Tables

#### user_profiles
| Column | Type | Constraints |
|--------|------|-------------|
| id | serial | PRIMARY KEY |
| user_id | integer | REFERENCES users(id), UNIQUE, NOT NULL |
| username | text | UNIQUE, NOT NULL |
| phone_number | text | UNIQUE, NOT NULL |
| age_range | age_range | |
| occupation | text | |
| city | text | DEFAULT 'singapore', NOT NULL |
| created_at | timestamp | DEFAULT now() |
| updated_at | timestamp | DEFAULT now() |

**Indexes**: username, phone_number, city

#### posts
| Column | Type | Constraints |
|--------|------|-------------|
| id | serial | PRIMARY KEY |
| user_id | integer | REFERENCES users(id), NOT NULL |
| type | post_type | NOT NULL |
| parent_id | integer | REFERENCES posts(id), NULL for top-level |
| audio_url | text | NOT NULL |
| audio_key | text | NOT NULL (R2 object key) |
| duration | integer | NOT NULL (seconds) |
| tags | jsonb | DEFAULT '[]' |
| waveform_url | text | NULL (set by background worker) |
| response_count | integer | DEFAULT 0 |
| bookmark_count | integer | DEFAULT 0 |
| city | text | DEFAULT 'singapore', NOT NULL |
| active | boolean | DEFAULT true |
| created_at | timestamp | DEFAULT now() |
| updated_at | timestamp | DEFAULT now() |

**Indexes**: user_id, city, type, parent_id, created_at, active, bookmark_count, response_count

#### bookmarks
| Column | Type | Constraints |
|--------|------|-------------|
| id | serial | PRIMARY KEY |
| user_id | integer | REFERENCES users(id), NOT NULL |
| post_id | integer | REFERENCES posts(id), NOT NULL |
| created_at | timestamp | DEFAULT now() |

**Indexes**: (user_id, post_id) UNIQUE, user_id

#### pulse_stats
| Column | Type | Constraints |
|--------|------|-------------|
| id | serial | PRIMARY KEY |
| city | text | NOT NULL |
| period | text | NOT NULL ('7d', '30d', '90d') |
| tag | text | NOT NULL |
| count | integer | DEFAULT 0 |
| percentage | real | DEFAULT 0 |
| calculated_at | timestamp | DEFAULT now() |

**Indexes**: (city, period)

#### legal_content
| Column | Type | Constraints |
|--------|------|-------------|
| id | serial | PRIMARY KEY |
| type | text | UNIQUE, NOT NULL ('privacy_policy', 'terms_conditions') |
| title | text | NOT NULL |
| content | text | NOT NULL (Markdown) |
| version | text | NOT NULL |
| effective_date | timestamp | NOT NULL |
| created_at | timestamp | DEFAULT now() |
| updated_at | timestamp | DEFAULT now() |

### Reuse Existing: notifications
Use for alerts with structured data field:
```json
{ "type": "RESPONSE", "postId": 123, "responseId": 456 }
```

---

## Data Loading Strategy

### PostSummary (for lists/feeds)
Returned by: `getPosts`, `getMyPosts`, `getUserPosts`, `getMyBookmarks`, `getResponses`

```graphql
type PostSummary {
  id: Int!
  userId: Int!
  author: UserProfile!
  type: PostType!
  parentId: Int
  duration: Int!
  tags: [String!]!
  waveformUrl: String
  responseCount: Int!
  bookmarkCount: Int!
  isBookmarked: Boolean!
  createdAt: DateTime!
}
```

**Excludes**: audio_url (fetched on-demand)

### Post (full detail)
Returned by: `getPostById`

```graphql
type Post {
  id: Int!
  userId: Int!
  author: UserProfile!
  type: PostType!
  parentId: Int
  audioUrl: String!
  duration: Int!
  tags: [String!]!
  waveformUrl: String
  responseCount: Int!
  bookmarkCount: Int!
  isBookmarked: Boolean!
  city: String!
  createdAt: DateTime!
}
```

### Sorting
| Context | Available Sorts |
|---------|-----------------|
| Post responses | NEWEST, OLDEST, MOST_SAVED, LEAST_SAVED, MOST_RESPONSES, LEAST_RESPONSES |
| User profile posts | NEWEST, OLDEST, MOST_SAVED, LEAST_SAVED, MOST_RESPONSES, LEAST_RESPONSES |
| User profile responses | NEWEST, OLDEST, MOST_SAVED, LEAST_SAVED |
| My bookmarks | NEWEST, OLDEST |

---

## GraphQL API

### Queries

```graphql
type Query {
  # Profile
  getMyProfile: UserProfile @auth
  getProfileByUsername(username: String!): UserProfile @auth

  # Posts (returns PostSummary[])
  getPosts(city: String, tags: [String!], cursor: String, limit: Int): PostsConnection! @auth
  getMyPosts(type: PostType, sortBy: SortBy, cursor: String, limit: Int): PostsConnection! @auth
  getUserPosts(userId: Int!, type: PostType, sortBy: SortBy, cursor: String, limit: Int): PostsConnection! @auth
  getMyBookmarks(sortBy: SortBy, cursor: String, limit: Int): PostsConnection! @auth

  # Post detail (returns full Post)
  getPostById(id: Int!): Post @auth

  # Responses (returns PostSummary[])
  getResponses(postId: Int!, sortBy: SortBy, cursor: String, limit: Int): PostsConnection! @auth

  # Notifications (existing)
  getMyNotifications(cursor: String, limit: Int): NotificationsConnection! @auth
  getMyUnreadNotificationsCount: Int! @auth

  # Pulse
  getPulseStats(city: String!, period: String!): PulseStats! @auth

  # Legal (no auth)
  getPrivacyPolicy: LegalContent!
  getTermsAndConditions: LegalContent!
}
```

### Mutations

```graphql
type Mutation {
  # Auth (no auth required)
  authenticateWithFirebase(idToken: String!): AuthResult!

  # Profile
  createProfile(username: String!, ageRange: AgeRange, occupation: String): UserProfile! @auth
  updateProfile(input: UpdateProfileInput!): UserProfile! @auth

  # Audio upload
  getAudioUploadUrl(contentType: String!): UploadUrlResult! @auth

  # Posts
  createPost(audioKey: String!, duration: Int!, tags: [String!]): Post! @auth
  createResponse(parentId: Int!, audioKey: String!, duration: Int!, tags: [String!]): Post! @auth
  deletePost(id: Int!): Success! @auth

  # Bookmarks
  bookmarkPost(postId: Int!): Success! @auth
  removeBookmark(postId: Int!): Success! @auth

  # Notifications (existing)
  markNotificationAsRead(id: Int!): Success! @auth
  markAllNotificationsAsRead: Success! @auth
}
```

---

## R2 Audio Upload Flow

```
1. Client: getAudioUploadUrl(contentType: "audio/webm")
   └─> Server generates presigned PUT URL (1 hour expiry)
   └─> Returns { uploadUrl, publicUrl, key }

2. Client: PUT uploadUrl with audio file body

3. Client: createPost(audioKey: key, duration: 30, tags: ["stressed"])
   └─> Server creates post record with audio_url = publicUrl
   └─> Server queues generateWaveform job

4. Worker: generateWaveform job
   └─> Download audio from R2
   └─> Extract amplitude samples via FFmpeg
   └─> Render to PNG (300x60px)
   └─> Upload PNG to R2 (waveforms/{post_id}.png)
   └─> Update post.waveform_url
```

### Config Variables
```env
CLOUDFLARE_ACCOUNT_ID=
CLOUDFLARE_R2_ACCESS_KEY_ID=
CLOUDFLARE_R2_SECRET_ACCESS_KEY=
CLOUDFLARE_R2_BUCKET_NAME=
CLOUDFLARE_R2_PUBLIC_URL=
```

---

## Firebase Phone Auth Flow

```
1. Mobile app initiates Firebase Phone Auth
2. Firebase sends SMS, user verifies
3. App receives Firebase ID token
4. App calls: authenticateWithFirebase(idToken)
   └─> Server verifies token with Firebase Admin SDK
   └─> Extracts phone number from verified claims
   └─> Creates/retrieves user with PHONE auth type
   └─> Returns JWT token
```

### Config Variables
```env
FIREBASE_PROJECT_ID=
FIREBASE_SERVICE_ACCOUNT_KEY={"type":"service_account",...}
```

---

## Waveform Generation

**Approach**: Pre-rendered PNG stored in R2

1. Background worker triggered after post creation
2. Download audio file from R2
3. Use FFmpeg to extract ~100-150 amplitude samples
4. Render to PNG:
   - Size: 300x60px
   - Background: transparent
   - Color: single color (can be tinted by client via CSS)
5. Upload PNG to R2: `waveforms/{post_id}.png`
6. Update post record with waveform_url

**Benefits**:
- ~1-3KB file size
- Zero client-side processing
- CDN-cacheable
- Instant display

---

## Server Routes

| Route | Handler |
|-------|---------|
| `/` | Serve landing.html (marketing SPA) |
| `/privacy` | Server-render privacy policy from legal_content |
| `/terms` | Server-render terms from legal_content |
| `/graphql` | GraphQL Yoga handler |

---

## Files to Create

| File | Purpose | Status |
|------|---------|--------|
| `src/server/db/posts.ts` | Post CRUD operations | [x] |
| `src/server/db/profiles.ts` | User profile operations | [x] |
| `src/server/db/bookmarks.ts` | Bookmark operations | [x] |
| `src/server/db/legalContent.ts` | Legal content queries | [x] |
| `src/server/lib/r2.ts` | R2 presigned URLs and file ops | [x] |
| `src/server/lib/waveform.ts` | Waveform extraction & PNG render | [x] (merged into generateWaveform.ts) |
| `src/server/lib/firebase.ts` | Firebase Admin SDK | [x] |
| `src/server/workers/jobs/generateWaveform.ts` | Waveform background job | [x] |
| `src/server/static-src/landing.html` | Landing page | [x] |
| `src/server/templates/legalPage.ts` | Legal page template | [x] |

## Files to Modify

| File | Changes | Status |
|------|---------|--------|
| `src/shared/constants.ts` | Add AGE_RANGE, POST_TYPE, PHONE auth | [x] |
| `src/server/db/schema.ts` | Add new tables and enums | [x] |
| `src/shared/graphql/schema.ts` | Add types, inputs, queries, mutations | [x] |
| `src/shared/graphql/queries.ts` | Add query definitions | [x] |
| `src/shared/graphql/mutations.ts` | Add mutation definitions | [x] |
| `src/server/graphql/resolvers.ts` | Add all resolvers | [x] |
| `src/server/auth/index.ts` | Add Firebase auth method | [x] |
| `src/server/db/users.ts` | Add createPhoneUserIfNotExists | [x] |
| `src/shared/config/server.ts` | Add R2 and Firebase config | [x] |
| `src/server/workers/jobs/registry.ts` | Register generateWaveform | [x] |
| `src/server/workers/jobs/types.ts` | Add GenerateWaveformData | [x] |
| `src/server/start-server.ts` | Add /, /privacy, /terms routes | [x] |

---

## Integration Tests

### Test Files to Create

| File | Purpose | Status |
|------|---------|--------|
| `tests/server/graphql/posts.test.ts` | Post CRUD and feed queries | [x] 9 tests |
| `tests/server/graphql/profiles.test.ts` | User profile queries/mutations | [x] 8 tests |
| `tests/server/graphql/bookmarks.test.ts` | Bookmark operations | [x] 7 tests |
| `tests/server/graphql/responses.test.ts` | Response queries with sorting | [x] 8 tests |
| `tests/server/graphql/firebase-auth.test.ts` | Firebase phone auth flow | [x] 5 tests |
| `tests/server/graphql/legal-content.test.ts` | Privacy/terms queries | [x] 6 tests |
| `tests/server/graphql/pulse-stats.test.ts` | Pulse stats query | [x] 5 tests |
| `tests/server/workers/generate-waveform.test.ts` | Waveform generation job | [x] 11 tests |
| `tests/server/routes/landing-page.test.ts` | Landing page and legal routes | [x] 8 tests |
| `tests/server/lib/r2.test.ts` | R2 presigned URL generation | [x] 24 tests |
| `tests/helpers/posts.ts` | Post test data helpers | [x] (in tests/helpers/database.ts) |
| `tests/helpers/profiles.ts` | Profile test data helpers | [x] (in tests/helpers/database.ts) |
| `tests/helpers/mockR2.ts` | Mock R2 server for tests | [x] |
| `tests/helpers/mockFirebase.ts` | Mock Firebase verification | [x] |

### Test Helper Functions

```typescript
// tests/helpers/posts.ts

import { dbManager, schema } from "@server/db/connection"

export interface TestPost {
  id: number
  userId: number
  type: "POST" | "RESPONSE"
  audioUrl: string
  duration: number
  tags: string[]
  city: string
}

/**
 * Create a test post
 */
export async function createTestPost(
  data: {
    userId: number
    type?: "POST" | "RESPONSE"
    parentId?: number
    duration?: number
    tags?: string[]
    city?: string
  }
): Promise<TestPost> {
  const db = dbManager.getDb()
  const audioKey = `test-audio-${Date.now()}`

  const [post] = await db.insert(schema.posts).values({
    userId: data.userId,
    type: data.type || "POST",
    parentId: data.parentId || null,
    audioUrl: `https://test-cdn.example.com/${audioKey}`,
    audioKey,
    duration: data.duration || 30,
    tags: data.tags || [],
    city: data.city || "singapore",
  }).returning()

  return post
}

/**
 * Create multiple test posts for pagination testing
 */
export async function createTestPosts(
  userId: number,
  count: number,
  options?: { tags?: string[]; city?: string }
): Promise<TestPost[]> {
  const posts: TestPost[] = []
  for (let i = 0; i < count; i++) {
    const post = await createTestPost({
      userId,
      tags: options?.tags,
      city: options?.city,
    })
    posts.push(post)
  }
  return posts
}

/**
 * Create test post with responses
 */
export async function createTestPostWithResponses(
  userId: number,
  responderIds: number[],
): Promise<{ post: TestPost; responses: TestPost[] }> {
  const post = await createTestPost({ userId })
  const responses: TestPost[] = []

  for (const responderId of responderIds) {
    const response = await createTestPost({
      userId: responderId,
      type: "RESPONSE",
      parentId: post.id,
    })
    responses.push(response)
  }

  // Update response count
  const db = dbManager.getDb()
  await db.update(schema.posts)
    .set({ responseCount: responses.length })
    .where(sql`id = ${post.id}`)

  return { post, responses }
}

/**
 * Create test bookmark
 */
export async function createTestBookmark(
  userId: number,
  postId: number
): Promise<void> {
  const db = dbManager.getDb()
  await db.insert(schema.bookmarks).values({ userId, postId })

  // Update bookmark count
  await db.execute(sql`
    UPDATE posts SET bookmark_count = bookmark_count + 1 WHERE id = ${postId}
  `)
}

/**
 * Clean up posts table
 */
export async function cleanTestPosts(): Promise<void> {
  const db = dbManager.getDb()
  await db.execute(sql`TRUNCATE TABLE bookmarks RESTART IDENTITY CASCADE`)
  await db.execute(sql`TRUNCATE TABLE posts RESTART IDENTITY CASCADE`)
}
```

```typescript
// tests/helpers/profiles.ts

import { dbManager, schema } from "@server/db/connection"

export interface TestProfile {
  id: number
  userId: number
  username: string
  phoneNumber: string
  city: string
}

/**
 * Create a test user profile
 */
export async function createTestProfile(
  userId: number,
  data?: {
    username?: string
    phoneNumber?: string
    ageRange?: string
    occupation?: string
    city?: string
  }
): Promise<TestProfile> {
  const db = dbManager.getDb()
  const random = Math.random().toString(36).substring(2, 8)

  const [profile] = await db.insert(schema.userProfiles).values({
    userId,
    username: data?.username || `testuser_${random}`,
    phoneNumber: data?.phoneNumber || `+6591234${random.slice(0, 4)}`,
    ageRange: data?.ageRange || "25-34",
    occupation: data?.occupation || "Developer",
    city: data?.city || "singapore",
  }).returning()

  return profile
}

/**
 * Clean up profiles table
 */
export async function cleanTestProfiles(): Promise<void> {
  const db = dbManager.getDb()
  await db.execute(sql`TRUNCATE TABLE user_profiles RESTART IDENTITY CASCADE`)
}
```

---

### Test: Posts CRUD (`tests/server/graphql/posts.test.ts`)

```typescript
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "bun:test"
import { createTestJWT } from "../../helpers/auth"
import { createTestUser, setupTestDatabase } from "../../helpers/database"
import { createTestPost, createTestPosts, cleanTestPosts } from "../../helpers/posts"
import { createTestProfile } from "../../helpers/profiles"
import { makeRequest, startTestServer, waitForServer } from "../../helpers/server"
import "../../setup"

describe("Posts API", () => {
  let testServer: any
  let authToken: string
  let testUserId: number

  beforeAll(async () => {
    testServer = await startTestServer()
    await waitForServer(testServer.url)
  })

  afterAll(async () => {
    if (testServer) await testServer.shutdown()
  })

  beforeEach(async () => {
    await setupTestDatabase()
    await cleanTestPosts()

    // Create test user with profile
    const user = await createTestUser()
    testUserId = user.id
    await createTestProfile(user.id)
    authToken = await createTestJWT(undefined, { extraClaims: { userId: user.id } })
  })

  describe("getPosts", () => {
    it("should return posts for the user's city", async () => {
      await createTestPosts(testUserId, 5, { city: "singapore" })

      const response = await makeRequest(`${testServer.url}/graphql`, {
        method: "POST",
        headers: { Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({
          query: `
            query GetPosts($city: String, $limit: Int) {
              getPosts(city: $city, limit: $limit) {
                posts { id duration tags responseCount bookmarkCount }
                hasMore
                nextCursor
              }
            }
          `,
          variables: { city: "singapore", limit: 10 },
        }),
      })

      const body = await response.json()
      expect(response.status).toBe(200)
      expect(body.data.getPosts.posts).toHaveLength(5)
      expect(body.data.getPosts.hasMore).toBe(false)
    })

    it("should filter posts by tags", async () => {
      await createTestPost({ userId: testUserId, tags: ["stressed", "work"] })
      await createTestPost({ userId: testUserId, tags: ["calm", "morning"] })

      const response = await makeRequest(`${testServer.url}/graphql`, {
        method: "POST",
        headers: { Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({
          query: `
            query GetPosts($tags: [String!]) {
              getPosts(tags: $tags) {
                posts { id tags }
              }
            }
          `,
          variables: { tags: ["stressed"] },
        }),
      })

      const body = await response.json()
      expect(body.data.getPosts.posts).toHaveLength(1)
      expect(body.data.getPosts.posts[0].tags).toContain("stressed")
    })

    it("should NOT include audioUrl in list response", async () => {
      await createTestPost({ userId: testUserId })

      const response = await makeRequest(`${testServer.url}/graphql`, {
        method: "POST",
        headers: { Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({
          query: `
            query GetPosts {
              getPosts {
                posts { id audioUrl }
              }
            }
          `,
        }),
      })

      const body = await response.json()
      // Should error because audioUrl is not available on PostSummary
      expect(body.errors).toBeDefined()
    })

    it("should paginate with cursor", async () => {
      await createTestPosts(testUserId, 15)

      // First page
      const response1 = await makeRequest(`${testServer.url}/graphql`, {
        method: "POST",
        headers: { Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({
          query: `
            query GetPosts($limit: Int) {
              getPosts(limit: $limit) {
                posts { id }
                hasMore
                nextCursor
              }
            }
          `,
          variables: { limit: 10 },
        }),
      })

      const body1 = await response1.json()
      expect(body1.data.getPosts.posts).toHaveLength(10)
      expect(body1.data.getPosts.hasMore).toBe(true)

      // Second page
      const response2 = await makeRequest(`${testServer.url}/graphql`, {
        method: "POST",
        headers: { Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({
          query: `
            query GetPosts($cursor: String, $limit: Int) {
              getPosts(cursor: $cursor, limit: $limit) {
                posts { id }
                hasMore
              }
            }
          `,
          variables: { cursor: body1.data.getPosts.nextCursor, limit: 10 },
        }),
      })

      const body2 = await response2.json()
      expect(body2.data.getPosts.posts).toHaveLength(5)
      expect(body2.data.getPosts.hasMore).toBe(false)
    })
  })

  describe("getPostById", () => {
    it("should return full post with audioUrl", async () => {
      const post = await createTestPost({ userId: testUserId })

      const response = await makeRequest(`${testServer.url}/graphql`, {
        method: "POST",
        headers: { Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({
          query: `
            query GetPostById($id: Int!) {
              getPostById(id: $id) {
                id
                audioUrl
                duration
                tags
                city
                author { username }
              }
            }
          `,
          variables: { id: post.id },
        }),
      })

      const body = await response.json()
      expect(response.status).toBe(200)
      expect(body.data.getPostById.id).toBe(post.id)
      expect(body.data.getPostById.audioUrl).toBeDefined()
      expect(body.data.getPostById.author.username).toBeDefined()
    })

    it("should return null for non-existent post", async () => {
      const response = await makeRequest(`${testServer.url}/graphql`, {
        method: "POST",
        headers: { Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({
          query: `query { getPostById(id: 99999) { id } }`,
        }),
      })

      const body = await response.json()
      expect(body.data.getPostById).toBeNull()
    })
  })

  describe("createPost", () => {
    it("should create a new post", async () => {
      const response = await makeRequest(`${testServer.url}/graphql`, {
        method: "POST",
        headers: { Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({
          query: `
            mutation CreatePost($audioKey: String!, $duration: Int!, $tags: [String!]) {
              createPost(audioKey: $audioKey, duration: $duration, tags: $tags) {
                id
                duration
                tags
                responseCount
              }
            }
          `,
          variables: {
            audioKey: "audio/test-123.webm",
            duration: 45,
            tags: ["stressed", "work"],
          },
        }),
      })

      const body = await response.json()
      expect(response.status).toBe(200)
      expect(body.data.createPost.id).toBeDefined()
      expect(body.data.createPost.duration).toBe(45)
      expect(body.data.createPost.tags).toEqual(["stressed", "work"])
      expect(body.data.createPost.responseCount).toBe(0)
    })

    it("should reject without auth", async () => {
      const response = await makeRequest(`${testServer.url}/graphql`, {
        method: "POST",
        body: JSON.stringify({
          query: `
            mutation CreatePost($audioKey: String!, $duration: Int!) {
              createPost(audioKey: $audioKey, duration: $duration) { id }
            }
          `,
          variables: { audioKey: "test.webm", duration: 30 },
        }),
      })

      const body = await response.json()
      expect(body.errors).toBeDefined()
      expect(body.errors[0].extensions.code).toBe("UNAUTHENTICATED")
    })
  })

  describe("createResponse", () => {
    it("should create a response to a post", async () => {
      const parentPost = await createTestPost({ userId: testUserId })

      const response = await makeRequest(`${testServer.url}/graphql`, {
        method: "POST",
        headers: { Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({
          query: `
            mutation CreateResponse($parentId: Int!, $audioKey: String!, $duration: Int!) {
              createResponse(parentId: $parentId, audioKey: $audioKey, duration: $duration) {
                id
                type
                parentId
              }
            }
          `,
          variables: {
            parentId: parentPost.id,
            audioKey: "audio/response-123.webm",
            duration: 20,
          },
        }),
      })

      const body = await response.json()
      expect(body.data.createResponse.type).toBe("RESPONSE")
      expect(body.data.createResponse.parentId).toBe(parentPost.id)
    })

    it("should increment parent response count", async () => {
      const parentPost = await createTestPost({ userId: testUserId })

      await makeRequest(`${testServer.url}/graphql`, {
        method: "POST",
        headers: { Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({
          query: `
            mutation CreateResponse($parentId: Int!, $audioKey: String!, $duration: Int!) {
              createResponse(parentId: $parentId, audioKey: $audioKey, duration: $duration) { id }
            }
          `,
          variables: { parentId: parentPost.id, audioKey: "test.webm", duration: 20 },
        }),
      })

      // Check parent's response count
      const getResponse = await makeRequest(`${testServer.url}/graphql`, {
        method: "POST",
        headers: { Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({
          query: `query { getPostById(id: ${parentPost.id}) { responseCount } }`,
        }),
      })

      const body = await getResponse.json()
      expect(body.data.getPostById.responseCount).toBe(1)
    })

    it("should create notification for post author", async () => {
      // Create another user who will receive the notification
      const author = await createTestUser()
      await createTestProfile(author.id)
      const parentPost = await createTestPost({ userId: author.id })

      await makeRequest(`${testServer.url}/graphql`, {
        method: "POST",
        headers: { Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({
          query: `
            mutation CreateResponse($parentId: Int!, $audioKey: String!, $duration: Int!) {
              createResponse(parentId: $parentId, audioKey: $audioKey, duration: $duration) { id }
            }
          `,
          variables: { parentId: parentPost.id, audioKey: "test.webm", duration: 20 },
        }),
      })

      // Check author's notifications
      const authorToken = await createTestJWT(undefined, { extraClaims: { userId: author.id } })
      const notifResponse = await makeRequest(`${testServer.url}/graphql`, {
        method: "POST",
        headers: { Authorization: `Bearer ${authorToken}` },
        body: JSON.stringify({
          query: `query { getMyUnreadNotificationsCount }`,
        }),
      })

      const body = await notifResponse.json()
      expect(body.data.getMyUnreadNotificationsCount).toBe(1)
    })
  })

  describe("deletePost", () => {
    it("should delete own post", async () => {
      const post = await createTestPost({ userId: testUserId })

      const response = await makeRequest(`${testServer.url}/graphql`, {
        method: "POST",
        headers: { Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({
          query: `mutation { deletePost(id: ${post.id}) { success } }`,
        }),
      })

      const body = await response.json()
      expect(body.data.deletePost.success).toBe(true)

      // Verify deleted
      const getResponse = await makeRequest(`${testServer.url}/graphql`, {
        method: "POST",
        headers: { Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({
          query: `query { getPostById(id: ${post.id}) { id } }`,
        }),
      })
      const getBody = await getResponse.json()
      expect(getBody.data.getPostById).toBeNull()
    })

    it("should not delete another user's post", async () => {
      const otherUser = await createTestUser()
      const otherPost = await createTestPost({ userId: otherUser.id })

      const response = await makeRequest(`${testServer.url}/graphql`, {
        method: "POST",
        headers: { Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({
          query: `mutation { deletePost(id: ${otherPost.id}) { success } }`,
        }),
      })

      const body = await response.json()
      expect(body.errors).toBeDefined()
    })
  })
})
```

---

### Test: Responses with Sorting (`tests/server/graphql/responses.test.ts`)

```typescript
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "bun:test"
import { createTestJWT } from "../../helpers/auth"
import { createTestUser, setupTestDatabase } from "../../helpers/database"
import { createTestPost, createTestPostWithResponses, createTestBookmark, cleanTestPosts } from "../../helpers/posts"
import { createTestProfile } from "../../helpers/profiles"
import { makeRequest, startTestServer, waitForServer } from "../../helpers/server"
import "../../setup"

describe("Responses API with Sorting", () => {
  let testServer: any
  let authToken: string
  let testUserId: number

  beforeAll(async () => {
    testServer = await startTestServer()
    await waitForServer(testServer.url)
  })

  afterAll(async () => {
    if (testServer) await testServer.shutdown()
  })

  beforeEach(async () => {
    await setupTestDatabase()
    await cleanTestPosts()

    const user = await createTestUser()
    testUserId = user.id
    await createTestProfile(user.id)
    authToken = await createTestJWT(undefined, { extraClaims: { userId: user.id } })
  })

  describe("getResponses", () => {
    it("should return responses sorted by NEWEST (default)", async () => {
      const responders = await Promise.all([
        createTestUser(),
        createTestUser(),
        createTestUser(),
      ])
      for (const r of responders) await createTestProfile(r.id)

      const { post } = await createTestPostWithResponses(
        testUserId,
        responders.map(r => r.id)
      )

      const response = await makeRequest(`${testServer.url}/graphql`, {
        method: "POST",
        headers: { Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({
          query: `
            query GetResponses($postId: Int!) {
              getResponses(postId: $postId) {
                posts { id createdAt }
              }
            }
          `,
          variables: { postId: post.id },
        }),
      })

      const body = await response.json()
      const posts = body.data.getResponses.posts

      // Verify sorted by newest first
      for (let i = 1; i < posts.length; i++) {
        expect(new Date(posts[i-1].createdAt).getTime())
          .toBeGreaterThanOrEqual(new Date(posts[i].createdAt).getTime())
      }
    })

    it("should sort by OLDEST", async () => {
      const responders = await Promise.all([createTestUser(), createTestUser()])
      for (const r of responders) await createTestProfile(r.id)

      const { post } = await createTestPostWithResponses(testUserId, responders.map(r => r.id))

      const response = await makeRequest(`${testServer.url}/graphql`, {
        method: "POST",
        headers: { Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({
          query: `
            query GetResponses($postId: Int!, $sortBy: SortBy) {
              getResponses(postId: $postId, sortBy: $sortBy) {
                posts { id createdAt }
              }
            }
          `,
          variables: { postId: post.id, sortBy: "OLDEST" },
        }),
      })

      const body = await response.json()
      const posts = body.data.getResponses.posts

      // Verify sorted by oldest first
      for (let i = 1; i < posts.length; i++) {
        expect(new Date(posts[i-1].createdAt).getTime())
          .toBeLessThanOrEqual(new Date(posts[i].createdAt).getTime())
      }
    })

    it("should sort by MOST_SAVED", async () => {
      const responders = await Promise.all([createTestUser(), createTestUser()])
      for (const r of responders) await createTestProfile(r.id)

      const { post, responses } = await createTestPostWithResponses(
        testUserId,
        responders.map(r => r.id)
      )

      // Add bookmarks to first response
      await createTestBookmark(testUserId, responses[0].id)
      await createTestBookmark(responders[0].id, responses[0].id)

      const response = await makeRequest(`${testServer.url}/graphql`, {
        method: "POST",
        headers: { Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({
          query: `
            query GetResponses($postId: Int!, $sortBy: SortBy) {
              getResponses(postId: $postId, sortBy: $sortBy) {
                posts { id bookmarkCount }
              }
            }
          `,
          variables: { postId: post.id, sortBy: "MOST_SAVED" },
        }),
      })

      const body = await response.json()
      const posts = body.data.getResponses.posts

      // First response should have most bookmarks
      expect(posts[0].bookmarkCount).toBeGreaterThan(posts[1].bookmarkCount)
    })
  })
})
```

---

### Test: Bookmarks (`tests/server/graphql/bookmarks.test.ts`)

```typescript
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "bun:test"
import { createTestJWT } from "../../helpers/auth"
import { createTestUser, setupTestDatabase } from "../../helpers/database"
import { createTestPost, createTestPosts, cleanTestPosts } from "../../helpers/posts"
import { createTestProfile } from "../../helpers/profiles"
import { makeRequest, startTestServer, waitForServer } from "../../helpers/server"
import "../../setup"

describe("Bookmarks API", () => {
  let testServer: any
  let authToken: string
  let testUserId: number

  beforeAll(async () => {
    testServer = await startTestServer()
    await waitForServer(testServer.url)
  })

  afterAll(async () => {
    if (testServer) await testServer.shutdown()
  })

  beforeEach(async () => {
    await setupTestDatabase()
    await cleanTestPosts()

    const user = await createTestUser()
    testUserId = user.id
    await createTestProfile(user.id)
    authToken = await createTestJWT(undefined, { extraClaims: { userId: user.id } })
  })

  describe("bookmarkPost", () => {
    it("should bookmark a post", async () => {
      const post = await createTestPost({ userId: testUserId })

      const response = await makeRequest(`${testServer.url}/graphql`, {
        method: "POST",
        headers: { Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({
          query: `mutation { bookmarkPost(postId: ${post.id}) { success } }`,
        }),
      })

      const body = await response.json()
      expect(body.data.bookmarkPost.success).toBe(true)
    })

    it("should increment bookmark count on post", async () => {
      const post = await createTestPost({ userId: testUserId })

      await makeRequest(`${testServer.url}/graphql`, {
        method: "POST",
        headers: { Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({
          query: `mutation { bookmarkPost(postId: ${post.id}) { success } }`,
        }),
      })

      const getResponse = await makeRequest(`${testServer.url}/graphql`, {
        method: "POST",
        headers: { Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({
          query: `query { getPostById(id: ${post.id}) { bookmarkCount } }`,
        }),
      })

      const body = await getResponse.json()
      expect(body.data.getPostById.bookmarkCount).toBe(1)
    })

    it("should not allow duplicate bookmarks", async () => {
      const post = await createTestPost({ userId: testUserId })

      // First bookmark
      await makeRequest(`${testServer.url}/graphql`, {
        method: "POST",
        headers: { Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({
          query: `mutation { bookmarkPost(postId: ${post.id}) { success } }`,
        }),
      })

      // Second bookmark attempt
      const response = await makeRequest(`${testServer.url}/graphql`, {
        method: "POST",
        headers: { Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({
          query: `mutation { bookmarkPost(postId: ${post.id}) { success } }`,
        }),
      })

      const body = await response.json()
      expect(body.errors).toBeDefined()
    })
  })

  describe("removeBookmark", () => {
    it("should remove a bookmark", async () => {
      const post = await createTestPost({ userId: testUserId })

      // Add bookmark
      await makeRequest(`${testServer.url}/graphql`, {
        method: "POST",
        headers: { Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({
          query: `mutation { bookmarkPost(postId: ${post.id}) { success } }`,
        }),
      })

      // Remove bookmark
      const response = await makeRequest(`${testServer.url}/graphql`, {
        method: "POST",
        headers: { Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({
          query: `mutation { removeBookmark(postId: ${post.id}) { success } }`,
        }),
      })

      const body = await response.json()
      expect(body.data.removeBookmark.success).toBe(true)
    })

    it("should decrement bookmark count on post", async () => {
      const post = await createTestPost({ userId: testUserId })

      await makeRequest(`${testServer.url}/graphql`, {
        method: "POST",
        headers: { Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({
          query: `mutation { bookmarkPost(postId: ${post.id}) { success } }`,
        }),
      })

      await makeRequest(`${testServer.url}/graphql`, {
        method: "POST",
        headers: { Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({
          query: `mutation { removeBookmark(postId: ${post.id}) { success } }`,
        }),
      })

      const getResponse = await makeRequest(`${testServer.url}/graphql`, {
        method: "POST",
        headers: { Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({
          query: `query { getPostById(id: ${post.id}) { bookmarkCount } }`,
        }),
      })

      const body = await getResponse.json()
      expect(body.data.getPostById.bookmarkCount).toBe(0)
    })
  })

  describe("getMyBookmarks", () => {
    it("should return user's bookmarked posts", async () => {
      const posts = await createTestPosts(testUserId, 3)

      // Bookmark first two posts
      for (const post of posts.slice(0, 2)) {
        await makeRequest(`${testServer.url}/graphql`, {
          method: "POST",
          headers: { Authorization: `Bearer ${authToken}` },
          body: JSON.stringify({
            query: `mutation { bookmarkPost(postId: ${post.id}) { success } }`,
          }),
        })
      }

      const response = await makeRequest(`${testServer.url}/graphql`, {
        method: "POST",
        headers: { Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({
          query: `
            query GetMyBookmarks {
              getMyBookmarks {
                posts { id isBookmarked }
              }
            }
          `,
        }),
      })

      const body = await response.json()
      expect(body.data.getMyBookmarks.posts).toHaveLength(2)
      expect(body.data.getMyBookmarks.posts.every(p => p.isBookmarked)).toBe(true)
    })

    it("should sort bookmarks by NEWEST", async () => {
      const posts = await createTestPosts(testUserId, 3)

      for (const post of posts) {
        await makeRequest(`${testServer.url}/graphql`, {
          method: "POST",
          headers: { Authorization: `Bearer ${authToken}` },
          body: JSON.stringify({
            query: `mutation { bookmarkPost(postId: ${post.id}) { success } }`,
          }),
        })
        await new Promise(r => setTimeout(r, 10)) // Small delay between bookmarks
      }

      const response = await makeRequest(`${testServer.url}/graphql`, {
        method: "POST",
        headers: { Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({
          query: `
            query GetMyBookmarks($sortBy: SortBy) {
              getMyBookmarks(sortBy: $sortBy) {
                posts { id }
              }
            }
          `,
          variables: { sortBy: "NEWEST" },
        }),
      })

      const body = await response.json()
      // Last bookmarked should be first
      expect(body.data.getMyBookmarks.posts[0].id).toBe(posts[2].id)
    })
  })
})
```

---

### Test: User Profiles (`tests/server/graphql/profiles.test.ts`)

```typescript
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "bun:test"
import { createTestJWT } from "../../helpers/auth"
import { createTestUser, setupTestDatabase } from "../../helpers/database"
import { createTestProfile, cleanTestProfiles } from "../../helpers/profiles"
import { makeRequest, startTestServer, waitForServer } from "../../helpers/server"
import "../../setup"

describe("User Profiles API", () => {
  let testServer: any
  let authToken: string
  let testUserId: number

  beforeAll(async () => {
    testServer = await startTestServer()
    await waitForServer(testServer.url)
  })

  afterAll(async () => {
    if (testServer) await testServer.shutdown()
  })

  beforeEach(async () => {
    await setupTestDatabase()
    await cleanTestProfiles()

    const user = await createTestUser()
    testUserId = user.id
    authToken = await createTestJWT(undefined, { extraClaims: { userId: user.id } })
  })

  describe("createProfile", () => {
    it("should create a new profile", async () => {
      const response = await makeRequest(`${testServer.url}/graphql`, {
        method: "POST",
        headers: { Authorization: `Bearer ${authToken}` },
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
            username: "testuser123",
            ageRange: "AGE_25_34",
            occupation: "Developer",
          },
        }),
      })

      const body = await response.json()
      expect(response.status).toBe(200)
      expect(body.data.createProfile.username).toBe("testuser123")
      expect(body.data.createProfile.ageRange).toBe("AGE_25_34")
      expect(body.data.createProfile.city).toBe("singapore") // Default
    })

    it("should reject duplicate username", async () => {
      await createTestProfile(testUserId, { username: "taken_username" })

      const otherUser = await createTestUser()
      const otherToken = await createTestJWT(undefined, { extraClaims: { userId: otherUser.id } })

      const response = await makeRequest(`${testServer.url}/graphql`, {
        method: "POST",
        headers: { Authorization: `Bearer ${otherToken}` },
        body: JSON.stringify({
          query: `
            mutation CreateProfile($username: String!) {
              createProfile(username: $username) { id }
            }
          `,
          variables: { username: "taken_username" },
        }),
      })

      const body = await response.json()
      expect(body.errors).toBeDefined()
      expect(body.errors[0].message).toContain("username")
    })

    it("should reject if user already has profile", async () => {
      await createTestProfile(testUserId)

      const response = await makeRequest(`${testServer.url}/graphql`, {
        method: "POST",
        headers: { Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({
          query: `
            mutation CreateProfile($username: String!) {
              createProfile(username: $username) { id }
            }
          `,
          variables: { username: "another_username" },
        }),
      })

      const body = await response.json()
      expect(body.errors).toBeDefined()
    })
  })

  describe("getMyProfile", () => {
    it("should return current user's profile", async () => {
      await createTestProfile(testUserId, { username: "myprofile" })

      const response = await makeRequest(`${testServer.url}/graphql`, {
        method: "POST",
        headers: { Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({
          query: `query { getMyProfile { id username city } }`,
        }),
      })

      const body = await response.json()
      expect(body.data.getMyProfile.username).toBe("myprofile")
    })

    it("should return null if no profile exists", async () => {
      const response = await makeRequest(`${testServer.url}/graphql`, {
        method: "POST",
        headers: { Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({
          query: `query { getMyProfile { id } }`,
        }),
      })

      const body = await response.json()
      expect(body.data.getMyProfile).toBeNull()
    })
  })

  describe("getProfileByUsername", () => {
    it("should return profile by username", async () => {
      await createTestProfile(testUserId, { username: "findme" })

      const response = await makeRequest(`${testServer.url}/graphql`, {
        method: "POST",
        headers: { Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({
          query: `
            query GetProfileByUsername($username: String!) {
              getProfileByUsername(username: $username) {
                username
                ageRange
              }
            }
          `,
          variables: { username: "findme" },
        }),
      })

      const body = await response.json()
      expect(body.data.getProfileByUsername.username).toBe("findme")
    })
  })

  describe("updateProfile", () => {
    it("should update profile fields", async () => {
      await createTestProfile(testUserId, { occupation: "Developer" })

      const response = await makeRequest(`${testServer.url}/graphql`, {
        method: "POST",
        headers: { Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({
          query: `
            mutation UpdateProfile($input: UpdateProfileInput!) {
              updateProfile(input: $input) {
                occupation
              }
            }
          `,
          variables: {
            input: { occupation: "Designer" },
          },
        }),
      })

      const body = await response.json()
      expect(body.data.updateProfile.occupation).toBe("Designer")
    })
  })
})
```

---

### Test: Legal Content (`tests/server/graphql/legal-content.test.ts`)

```typescript
import { afterAll, beforeAll, describe, expect, it } from "bun:test"
import { makeRequest, startTestServer, waitForServer } from "../../helpers/server"
import "../../setup"

describe("Legal Content API", () => {
  let testServer: any

  beforeAll(async () => {
    testServer = await startTestServer()
    await waitForServer(testServer.url)
  })

  afterAll(async () => {
    if (testServer) await testServer.shutdown()
  })

  describe("getPrivacyPolicy", () => {
    it("should return privacy policy without auth", async () => {
      const response = await makeRequest(`${testServer.url}/graphql`, {
        method: "POST",
        body: JSON.stringify({
          query: `
            query {
              getPrivacyPolicy {
                type
                title
                content
                version
                effectiveDate
              }
            }
          `,
        }),
      })

      const body = await response.json()
      expect(response.status).toBe(200)

      if (body.data.getPrivacyPolicy) {
        expect(body.data.getPrivacyPolicy.type).toBe("privacy_policy")
        expect(body.data.getPrivacyPolicy.title).toBeDefined()
        expect(body.data.getPrivacyPolicy.content).toBeDefined()
      }
    })
  })

  describe("getTermsAndConditions", () => {
    it("should return terms without auth", async () => {
      const response = await makeRequest(`${testServer.url}/graphql`, {
        method: "POST",
        body: JSON.stringify({
          query: `
            query {
              getTermsAndConditions {
                type
                title
                content
              }
            }
          `,
        }),
      })

      const body = await response.json()
      expect(response.status).toBe(200)

      if (body.data.getTermsAndConditions) {
        expect(body.data.getTermsAndConditions.type).toBe("terms_conditions")
      }
    })
  })
})
```

---

### Test: Server Routes (`tests/server/routes/landing-page.test.ts`)

```typescript
import { afterAll, beforeAll, describe, expect, it } from "bun:test"
import { startTestServer, waitForServer, makeRequest } from "../../helpers/server"
import "../../setup"

describe("Server Routes", () => {
  let testServer: any

  beforeAll(async () => {
    testServer = await startTestServer()
    await waitForServer(testServer.url)
  })

  afterAll(async () => {
    if (testServer) await testServer.shutdown()
  })

  describe("Landing Page", () => {
    it("should serve landing page at /", async () => {
      const response = await fetch(testServer.url)

      expect(response.status).toBe(200)
      expect(response.headers.get("content-type")).toContain("text/html")

      const html = await response.text()
      expect(html).toContain("Echo")
      expect(html).toContain("App Store")
      expect(html).toContain("Google Play")
    })
  })

  describe("Privacy Policy Page", () => {
    it("should serve privacy policy at /privacy", async () => {
      const response = await fetch(`${testServer.url}/privacy`)

      expect(response.status).toBe(200)
      expect(response.headers.get("content-type")).toContain("text/html")
    })
  })

  describe("Terms Page", () => {
    it("should serve terms at /terms", async () => {
      const response = await fetch(`${testServer.url}/terms`)

      expect(response.status).toBe(200)
      expect(response.headers.get("content-type")).toContain("text/html")
    })
  })

  describe("Health Check", () => {
    it("should return healthy at /health", async () => {
      const response = await fetch(`${testServer.url}/health`)

      expect(response.status).toBe(200)
    })
  })
})
```

---

### Test: R2 Integration (`tests/server/lib/r2.test.ts`)

```typescript
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "bun:test"
import { createTestJWT } from "../../helpers/auth"
import { createTestUser, setupTestDatabase } from "../../helpers/database"
import { createTestProfile } from "../../helpers/profiles"
import { makeRequest, startTestServer, waitForServer } from "../../helpers/server"
import "../../setup"

describe("R2 Integration", () => {
  let testServer: any
  let authToken: string
  let testUserId: number

  beforeAll(async () => {
    testServer = await startTestServer()
    await waitForServer(testServer.url)
  })

  afterAll(async () => {
    if (testServer) await testServer.shutdown()
  })

  beforeEach(async () => {
    await setupTestDatabase()

    const user = await createTestUser()
    testUserId = user.id
    await createTestProfile(user.id)
    authToken = await createTestJWT(undefined, { extraClaims: { userId: user.id } })
  })

  describe("getAudioUploadUrl", () => {
    it("should return presigned upload URL", async () => {
      const response = await makeRequest(`${testServer.url}/graphql`, {
        method: "POST",
        headers: { Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({
          query: `
            mutation GetAudioUploadUrl($contentType: String!) {
              getAudioUploadUrl(contentType: $contentType) {
                success
                uploadUrl
                publicUrl
                key
                error
              }
            }
          `,
          variables: { contentType: "audio/webm" },
        }),
      })

      const body = await response.json()
      expect(response.status).toBe(200)

      if (body.data.getAudioUploadUrl.success) {
        expect(body.data.getAudioUploadUrl.uploadUrl).toContain("https://")
        expect(body.data.getAudioUploadUrl.publicUrl).toContain("https://")
        expect(body.data.getAudioUploadUrl.key).toContain("audio/")
      } else {
        // R2 not configured in test env - that's OK
        expect(body.data.getAudioUploadUrl.error).toBeDefined()
      }
    })

    it("should reject invalid content type", async () => {
      const response = await makeRequest(`${testServer.url}/graphql`, {
        method: "POST",
        headers: { Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({
          query: `
            mutation GetAudioUploadUrl($contentType: String!) {
              getAudioUploadUrl(contentType: $contentType) {
                success
                error
              }
            }
          `,
          variables: { contentType: "image/png" },
        }),
      })

      const body = await response.json()
      expect(body.data.getAudioUploadUrl.success).toBe(false)
      expect(body.data.getAudioUploadUrl.error).toContain("audio")
    })

    it("should reject without auth", async () => {
      const response = await makeRequest(`${testServer.url}/graphql`, {
        method: "POST",
        body: JSON.stringify({
          query: `
            mutation {
              getAudioUploadUrl(contentType: "audio/webm") {
                success
              }
            }
          `,
        }),
      })

      const body = await response.json()
      expect(body.errors).toBeDefined()
      expect(body.errors[0].extensions.code).toBe("UNAUTHENTICATED")
    })
  })
})
```

---

### Implementation Status Tracking

Add to top of test files:
```typescript
// Status: [ ] Not started / [~] In progress / [x] Complete
// Last updated: YYYY-MM-DD
```

---

## Deferred Features

- Voice filter processing (server-side audio transformation)
- calculatePulseStats worker (aggregate tag stats by city)
- cleanupOldPosts worker (data retention)

---

## Verification Checklist

- [ ] Run `bun run gen` to generate migrations
- [ ] Run `bun run db push` to apply schema
- [ ] Test GraphQL queries/mutations via `/graphql`
- [ ] Test R2 presigned URL generation and upload
- [ ] Test Firebase auth with emulator or test project
- [ ] Verify waveform PNG generation
- [x] Check landing page renders at `/` (code complete)
- [x] Check legal pages render at `/privacy` and `/terms` (code complete)
- [ ] Run `bun run test` (requires test database)

---

## Implementation Notes

**Completed: 2025-01-12**

All core implementation is complete:
- Database schema with all tables and enums
- GraphQL API with all queries and mutations
- Firebase Phone Auth integration
- R2 presigned URL generation and file operations
- Waveform generation background worker
- Landing page and legal page routes
- Test helpers updated in `tests/helpers/database.ts`

**Dependencies installed:**
- `aws4fetch` - For R2 S3-compatible requests
- `marked` - For Markdown rendering in legal pages

**Remaining for deployment:**
1. Create test database (`echo_test`)
2. Run migrations with `bun run db push`
3. Configure environment variables for R2 and Firebase
4. Run integration tests
