# Direct chat info

Bearer JWT required. Routes also available under `/app/chats`.

- `GET /chats/direct/:participantUserId/info`: returns `{ data: { conversationUuid, participant: { id, uuid, name, email, profilePicUrl }, mediaCount, docsCount, linksCount } }`.
- `GET /chats/direct/:participantUserId/media?type=docs`: returns `{ data: [{ id, type, url, name, sizeBytes, mimeType, createdAt, senderName }] }`. Type is `media`, `docs`, `links`, or `all` (default).

The participant must be an active, non-deleted user in the same organization. Shared items require an accessible DIRECT conversation with both participants active. Items from both senders are included; deleted messages are excluded. When no accessible conversation exists, profile info still loads with null conversation UUID and zero counts; media returns an empty array. Invalid participant IDs/types return 400; invalid peers return 404.

Media includes images/videos; docs includes all other attachment MIME types, matching the group gallery. Link counts reflect individual extracted URLs. File and profile URLs use the organization's storage access provider. Neither endpoint marks messages read or creates conversations. No database migration required.
