-- Story ownership: link each Story to the User that authored it.
--
-- Follows the additive-first shape of 20260906000000_add_worlds_shared.
--
-- There is deliberately NO data backfill. `Story.author` is a user-editable
-- display string whose existing values are 'StoryForge', 'AfsanehSaz Author',
-- 'AfsanehSaz', or arbitrary author-typed text — none of which resolve to a
-- users.id, so there is no join key. Every pre-existing row stays authorId NULL
-- and remains editable by any ADMIN, so no content is orphaned by this change.
--
-- `authorId` is nullable because ON DELETE SET NULL requires it, matching the
-- existing `worldId` pattern exactly.

-- AlterTable stories: add authorId
ALTER TABLE "stories" ADD COLUMN "authorId" TEXT;

-- CreateIndex
CREATE INDEX "stories_authorId_idx" ON "stories"("authorId");

-- AddForeignKey
ALTER TABLE "stories" ADD CONSTRAINT "stories_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
