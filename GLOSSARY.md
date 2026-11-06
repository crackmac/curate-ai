# CurateAI

A personal content curator: it gathers items from many feeds, ranks them against one user's interests, and presents a daily digest.

## Language

### Sources and content

**Source**:
One configured feed that content is gathered from, such as a specific subreddit or RSS feed.
_Avoid_: Feed, provider

**Source Type**:
The kind of service a Source reads from: Hacker News, Reddit, RSS, YouTube or Bluesky.
_Avoid_: Adapter, source kind, "type"

**Default Source**:
A Source that ships with the app and is enabled unless the User turns it off.
_Avoid_: Vetted source, built-in source

**Custom Source**:
A Source the User added themselves.
_Avoid_: Unvetted source, user source

**Category**:
A named grouping of Sources (e.g. "Tech") with its own ingest and curate cadence. Unrelated to Topics.
_Avoid_: Topic, section, channel

**Content Item**:
A single piece of content gathered from a Source, before any ranking.
_Avoid_: Post, article, raw item

**Format**:
The shape of a Content Item: article, video, short or social.
_Avoid_: Content type, "type"

**Story**:
The underlying news or topic that several Content Items, from different Sources, can all be about.
_Avoid_: Thread, event

**Cross-Source Item**:
A Content Item whose Story also appeared on at least one other Source in the last 48 hours. Two Sources of the same Source Type (e.g. two subreddits) still count.
_Avoid_: Duplicate, trending item

**Ingest Run**:
One pass that gathers new Content Items from a Category's Sources.
_Avoid_: Sync, refresh, fetch job

**Curation Run**:
One pass that rebuilds a Category's slice of the current Digest.
_Avoid_: Ranking job, refresh

### The digest

**Curated Item**:
A Content Item picked for a User on a Digest Date, carrying a score, an explanation and a position.
_Avoid_: Pick, recommendation, ranked item

**Digest**:
All of one User's Curated Items for one Digest Date. Categories filter the Digest rather than producing separate Digests.
_Avoid_: Feed, daily list, category digest

**Digest Date**:
The calendar day a Digest belongs to.

**Freshness**:
The rule that a Curated Item's score fades as the underlying Content Item ages.
_Avoid_: Recency, decay

**Diversity Cap**:
The limit on how many Curated Items any one Source Type may fill in a Digest.
_Avoid_: Source limit, quota

**Reason**:
The single fixed label saying why a Curated Item was picked (e.g. topic match, trending, broadening — deliberately outside the User's usual interests).
_Avoid_: Reason tag, category, badge

**Explanation**:
The one-sentence, free-text account of why a particular Curated Item was picked.
_Avoid_: Reason, summary

### Interests and feedback

**User**:
The one person the Digest is curated for.
_Avoid_: Account, reader

**Interest Profile**:
A picture of what the User cares about, built from their Positive Signals with recent ones weighted more heavily.
_Avoid_: Interest vector, user model, taste

**Cold Start**:
The state before the User has any Positive Signals, when there is no Interest Profile to rank against.
_Avoid_: New user, empty profile

**Topic**:
A free-text interest the User declares (e.g. "rust"). Unrelated to Categories.
_Avoid_: Category, tag, interest

**Topic Score**:
How closely a Topic matches the User's demonstrated interests, from 0 to 100.
_Avoid_: Topic affinity, topic weight

**Interaction**:
One action a User takes on a Content Item: Click, Save, Dismiss or Less Like This.
_Avoid_: Event, feedback, "type"

**Positive Signal**:
A Click or a Save. Both count as evidence of interest; a Save is the stronger intent ("keep this"), a Click only means "opened it".
_Avoid_: Engagement, like

**Dismiss**:
Hiding a Curated Item with no opinion about it. Has no effect on future ranking.
_Avoid_: Dislike, reject

**Less Like This**:
An explicit negative signal: the User wants fewer items like this one.
_Avoid_: Dismiss, dislike, thumbs-down
