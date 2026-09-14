# Message search

Both endpoints require the existing Bearer JWT and also work under `/app/chats`.

- `GET /chats/direct/messages/search?participantUserId=9&q=hello&page=1&limit=25`
- `GET /chats/group/:conversationUuid/messages/search?q=hello&page=1&limit=25`

`q` is a trimmed, case-insensitive literal substring of message text/captions (1–200 characters). `%` and `_` are literal characters, not wildcards. Page defaults to 1 (maximum 100000); limit defaults to 25 (maximum 100). Invalid inputs return HTTP 400.

Response: `{ "data": [/* existing message objects */], "pagination": { "page": 1, "limit": 25, "hasMore": false } }`.

Results are newest first, scoped to the authenticated user's organization and active conversation membership. Deleted messages/conversations are excluded. Search does not mark messages or notifications as read. No accessible matches returns an empty data array. Attachment filenames and voice transcripts are not searched.

The mobile chat menu opens a debounced search with paginated results. Selecting a result jumps to that message in the chat. No database migration is required.
