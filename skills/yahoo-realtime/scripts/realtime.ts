import { valibotSchema } from '@ai-sdk/valibot'
import { tool } from 'ai'
import * as v from 'valibot'

interface Head {
  totalResultsAvailable: number
  totalResultsReturned: number
}

interface Badge {
  show: boolean
  type: string
  color: string
}

interface MediaItem {
  type: string
  item: {
    url: string
    displayUrl: string
    mediaUrl: string
    sizes: { viewer: { width: number; height: number } }
    thumbnailImageUrl: string
  }
  metaImageUrl: string
}

interface Url {
  displayUrl: string
  expandedUrl: string
  url: string
  indices: number[]
}

interface Hashtag {
  text: string
  indices: number[]
}

interface Mention {
  id: string
  name: string
  screenName: string
  indices: number[]
}

interface QuotedTweet {
  id: string
  url: string
  detailUrl: string
  badge: Badge
  displayTextBody: string
  urls: Url[]
  replyMentions: unknown[]
  replyMentionUrls: unknown
  createdAt: number
  userId: string
  name: string
  screenName: string
  profileImage: string
  userUrl: string
  media: unknown[]
}

interface Entry {
  id: string
  url: string
  detailUrl: string
  detailQuoteUrl: string
  badge: Badge
  displayText: string
  displayTextBody: string
  displayTextFragments: string
  displayTextEntities: string
  urls: Url[]
  hashtags: Hashtag[]
  hashtagUrls: Record<string, string>
  mentions: Mention[]
  mentionUrls: Record<string, string>
  replyMentions: string[]
  replyMentionUrls: Record<string, string>
  createdAt: number
  replyCount: number
  replyUrl: string
  rtCount: number
  rtUrl: string
  qtCount: number
  likesCount: number
  likesUrl: string
  userId: string
  userUrl: string
  name: string
  screenName: string
  profileImage: string
  mediaType: string[]
  media: MediaItem[]
  possiblySensitive: boolean
  tweetThemeNormal: string[]
  userThemeNormal: string[]
  twitterContextID: unknown[]
  videoClassifyId: unknown[]
  inReplyTo: string
  quotedTweet?: QuotedTweet
}

interface Timeline {
  head: Head
  entry: Entry[]
  mediaTweet: boolean
}

interface ResponseData {
  timeline: Timeline
}

export const searchPosts = async (
  query: string,
  mode: 'popular' | 'latest' = 'popular',
  max = 20,
): Promise<Entry[]> => {
  const url = new URL(
    'https://search.yahoo.co.jp/realtime/api/v1/pagination?rkf=3&b=0&start=',
  )

  if (mode === 'popular') url.searchParams.set('md', 'h')
  url.searchParams.append('p', query)

  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Yahoo realtime API error: ${response.status}`)
  }

  const data = (await response.json()) as ResponseData
  return (data.timeline?.entry ?? []).slice(0, max)
}

const formatEntry = (entry: Entry) => ({
  user: `${entry.name} (@${entry.screenName})`,
  stats: `❤️ ${entry.likesCount} 🔁 ${entry.rtCount} 💬 ${entry.replyCount}`,
  createdAt: new Date(entry.createdAt * 1000).toISOString(),
  body: entry.displayTextBody,
  quoted: entry.quotedTweet
    ? {
        id: entry.quotedTweet.id,
        user: {
          display: entry.quotedTweet.name,
          id: entry.quotedTweet.screenName,
        },
        body: entry.quotedTweet.displayTextBody,
        createdAt: new Date(entry.quotedTweet.createdAt * 1000).toISOString(),
      }
    : null,
  url: `https://x.com/${entry.screenName}/status/${entry.id}`,
})

export const processRealtimeQuery = async (query: string, max = 20) => {
  const [latest, popular] = await Promise.all([
    searchPosts(query, 'latest', max),
    searchPosts(query, 'popular', max),
  ])

  return {
    query,
    latest:
      latest.length === 0
        ? 'Not found. Change query, make query short, or make query Japanese.'
        : latest.map(formatEntry),
    popular:
      popular.length === 0
        ? 'Not found. Change query, make query short, or make query Japanese.'
        : popular.map(formatEntry),
  }
}

const realtimeInputSchema = v.object({
  queries: v.pipe(v.array(v.string()), v.description('List of search queries.')),
  max: v.optional(
    v.pipe(
      v.number(),
      v.minValue(1),
      v.maxValue(50),
      v.description('Maximum number of results per query. Default is 20.'),
    ),
    20,
  ),
})

type RealtimeSearchInput = v.InferOutput<typeof realtimeInputSchema>

export const realtimeTool = tool<RealtimeSearchInput, unknown>({
  description:
    'Search posts on X (formerly Twitter) via Yahoo! Realtime API. Useful for recent Japanese trend checks.',
  inputSchema: valibotSchema(realtimeInputSchema),
  async execute({ queries, max }) {
    const results = await Promise.all(
      queries.map((query) => processRealtimeQuery(query, max)),
    )
    return { results }
  },
})
