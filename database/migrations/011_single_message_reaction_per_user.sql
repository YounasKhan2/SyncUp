WITH ranked_reactions AS (
    SELECT message_id, user_id, emoji,
           row_number() OVER (
               PARTITION BY message_id, user_id
               ORDER BY created_at DESC, emoji DESC
           ) AS position
    FROM message_reactions
)
DELETE FROM message_reactions reaction
USING ranked_reactions ranked
WHERE reaction.message_id = ranked.message_id
  AND reaction.user_id = ranked.user_id
  AND reaction.emoji = ranked.emoji
  AND ranked.position > 1;

CREATE UNIQUE INDEX message_reactions_one_per_user
    ON message_reactions (message_id, user_id);
