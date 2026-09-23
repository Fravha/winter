-- P5.5B follow-up: enforce the actor relation already required by the Prisma model.
-- Abort explicitly rather than silently deleting or fabricating legacy actor identities.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "production_batch_container_movements" movement
    LEFT JOIN "users" actor ON actor."id" = movement."actor_user_id"
    WHERE actor."id" IS NULL
  ) THEN
    RAISE EXCEPTION 'Cannot add movement actor FK: orphan actor_user_id values exist';
  END IF;
END;
$$;

ALTER TABLE "production_batch_container_movements"
  ADD CONSTRAINT "production_batch_container_movements_actor_user_id_fkey"
  FOREIGN KEY ("actor_user_id") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;