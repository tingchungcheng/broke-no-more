-- Statement discovery metadata. Message bodies and attachments are not stored.

ALTER TABLE statements ADD COLUMN gmail_message_id TEXT;
ALTER TABLE statements ADD COLUMN subject TEXT;
ALTER TABLE statements ADD COLUMN sender TEXT;
ALTER TABLE statements ADD COLUMN received_on TEXT;
ALTER TABLE statements ADD COLUMN matched_keywords TEXT;

CREATE UNIQUE INDEX statements_user_gmail_message_unique ON statements (user_id, gmail_message_id);
